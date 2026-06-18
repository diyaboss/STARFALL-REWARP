/*jslint bitwise: true, node: true */
'use strict';

const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const SAT = require('sat');

const gameLogic = require('./game-logic');
const loggingRepositry = require('./repositories/logging-repository');
const chatRepository = require('./repositories/chat-repository');
const config = require('../../config');
const util = require('./lib/util');
const mapUtils = require('./map/map');
const {getPosition} = require("./lib/entityUtils");

let map = new mapUtils.Map(config);

let sockets = {};
let spectators = [];
const INIT_MASS_LOG = util.mathLog(config.defaultPlayerMass, config.slowBase);

let leaderboard = [];
let leaderboardChanged = false;

let matchStartTime = null;
let matchEnded = false;
let finalWinner = null;
let currentPhaseId = null;
let nextStormAt = 0;
let activeMatchDurationSeconds = config.matchDurationSeconds;
let activeRespawnDelaySeconds = config.respawnDelaySeconds;
let activeMatchMode = 'final';

const PHASES = [
    {
        id: 'arrival',
        chapter: 1,
        name: 'Arrival',
        startRatio: 0,
        message: 'Your core wakes in a silent sector. Drifter ships slide through the dark, coordinates are half-truths, and every rival is carrying a piece of your escape route.',
        droneTargetCount: 0,
        rogueShipTargetCount: 45,
        shardTargetCount: 0,
        maxVirus: 6,
        stormEverySeconds: 0,
        stormAmount: 0
    },
    {
        id: 'drone-awakening',
        chapter: 2,
        name: 'Relay Awakening',
        startRatio: 0.20,
        message: 'The relay lanes ignite. More salvage ships drift into range, easy fuel for anyone brave enough to chase them while the sector watches.',
        droneTargetCount: 0,
        rogueShipTargetCount: 60,
        shardTargetCount: 0,
        maxVirus: 10,
        stormEverySeconds: 0,
        stormAmount: 0
    },
    {
        id: 'dark-matter-breach',
        chapter: 3,
        name: 'Dark Matter Breach',
        startRatio: 0.45,
        message: 'Dark matter leaks through the grid. Purple shards are live, sabotage systems are awake, and the largest cores have become very expensive targets.',
        droneTargetCount: 0,
        rogueShipTargetCount: 70,
        shardTargetCount: 55,
        maxVirus: 16,
        stormEverySeconds: 0,
        stormAmount: 0
    },
    {
        id: 'singularity-collapse',
        chapter: 4,
        name: 'Singularity Collapse',
        startRatio: 0.75,
        message: 'The beacon window tears open. Drifter traffic swarms the collapse zone, anomalies spread, and every coordinate thief has one last chance to become legend.',
        droneTargetCount: 0,
        rogueShipTargetCount: 90,
        shardTargetCount: 70,
        maxVirus: 30,
        stormEverySeconds: 18,
        stormAmount: 70
    }
];

const BEACON_KEYS = ['xA', 'xB', 'yA', 'yB'];
const BEACON_LABELS = {
    xA: 'X-Alpha',
    xB: 'X-Beta',
    yA: 'Y-Alpha',
    yB: 'Y-Beta'
};

let beacon = null;
let beaconFragments = null;
let beaconWinner = null;

const randomBeaconCoordinate = (max) => Math.max(700, Math.min(max - 700, Math.floor(700 + Math.random() * (max - 1400))));

const splitCoordinate = (value) => {
    const padded = String(Math.round(value)).padStart(4, '0');
    return [padded.slice(0, 2), padded.slice(2)];
};

const resetBeaconIntel = () => {
    const x = randomBeaconCoordinate(config.gameWidth);
    const y = randomBeaconCoordinate(config.gameHeight);
    const xParts = splitCoordinate(x);
    const yParts = splitCoordinate(y);
    beacon = { x, y, radius: config.beaconCaptureRadius };
    beaconFragments = {
        xA: { key: 'xA', label: BEACON_LABELS.xA, axis: 'X', part: 'Alpha', value: xParts[0] },
        xB: { key: 'xB', label: BEACON_LABELS.xB, axis: 'X', part: 'Beta', value: xParts[1] },
        yA: { key: 'yA', label: BEACON_LABELS.yA, axis: 'Y', part: 'Alpha', value: yParts[0] },
        yB: { key: 'yB', label: BEACON_LABELS.yB, axis: 'Y', part: 'Beta', value: yParts[1] }
    };
    beaconWinner = null;
};

resetBeaconIntel();

const assignOneBeaconFragment = (player) => {
    if (!player) return null;
    player.beaconFragments = {};
    player.beaconLocked = false;
    const key = BEACON_KEYS[Math.floor(Math.random() * BEACON_KEYS.length)];
    player.beaconFragments[key] = true;
    updateBeaconLock(player);
    return beaconFragments[key];
};

const updateBeaconLock = (player) => {
    if (!player) return false;
    player.beaconLocked = BEACON_KEYS.every(key => player.beaconFragments && player.beaconFragments[key]);
    return player.beaconLocked;
};

const transferBeaconFragments = (eater, victim) => {
    if (!eater || !victim) return { gained: 0, gainedLabels: [] };
    eater.beaconFragments = eater.beaconFragments || {};
    victim.beaconFragments = victim.beaconFragments || {};
    let gained = 0;
    let gainedLabels = [];
    for (const key of BEACON_KEYS) {
        if (victim.beaconFragments[key] && !eater.beaconFragments[key]) {
            eater.beaconFragments[key] = true;
            gained++;
            gainedLabels.push(BEACON_LABELS[key]);
        }
    }
    updateBeaconLock(eater);
    return { gained, gainedLabels };
};

const formatKnownCoordinate = (fragments, a, b) => {
    const first = fragments && fragments[a] ? beaconFragments[a].value : '??';
    const second = fragments && fragments[b] ? beaconFragments[b].value : '??';
    return first + second;
};

const isBeaconActivationOpen = () => {
    const phase = getPhaseStatus();
    const unlockRatio = typeof config.beaconActivationStartRatio === 'number' ? config.beaconActivationStartRatio : 0.75;
    return phase.started && phase.progress >= unlockRatio;
};

const buildBeaconIntel = (player) => {
    const fragments = player && player.beaconFragments ? player.beaconFragments : {};
    const known = BEACON_KEYS.filter(key => fragments[key]).map(key => beaconFragments[key]);
    const hasLock = BEACON_KEYS.every(key => fragments[key]);
    const activationOpen = isBeaconActivationOpen();
    return {
        known,
        knownCount: known.length,
        requiredCount: BEACON_KEYS.length,
        x: formatKnownCoordinate(fragments, 'xA', 'xB'),
        y: formatKnownCoordinate(fragments, 'yA', 'yB'),
        hasLock,
        activationOpen,
        beacon: hasLock ? beacon : null,
        captureRadius: config.beaconCaptureRadius
    };
};

const checkBeaconActivation = (player) => {
    if (!player || matchEnded || !updateBeaconLock(player)) return;
    if (!isBeaconActivationOpen()) return;
    const distance = Math.hypot(player.x - beacon.x, player.y - beacon.y);
    if (distance <= config.beaconCaptureRadius) {
        matchEnded = true;
        beaconWinner = {
            id: player.id,
            name: player.name,
            mass: Math.round(player.massTotal),
            score: Math.round(player.score || player.massTotal),
            beacon: { x: beacon.x, y: beacon.y }
        };
        finalWinner = beaconWinner;
        io.emit('serverMSG', '{BEACON} ' + player.name + ' reconstructed and activated the final beacon during the collapse window. Sector sealed.');
    }
};


const getPhaseStatus = () => {
    const durationMs = activeMatchDurationSeconds * 1000;
    if (!matchStartTime) {
        const firstPhase = PHASES[0];
        return {
            id: firstPhase.id,
            chapter: firstPhase.chapter,
            name: firstPhase.name,
            message: firstPhase.message,
            started: false,
            progress: 0,
            sabotageUnlocked: false
        };
    }

    const elapsedMs = Math.max(0, Math.min(durationMs, Date.now() - matchStartTime));
    const progress = durationMs > 0 ? elapsedMs / durationMs : 1;
    let phase = PHASES[0];
    let nextPhase = null;

    for (let i = 0; i < PHASES.length; i++) {
        if (progress >= PHASES[i].startRatio) {
            phase = PHASES[i];
            nextPhase = PHASES[i + 1] || null;
        }
    }

    return {
        id: phase.id,
        chapter: phase.chapter,
        name: phase.name,
        message: phase.message,
        started: true,
        progress,
        elapsedMs,
        nextPhaseInMs: nextPhase ? Math.max(0, Math.round((nextPhase.startRatio * durationMs) - elapsedMs)) : 0,
        sabotageUnlocked: progress >= 0.45
    };
};

const getPhaseConfig = () => {
    const status = getPhaseStatus();
    return PHASES.find(phase => phase.id === status.id) || PHASES[0];
};

const addLocalPhaseBurst = (phaseId) => {
    for (const player of map.players.data) {
        if (!player || !player.cells || player.cells.length === 0) continue;
        if (phaseId === 'drone-awakening') {
            map.food.addRogueShipsNear(player.x, player.y, 3, config.gameWidth, config.gameHeight, config.rogueShipMassGain);
            map.food.addStorm(player.x, player.y, 24, config.gameWidth, config.gameHeight);
        }
        if (phaseId === 'dark-matter-breach') {
            map.food.addShardsNear(player.x, player.y, 8, config.gameWidth, config.gameHeight);
            map.food.addRogueShipsNear(player.x, player.y, 3, config.gameWidth, config.gameHeight, config.rogueShipMassGain);
            map.food.addStorm(player.x, player.y, 38, config.gameWidth, config.gameHeight);
        }
        if (phaseId === 'singularity-collapse') {
            map.food.addShardsNear(player.x, player.y, 6, config.gameWidth, config.gameHeight);
            map.food.addStorm(player.x, player.y, 65, config.gameWidth, config.gameHeight);
            map.viruses.addNear(player.x, player.y, 2, config.gameWidth, config.gameHeight);
        }
    }
};

const announcePhaseIfNeeded = () => {
    if (!matchStartTime || matchEnded) return;
    const phase = getPhaseStatus();
    if (phase.id !== currentPhaseId) {
        currentPhaseId = phase.id;
        io.emit('serverMSG', '{PHASE ' + phase.chapter + '} ' + phase.name + ' - ' + phase.message);
        addLocalPhaseBurst(phase.id);
        io.emit('phaseEffect', { id: phase.id, name: phase.name, chapter: phase.chapter, at: Date.now() });
        if (phase.id === 'dark-matter-breach') {
            map.food.addShards(35);
            io.emit('serverMSG', '{SABOTAGE} E = Dark Matter Pulse. It costs 3 shards and forces nearby rival ships to leak mass into stardust.');
        }
        if (phase.id === 'singularity-collapse') {
            map.food.addStorm(config.gameWidth / 2, config.gameHeight / 2, 120, config.gameWidth, config.gameHeight);
            io.emit('serverMSG', '{BEACON} Phase 4 is live. Coordinate holders can now activate the beacon. Everyone else should hunt them.');
        }
        io.emit('phaseChanged', phase);
    }
};

const getTopPlayerSnapshot = () => {
    const players = map.players.data.slice().sort((a, b) => (b.score || b.massTotal) - (a.score || a.massTotal));
    if (players.length === 0) return null;
    const winner = players[0];
    return {
        id: winner.id,
        name: winner.name,
        mass: Math.round(winner.massTotal),
        score: Math.round(winner.score || winner.massTotal)
    };
};

const getMatchStatus = () => {
    const durationMs = activeMatchDurationSeconds * 1000;
    const now = Date.now();
    if (!matchStartTime) {
        return { started: false, ended: false, timeRemaining: durationMs, durationMs, winner: finalWinner, phase: getPhaseStatus(), sabotageUnlocked: false, lobbyCount: map.players.data.length, mode: activeMatchMode };
    }

    const timeRemaining = Math.max(0, durationMs - (now - matchStartTime));
    if (!matchEnded && timeRemaining <= 0) {
        matchEnded = true;
        finalWinner = getTopPlayerSnapshot();
        io.emit('serverMSG', finalWinner ? ('{EVENT} Match ended. Winner: ' + finalWinner.name) : '{EVENT} Match ended.');
    }
    return { started: true, ended: matchEnded, timeRemaining, durationMs, winner: finalWinner, phase: getPhaseStatus(), sabotageUnlocked: getPhaseStatus().sabotageUnlocked, lobbyCount: map.players.data.length, mode: activeMatchMode };
};


const emitLobbyState = () => {
    io.emit('lobbyState', {
        started: !!matchStartTime,
        ended: matchEnded,
        players: map.players.data.map(player => ({ id: player.id, name: player.name || 'Unknown Pilot' })),
        count: map.players.data.length,
        maxPlayers: null,
        mode: activeMatchMode
    });
};

const resetPlayersForNewMatch = () => {
    for (const player of map.players.data) {
        const safeName = player.name;
        const safeAdmin = player.admin;
        const safeScreenWidth = player.screenWidth;
        const safeScreenHeight = player.screenHeight;
        player.score = 0;
        player.darkMatter = 0;
        player.sabotageCooldownUntil = 0;
        player.warpCooldownUntil = 0;
        player.warpBoostUntil = 0;
        player.beaconFragments = {};
        player.beaconLocked = false;
        player.init(generateSpawnpoint(), config.defaultPlayerMass);
        player.name = safeName;
        player.admin = safeAdmin;
        player.screenWidth = safeScreenWidth;
        player.screenHeight = safeScreenHeight;
        player.setLastHeartbeat();
    }
};

const startMatchManually = (socket, options) => {
    const adminCode = typeof options === 'string' ? options : (options && options.code);
    const socketAskedForTV = !!(socket && socket.handshake && socket.handshake.query && String(socket.handshake.query.tv) === '1');
    const optionMode = options && options.mode ? String(options.mode).toLowerCase() : '';
    const optionTV = options && options.tv ? String(options.tv) === '1' : false;
    const requestedTV = !!(options && (options.testMode === true || options.testMode === 'true')) || optionMode === 'tv' || optionTV || socketAskedForTV;
    const tvCode = options && options.tvCode;
    if (!config.adminPass) {
        socket.emit('serverMSG', '{ADMIN} Admin code is not configured on the server. Set ADMIN_CODE before deploying.');
        return;
    }
    if (adminCode !== config.adminPass) {
        socket.emit('serverMSG', '{ADMIN} Wrong admin code. Nice try, galaxy intern.');
        return;
    }
    if (matchStartTime && !matchEnded) {
        io.emit('serverMSG', '{ADMIN} Coordinator restarted the match. Previous run cleared.');
    }

    if (requestedTV) {
        // TV mode is selected from the client-side password gate. The socket query is also checked
        // so the server cannot accidentally start a 35-minute final run from a TV-tab.
        if (!config.tvPass || tvCode !== config.tvPass) {
            socket.emit('serverMSG', '{ADMIN} TV mode password rejected. Main final mode remains armed.');
            return;
        }
        activeMatchDurationSeconds = config.testMatchDurationSeconds || (5 * 60);
        activeRespawnDelaySeconds = config.testRespawnDelaySeconds || 20;
        activeMatchMode = 'tv';
    } else {
        activeMatchDurationSeconds = config.matchDurationSeconds;
        activeRespawnDelaySeconds = config.respawnDelaySeconds;
        activeMatchMode = 'final';
    }

    resetPlayersForNewMatch();
    matchStartTime = Date.now();
    matchEnded = false;
    finalWinner = null;
    currentPhaseId = null;
    nextStormAt = 0;
    resetBeaconIntel();

    for (const player of map.players.data) {
        const fragment = assignOneBeaconFragment(player);
        if (fragment && sockets[player.id]) {
            sockets[player.id].emit('serverMSG', '{BEACON} YOUR STARTING COORDINATE FRAGMENT: ' + fragment.label + ' = ' + fragment.value + '. Track your current X/Y in the HUD, eat rivals to steal fragments, then navigate to the beacon.');
        }
    }

    io.emit('serverMSG', activeMatchMode === 'tv' ? '{EVENT} Admin started TV TEST MODE: 5-minute Starfall run.' : '{EVENT} Admin started FINAL MODE: 35-minute Starfall run. Survive, consume, steal coordinates, and activate the final beacon in Phase 4.');
    io.emit('serverMSG', '{BEACON} Each pilot has one half-fragment. Full lock needs X-Alpha, X-Beta, Y-Alpha and Y-Beta. If nobody activates the beacon, highest score wins.');
    emitLobbyState();
    io.emit('phaseChanged', getPhaseStatus());
};

const Vector = SAT.Vector;

app.use(express.static(__dirname + '/../client'));

io.on('connection', function (socket) {
    let type = socket.handshake.query.type;
    console.log('User has connected: ', type);
    switch (type) {
        case 'player':
            addPlayer(socket);
            break;
        case 'spectator':
            addSpectator(socket);
            break;
        default:
            console.log('Unknown user type, not doing anything.');
    }
});

function generateSpawnpoint() {
    let radius = util.massToRadius(config.defaultPlayerMass);
    return getPosition(config.newPlayerInitialPosition === 'farthest', radius, map.players.data)
}


const addPlayer = (socket) => {
    var currentPlayer = new mapUtils.playerUtils.Player(socket.id);

    socket.on('gotit', function (clientPlayerData) {
        console.log('[INFO] Player ' + clientPlayerData.name + ' connecting!');
        currentPlayer.init(generateSpawnpoint(), config.defaultPlayerMass);

        if (map.players.findIndexByID(socket.id) > -1) {
            console.log('[INFO] Player ID is already connected, kicking.');
            socket.disconnect();
        } else if (!util.validNick(clientPlayerData.name)) {
            socket.emit('kick', 'Invalid username.');
            socket.disconnect();
        } else {
            console.log('[INFO] Player ' + clientPlayerData.name + ' connected!');
            sockets[socket.id] = socket;

            const sanitizedName = clientPlayerData.name.replace(/(<([^>]+)>)/ig, '');
            clientPlayerData.name = sanitizedName;

            currentPlayer.clientProvidedData(clientPlayerData);
            map.players.pushNew(currentPlayer);
            if (matchStartTime && !matchEnded) {
                const startingFragment = assignOneBeaconFragment(currentPlayer);
                if (startingFragment) {
                    socket.emit('serverMSG', '{BEACON} LATE-JOIN FRAGMENT: ' + startingFragment.label + ' = ' + startingFragment.value + '. Eat rival players to steal more fragments.');
                }
            } else {
                socket.emit('serverMSG', '{LOBBY} You are in the staging bay. Wait for the admin to start the match.');
            }
            io.emit('playerJoin', { name: currentPlayer.name });
            emitLobbyState();
            console.log('Total players: ' + map.players.data.length);
        }

    });

    socket.on('pingcheck', () => {
        socket.emit('pongcheck');
    });

    socket.on('windowResized', (data) => {
        currentPlayer.screenWidth = data.screenWidth;
        currentPlayer.screenHeight = data.screenHeight;
    });

    socket.on('respawn', () => {
        if (matchEnded) {
            socket.emit('eventStatus', getMatchStatus());
            return;
        }
        map.players.removePlayerByID(currentPlayer.id);
        socket.emit('welcome', currentPlayer, {
            width: config.gameWidth,
            height: config.gameHeight
        });
        console.log('[INFO] User ' + currentPlayer.name + ' has respawned');
    });

    socket.on('disconnect', () => {
        map.players.removePlayerByID(currentPlayer.id);
        console.log('[INFO] User ' + currentPlayer.name + ' has disconnected');
        socket.broadcast.emit('playerDisconnect', { name: currentPlayer.name });
        emitLobbyState();
    });

    socket.on('playerChat', (data) => {
        var _sender = data.sender.replace(/(<([^>]+)>)/ig, '');
        var _message = data.message.replace(/(<([^>]+)>)/ig, '');

        if (config.logChat === 1) {
            console.log('[CHAT] [' + (new Date()).getHours() + ':' + (new Date()).getMinutes() + '] ' + _sender + ': ' + _message);
        }

        socket.broadcast.emit('serverSendPlayerChat', {
            sender: currentPlayer.name,
            message: _message.substring(0, 140)
        });

        chatRepository.logChatMessage(_sender, _message, currentPlayer.ipAddress)
            .catch((err) => console.error("Error when attempting to log chat message", err));
    });

    socket.on('pass', async (data) => {
        const password = data[0];
        if (config.adminPass && password === config.adminPass) {
            console.log('[ADMIN] ' + currentPlayer.name + ' just logged in as an admin.');
            socket.emit('serverMSG', 'Welcome back ' + currentPlayer.name);
            socket.broadcast.emit('serverMSG', currentPlayer.name + ' just logged in as an admin.');
            currentPlayer.admin = true;
        } else {
            console.log('[ADMIN] ' + currentPlayer.name + ' attempted to log in with the incorrect password: ' + password);

            socket.emit('serverMSG', 'Password incorrect, attempt logged.');

            loggingRepositry.logFailedLoginAttempt(currentPlayer.name, currentPlayer.ipAddress)
                .catch((err) => console.error("Error when attempting to log failed login attempt", err));
        }
    });

    socket.on('adminStartGame', (data) => {
        const code = data && data.code ? String(data.code) : '';
        startMatchManually(socket, data || { code });
    });

    socket.on('kick', (data) => {
        if (!currentPlayer.admin) {
            socket.emit('serverMSG', 'You are not permitted to use this command.');
            return;
        }

        var reason = '';
        var worked = false;
        for (let playerIndex in map.players.data) {
            let player = map.players.data[playerIndex];
            if (player.name === data[0] && !player.admin && !worked) {
                if (data.length > 1) {
                    for (var f = 1; f < data.length; f++) {
                        if (f === data.length) {
                            reason = reason + data[f];
                        }
                        else {
                            reason = reason + data[f] + ' ';
                        }
                    }
                }
                if (reason !== '') {
                    console.log('[ADMIN] User ' + player.name + ' kicked successfully by ' + currentPlayer.name + ' for reason ' + reason);
                }
                else {
                    console.log('[ADMIN] User ' + player.name + ' kicked successfully by ' + currentPlayer.name);
                }
                socket.emit('serverMSG', 'User ' + player.name + ' was kicked by ' + currentPlayer.name);
                sockets[player.id].emit('kick', reason);
                sockets[player.id].disconnect();
                map.players.removePlayerByIndex(playerIndex);
                worked = true;
            }
        }
        if (!worked) {
            socket.emit('serverMSG', 'Could not locate user or user is an admin.');
        }
    });

    // Heartbeat function, update everytime.
    socket.on('0', (target) => {
        currentPlayer.lastHeartbeat = new Date().getTime();
        if (target.x !== currentPlayer.x || target.y !== currentPlayer.y) {
            currentPlayer.target = target;
        }
    });

    socket.on('1', function () {
        // Fire food.
        const minCellMass = config.defaultPlayerMass + config.fireFood;
        for (let i = 0; i < currentPlayer.cells.length; i++) {
            if (currentPlayer.cells[i].mass >= minCellMass) {
                currentPlayer.changeCellMass(i, -config.fireFood);
                map.massFood.addNew(currentPlayer, i, config.fireFood);
            }
        }
    });

    socket.on('2', () => {
        if (matchEnded) return;
        currentPlayer.userSplit(config.limitSplit, config.defaultPlayerMass);
    });

    socket.on('3', () => {
        triggerDarkMatterPulse(currentPlayer, socket);
    });

    socket.on('4', () => {
        triggerWarpDrive(currentPlayer, socket);
    });
}


const triggerWarpDrive = (currentPlayer, socket) => {
    if (matchEnded) return;
    if (!currentPlayer || map.players.findIndexByID(currentPlayer.id) === -1) return;
    const now = Date.now();
    if (now < (currentPlayer.warpCooldownUntil || 0)) {
        const remaining = Math.ceil((currentPlayer.warpCooldownUntil - now) / 1000);
        socket.emit('pickupNotice', { type: 'action', title: 'Warp Drive cooling', text: remaining + 's remaining', detail: 'Available once every 3 minutes.' });
        return;
    }
    currentPlayer.warpBoostUntil = now + (config.warpDurationMs || 6500);
    currentPlayer.warpCooldownUntil = now + (config.warpCooldownMs || 180000);
    socket.emit('pickupNotice', { type: 'action', title: 'Warp Drive engaged', text: 'Super speed online', detail: 'Use it to cross long coordinate gaps fast.' });
    socket.emit('serverMSG', '{WARP} Warp Drive engaged. Super speed active for a few seconds.');
};

const triggerDarkMatterPulse = (currentPlayer, socket) => {
    if (matchEnded) return;
    if (!getPhaseStatus().sabotageUnlocked) {
        socket.emit('serverMSG', '{SABOTAGE} E fires Dark Matter Pulse, but it unlocks only in Phase 3: Dark Matter Breach.');
        return;
    }
    if (!currentPlayer || map.players.findIndexByID(currentPlayer.id) === -1) return;
    if ((currentPlayer.darkMatter || 0) < config.darkMatterCost) {
        socket.emit('serverMSG', '{SABOTAGE} E = Dark Matter Pulse. You need 3 purple Dark Matter Shards first. It drains nearby enemy mass.');
        return;
    }
    if (Date.now() < (currentPlayer.sabotageCooldownUntil || 0)) {
        const remaining = Math.ceil((currentPlayer.sabotageCooldownUntil - Date.now()) / 1000);
        socket.emit('serverMSG', '{SABOTAGE} Pulse is cooling down: ' + remaining + 's.');
        return;
    }

    currentPlayer.darkMatter -= config.darkMatterCost;
    currentPlayer.sabotageCooldownUntil = Date.now() + config.sabotageCooldownMs;

    let affected = 0;
    for (const otherPlayer of map.players.data) {
        if (otherPlayer.id === currentPlayer.id) continue;
        const distance = Math.hypot(otherPlayer.x - currentPlayer.x, otherPlayer.y - currentPlayer.y);
        if (distance > config.sabotageRadius) continue;

        for (let i = 0; i < otherPlayer.cells.length; i++) {
            const cell = otherPlayer.cells[i];
            const leak = Math.min(cell.mass * 0.12, 35);
            if (cell.mass - leak > config.defaultPlayerMass) {
                otherPlayer.changeCellMass(i, -leak);
                map.food.addStorm(cell.x, cell.y, Math.max(3, Math.floor(leak / 4)), config.gameWidth, config.gameHeight);
                affected++;
            }
        }
    }

    map.food.addStorm(currentPlayer.x, currentPlayer.y, 35, config.gameWidth, config.gameHeight);
    io.emit('sabotagePulse', {
        x: currentPlayer.x,
        y: currentPlayer.y,
        radius: config.sabotageRadius,
        affected,
        source: currentPlayer.name,
        at: Date.now()
    });
    io.emit('serverMSG', '{SABOTAGE} ' + currentPlayer.name + ' fired Dark Matter Pulse. ' + affected + ' nearby rival core(s) leaked mass into stardust.');
};

const addSpectator = (socket) => {
    socket.on('gotit', function () {
        sockets[socket.id] = socket;
        spectators.push(socket.id);
        io.emit('playerJoin', { name: '' });
    });

    socket.emit("welcome", {}, {
        width: config.gameWidth,
        height: config.gameHeight
    });
}

const tickPlayer = (currentPlayer) => {
    if (currentPlayer.lastHeartbeat < new Date().getTime() - config.maxHeartbeatInterval) {
        sockets[currentPlayer.id].emit('kick', 'removed due to inactivity');
        sockets[currentPlayer.id].disconnect();
    }

    const warpActive = Date.now() < (currentPlayer.warpBoostUntil || 0);
    currentPlayer.move(config.slowBase, config.gameWidth, config.gameHeight, INIT_MASS_LOG, warpActive ? (config.warpSpeedMultiplier || 3) : 1);

    const isEntityInsideCircle = (point, circle) => {
        return SAT.pointInCircle(new Vector(point.x, point.y), circle);
    };

    const canEatMass = (cell, cellCircle, cellIndex, mass) => {
        if (isEntityInsideCircle(mass, cellCircle)) {
            if (mass.id === currentPlayer.id && mass.speed > 0 && cellIndex === mass.num)
                return false;
            if (cell.mass > mass.mass * 1.1)
                return true;
        }

        return false;
    };

    const canEatVirus = (cell, cellCircle, virus) => {
        return virus.mass < cell.mass && isEntityInsideCircle(virus, cellCircle)
    }

    const cellsToSplit = [];
    for (let cellIndex = 0; cellIndex < currentPlayer.cells.length; cellIndex++) {
        const currentCell = currentPlayer.cells[cellIndex];

        const cellCircle = currentCell.toCircle();

        const eatenFoodIndexes = util.getIndexes(map.food.data, food => isEntityInsideCircle(food, cellCircle));
        const eatenMassIndexes = util.getIndexes(map.massFood.data, mass => canEatMass(currentCell, cellCircle, cellIndex, mass));
        const eatenVirusIndexes = util.getIndexes(map.viruses.data, virus => canEatVirus(currentCell, cellCircle, virus));

        if (eatenVirusIndexes.length > 0) {
            cellsToSplit.push(cellIndex);
            map.viruses.delete(eatenVirusIndexes)
        }

        let massGained = eatenMassIndexes.reduce((acc, index) => acc + map.massFood.data[index].mass, 0);
        let pickupNotice = null;

        for (const foodIndex of eatenFoodIndexes) {
            const item = map.food.data[foodIndex];
            if (!item) continue;
            if (item.kind === 'shard') {
                currentPlayer.darkMatter = Math.min(config.maxDarkMatter || config.darkMatterCost || 3, (currentPlayer.darkMatter || 0) + 1);
                currentPlayer.score = (currentPlayer.score || 0) + 10;
                pickupNotice = {
                    type: 'darkMatter',
                    title: 'Dark Matter Shard',
                    text: 'Shard acquired: ' + currentPlayer.darkMatter + '/' + (config.darkMatterCost || 3),
                    detail: currentPlayer.darkMatter >= (config.darkMatterCost || 3) ? 'Pulse ready: press E.' : 'Collect ' + ((config.darkMatterCost || 3) - currentPlayer.darkMatter) + ' more.'
                };
            } else if (item.kind === 'drone') {
                const gain = item.massGain || config.droneMassGain || config.foodMass;
                massGained += gain;
                currentPlayer.score = (currentPlayer.score || 0) + Math.round(gain * 2);
                pickupNotice = { type: 'drone', title: 'Drifter absorbed', text: '+' + gain + ' energy', detail: '+ ' + Math.round(gain * 2) + ' score. Safe recovery target.' };
            } else if (item.kind === 'rogueShip') {
                const gain = item.massGain || config.rogueShipMassGain || config.droneMassGain || config.foodMass;
                massGained += gain;
                currentPlayer.score = (currentPlayer.score || 0) + Math.round(gain * 3);
                if (getPhaseStatus().sabotageUnlocked && Math.random() < 0.34) {
                    currentPlayer.darkMatter = Math.min(config.maxDarkMatter || config.darkMatterCost || 3, (currentPlayer.darkMatter || 0) + 1);
                    pickupNotice = { type: 'rogueShip', title: 'Drifter ship salvaged', text: '+' + gain + ' energy • shard drop', detail: 'Dark Matter: ' + currentPlayer.darkMatter + '/' + (config.darkMatterCost || 3) };
                } else {
                    pickupNotice = { type: 'rogueShip', title: 'Drifter ship salvaged', text: '+' + gain + ' energy', detail: '+ ' + Math.round(gain * 3) + ' score. Smaller salvage traffic, safe to hunt.' };
                }
            } else {
                const gain = item.massGain || config.foodMass;
                massGained += gain;
                currentPlayer.score = (currentPlayer.score || 0) + gain;
            }
        }

        if (pickupNotice && sockets[currentPlayer.id]) {
            sockets[currentPlayer.id].emit('pickupNotice', pickupNotice);
        }

        map.food.delete(eatenFoodIndexes);
        map.massFood.remove(eatenMassIndexes);
        if (massGained > 0) {
            currentPlayer.changeCellMass(cellIndex, massGained);
        }
    }
    currentPlayer.virusSplit(cellsToSplit, config.limitSplit, config.defaultPlayerMass);
    checkBeaconActivation(currentPlayer);
};

const tickGame = () => {
    getMatchStatus();
    announcePhaseIfNeeded();
    if (!matchStartTime || matchEnded) return;
    map.food.moveNeutralShips(config.gameWidth, config.gameHeight);
    map.players.data.forEach(tickPlayer);
    map.massFood.move(config.gameWidth, config.gameHeight);

    map.players.handleCollisions(function (gotEaten, eater) {
        const cellGotEaten = map.players.getCell(gotEaten.playerIndex, gotEaten.cellIndex);
        const eaterPlayer = map.players.data[eater.playerIndex];
        const victimPlayer = map.players.data[gotEaten.playerIndex];

        if (!cellGotEaten || !eaterPlayer || !victimPlayer) return;

        eaterPlayer.changeCellMass(eater.cellIndex, cellGotEaten.mass);
        eaterPlayer.score = (eaterPlayer.score || 0) + Math.round(cellGotEaten.mass * 2);

        const playerDied = map.players.removeCell(gotEaten.playerIndex, gotEaten.cellIndex);
        if (playerDied) {
            const transfer = transferBeaconFragments(eaterPlayer, victimPlayer);
            if (transfer.gained > 0) {
                eaterPlayer.score = (eaterPlayer.score || 0) + transfer.gained * 75;
                sockets[eaterPlayer.id].emit('serverMSG', '{BEACON} You stole ' + transfer.gained + ' beacon fragment(s): ' + transfer.gainedLabels.join(', ') + '.');
                if (updateBeaconLock(eaterPlayer)) {
                    sockets[eaterPlayer.id].emit('serverMSG', '{BEACON} FULL COORDINATE LOCK: X=' + beacon.x + ', Y=' + beacon.y + '. The beacon marker is now visible. Activation is allowed only in Phase 4.');
                    io.emit('serverMSG', '{BEACON} ' + eaterPlayer.name + ' reconstructed the beacon coordinate. The beacon can only be activated in Phase 4, so hunt them before the collapse window.');
                }
            }
            io.emit('playerDied', {
                playerEatenName: victimPlayer.name,
                playerWhoAtePlayerName: eaterPlayer.name,
                gainedFragments: transfer.gained
            });
            sockets[victimPlayer.id].emit('RIP', { respawnDelayMs: activeRespawnDelaySeconds * 1000 });
            map.players.removePlayerByIndex(gotEaten.playerIndex);
            checkBeaconActivation(eaterPlayer);
        }
    });

};

const calculateLeaderboard = () => {
    const topPlayers = map.players.getTopPlayers();

    if (leaderboard.length !== topPlayers.length) {
        leaderboard = topPlayers;
        leaderboardChanged = true;
    } else {
        for (let i = 0; i < leaderboard.length; i++) {
            if (
                leaderboard[i].id !== topPlayers[i].id ||
                leaderboard[i].score !== topPlayers[i].score ||
                leaderboard[i].mass !== topPlayers[i].mass
            ) {
                leaderboard = topPlayers;
                leaderboardChanged = true;
                break;
            }
        }
    }
}

const ensureLocalDriftersForPlayers = () => {
    const minLocal = Math.max(4, config.localDriftersPerPlayer || 6);
    const radius = config.localDrifterRadius || 1050;
    if (!map.players.data.length) return;
    for (const player of map.players.data) {
        if (!player || !player.cells || !player.cells.length) continue;
        const nearby = map.food.data.filter(item => item.kind === 'rogueShip' && Math.hypot(item.x - player.x, item.y - player.y) <= radius).length;
        if (nearby < minLocal) {
            map.food.addRogueShipsNear(player.x, player.y, minLocal - nearby, config.gameWidth, config.gameHeight, config.rogueShipMassGain);
        }
    }
};

const gameloop = () => {
    getMatchStatus();
    announcePhaseIfNeeded();
    if (!matchStartTime || matchEnded) return;

    const phaseConfig = getPhaseConfig();

    ensureLocalDriftersForPlayers();

    if (map.players.data.length > 0) {
        calculateLeaderboard();
        map.players.shrinkCells(config.massLossRate, config.defaultPlayerMass, config.minMassLoss);
    }

    map.balanceMass(config.foodMass, config.gameMass, config.maxFood, phaseConfig.maxVirus);

    const droneCount = map.food.data.filter(item => item.kind === 'drone').length;
    if (droneCount < phaseConfig.droneTargetCount) {
        map.food.addDrones(phaseConfig.droneTargetCount - droneCount, config.droneMassGain);
    }

    const rogueShipCount = map.food.data.filter(item => item.kind === 'rogueShip').length;
    if (rogueShipCount < (phaseConfig.rogueShipTargetCount || 0)) {
        map.food.addRogueShips((phaseConfig.rogueShipTargetCount || 0) - rogueShipCount, config.rogueShipMassGain);
    }

    const shardCount = map.food.data.filter(item => item.kind === 'shard').length;
    if (shardCount < phaseConfig.shardTargetCount) {
        map.food.addShards(phaseConfig.shardTargetCount - shardCount);
    }

    if (phaseConfig.stormEverySeconds > 0 && Date.now() >= nextStormAt) {
        const x = Math.random() * config.gameWidth;
        const y = Math.random() * config.gameHeight;
        map.food.addStorm(x, y, phaseConfig.stormAmount, config.gameWidth, config.gameHeight);
        io.emit('serverMSG', '{EVENT} Stardust storm detected in the ' + phaseConfig.name + ' phase.');
        nextStormAt = Date.now() + phaseConfig.stormEverySeconds * 1000;
    }
};

const sendUpdates = () => {
    spectators.forEach(updateSpectator);
    map.enumerateWhatPlayersSee(function (playerData, visiblePlayers, visibleFood, visibleMass, visibleViruses) {
        const livePlayer = map.players.data.find(player => player.id === playerData.id);
        playerData.beaconIntel = buildBeaconIntel(livePlayer);
        sockets[playerData.id].emit('serverTellPlayerMove', playerData, visiblePlayers, visibleFood, visibleMass, visibleViruses);
        sockets[playerData.id].emit('eventStatus', getMatchStatus());
        if (leaderboardChanged) {
            sendLeaderboard(sockets[playerData.id]);
        }
    });

    leaderboardChanged = false;
};

const sendLeaderboard = (socket) => {
    socket.emit('leaderboard', {
        players: map.players.data.length,
        leaderboard
    });
}
const updateSpectator = (socketID) => {
    let playerData = {
        x: config.gameWidth / 2,
        y: config.gameHeight / 2,
        cells: [],
        massTotal: 0,
        hue: 100,
        id: socketID,
        name: ''
    };
    sockets[socketID].emit('serverTellPlayerMove', playerData, map.players.data, map.food.data, map.massFood.data, map.viruses.data);
    sockets[socketID].emit('eventStatus', getMatchStatus());
    if (leaderboardChanged) {
        sendLeaderboard(sockets[socketID]);
    }
}

setInterval(tickGame, 1000 / 60);
setInterval(gameloop, 1000);
setInterval(sendUpdates, 1000 / config.networkUpdateFactor);

// Don't touch, IP configurations.
var ipaddress = process.env.OPENSHIFT_NODEJS_IP || process.env.IP || config.host;
var serverport = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || config.port;
http.listen(serverport, ipaddress, () => console.log('[DEBUG] Listening on ' + ipaddress + ':' + serverport));
