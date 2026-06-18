var io = require('socket.io-client');
var render = require('./render');
var ChatClient = require('./chat-client');
var Canvas = require('./canvas');
var global = require('./global');

var playerNameInput = document.getElementById('playerNameInput');
var socket;

window.localStorage.removeItem('sf_tv_mode'); // old builds used this; this build never starts in TV mode by URL alone.
(function cleanOldTVUrl() {
    if (/(?:\?|&)tv=1(?:&|$)/.test(window.location.search)) {
        window.sessionStorage.removeItem('sf_tv_enabled');
        window.sessionStorage.removeItem('sf_tv_code');
        if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', window.location.pathname);
        }
    }
})();
function isTVMode() {
    return window.sessionStorage.getItem('sf_tv_enabled') === '1' && !!window.sessionStorage.getItem('sf_tv_code');
}
function setTVMode(enabled, code) {
    if (enabled) {
        if (code) window.sessionStorage.setItem('sf_tv_code', code);
        window.sessionStorage.setItem('sf_tv_enabled', '1');
    } else {
        window.sessionStorage.removeItem('sf_tv_enabled');
        window.sessionStorage.removeItem('sf_tv_code');
    }
    updateTVModeButton();
}
function getTVModePayload() {
    var btn = document.getElementById('tvModeButton');
    var buttonSaysOn = btn && String(btn.innerHTML || '').toUpperCase().indexOf('TV ON') !== -1;
    var bodyArmed = document.body.classList.contains('tv-armed');
    var active = isTVMode() || buttonSaysOn || bodyArmed;

    return {
        testMode: active,
        mode: active ? 'tv' : 'final',
        tv: active ? '1' : '0',
        tvCode: active ? (window.sessionStorage.getItem('sf_tv_code') || '') : ''
    };
}

function updateTVModeButton() {
    var btn = document.getElementById('tvModeButton');
    if (!btn) return;

    var enabled = isTVMode();
    btn.innerHTML = enabled ? 'TV ON' : 'TV';
    btn.className = enabled ? 'tv-mode-button tv-active' : 'tv-mode-button';
    btn.title = enabled ? 'TV mode armed. Click to return to final mode.' : 'TV';

    if (enabled) {
        document.body.classList.add('tv-armed');
    } else {
        document.body.classList.remove('tv-armed');
    }
}

function setupTVModeButton() {
    var btn = document.getElementById('tvModeButton');
    if (!btn) return;
    updateTVModeButton();
    btn.onclick = function () {
        if (isTVMode()) {
            setTVMode(false);
            return;
        }
        var entered = window.prompt('Enter TV password');
        if (entered && entered.trim()) {
            setTVMode(true, entered.trim());
        }
    };
}


var debug = function (args) {
    if (console && console.log) {
        console.log(args);
    }
};

function setMovementPaused(paused) {
    global.movementPaused = paused;
    target.x = 0;
    target.y = 0;
    global.target = target;
    if (window.canvas) {
        window.canvas.target = target;
        window.canvas.directions = [];
        window.canvas.directionLock = false;
    }
    if (socket) socket.emit('0', target);
    var btn = document.getElementById('movementToggle');
    if (btn) btn.innerHTML = paused ? 'Start movement' : 'Stop movement';
}

function updateRestorePanelsButton() {
    var restore = document.getElementById('restorePanels');
    if (!restore) return;
    var anyHidden = ['status', 'eventHud', 'chatbox'].some(function (id) {
        var el = document.getElementById(id);
        return el && el.classList.contains('panel-minimized');
    });
    restore.className = anyHidden ? 'restore-panels' : 'restore-panels hidden';
}

function setupPanelControls() {
    document.querySelectorAll('.panel-close').forEach(function (button) {
        button.onclick = function () {
            var panel = document.getElementById(button.getAttribute('data-panel'));
            if (panel) panel.classList.add('panel-minimized');
            updateRestorePanelsButton();
        };
    });
    var restore = document.getElementById('restorePanels');
    if (restore) {
        restore.onclick = function () {
            ['status', 'eventHud', 'chatbox'].forEach(function (id) {
                var panel = document.getElementById(id);
                if (panel) panel.classList.remove('panel-minimized');
            });
            updateRestorePanelsButton();
        };
    }
}

function setupAdminCodeToggle() {
    var input = document.getElementById('adminCodeInput');
    var toggle = document.getElementById('adminCodeToggle');
    if (!input || !toggle) return;
    toggle.onclick = function () {
        var visible = input.type === 'text';
        input.type = visible ? 'password' : 'text';
        toggle.innerHTML = visible ? 'Show' : 'Hide';
        input.focus();
    };
}

function updateLobbyOverlay(state) {
    var overlay = document.getElementById('lobbyOverlay');
    if (!overlay) return;
    if (!state || state.started || state.ended) {
        overlay.className = 'lobby-overlay hidden';
        return;
    }
    overlay.className = 'lobby-overlay';
    var count = document.getElementById('lobbyPlayers');
    if (count) count.innerHTML = 'Pilots online: ' + (state.count || 0) + (state.maxPlayers ? '/' + state.maxPlayers : '');
    var list = document.getElementById('lobbyList');
    if (list) {
        var players = state.players || [];
        list.innerHTML = players.length ? players.map(function (player) {
            return '<span>' + player.name + '</span>';
        }).join('') : '<em>No pilots docked yet.</em>';
    }
}

function showPickupNotice(notice) {
    var feed = document.getElementById('pickupFeed');
    if (!feed || !notice) return;
    var item = document.createElement('div');
    item.className = 'pickup-toast pickup-' + (notice.type || 'generic');
    item.innerHTML = '<b>' + (notice.title || 'Update') + '</b><span>' + (notice.text || '') + '</span><small>' + (notice.detail || '') + '</small>';
    feed.appendChild(item);
    window.setTimeout(function () { item.classList.add('fade-out'); }, 2600);
    window.setTimeout(function () { if (item.parentNode) item.parentNode.removeChild(item); }, 3400);
}

function emitSplitAction() {
    if (!socket || !global.gameStart) return;
    var audio = document.getElementById('split_cell');
    if (audio) audio.play();
    socket.emit('2');
    showPickupNotice({ type: 'action', title: 'Energy Burst', text: 'Split command sent', detail: 'Works only when your mass is high enough.' });
}

function emitPulseAction() {
    if (!socket || !global.gameStart) return;
    socket.emit('3');
    showPickupNotice({ type: 'darkMatter', title: 'Dark Pulse', text: 'Pulse command sent', detail: 'Needs Phase 3 + 3/3 Dark Matter.' });
}

function emitWarpAction() {
    if (!socket || !global.gameStart) return;
    socket.emit('4');
}

function setupActionControls() {
    var splitButton = document.getElementById('splitActionButton');
    var pulseButton = document.getElementById('pulseActionButton');
    var warpButton = document.getElementById('warpActionButton');
    if (splitButton) splitButton.onclick = emitSplitAction;
    if (pulseButton) pulseButton.onclick = emitPulseAction;
    if (warpButton) warpButton.onclick = emitWarpAction;

    document.addEventListener('keydown', function (event) {
        var active = document.activeElement;
        var tag = active && active.tagName ? active.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea') return;
        if (event.repeat) return;
        var key = (event.key || '').toLowerCase();
        var code = event.which || event.keyCode;
        if (key === ' ' || code === global.KEY_SPLIT) {
            event.preventDefault();
            emitSplitAction();
        } else if (key === 'e' || code === 69 || code === global.KEY_SABOTAGE) {
            event.preventDefault();
            emitPulseAction();
        } else if (key === 'f' || code === 70) {
            event.preventDefault();
            emitWarpAction();
        }
    });
}

if (/Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent)) {
    global.mobile = true;
}


function hideStartMenuCompletely() {
    var wrapper = document.getElementById('startMenuWrapper');
    if (!wrapper) return;
    wrapper.classList.add('start-menu-hidden');
    wrapper.style.maxHeight = '0px';
    wrapper.style.opacity = '0';
    wrapper.style.pointerEvents = 'none';
    wrapper.style.display = 'none';
    if (playerNameInput) playerNameInput.blur();
}

function startGame(type) {
    global.playerName = playerNameInput.value.replace(/(<([^>]+)>)/ig, '').substring(0, 25);
    global.playerType = type;

    global.screen.width = window.innerWidth;
    global.screen.height = window.innerHeight;

    hideStartMenuCompletely();
    document.getElementById('gameAreaWrapper').style.opacity = 1;
    updateLobbyOverlay({ started: false, count: 1, maxPlayers: null, players: [{ name: global.playerName }] });
    if (!socket) {
        socket = io({ query: "type=" + type });
        setupSocket(socket);
    }
    if (!global.animLoopHandle)
        animloop();
    socket.emit('respawn');
    window.chat.socket = socket;
    window.chat.registerFunctions();
    window.canvas.socket = socket;
    global.socket = socket;
}

// Checks if the nick chosen contains valid alphanumeric characters (and underscores).
function validNick() {
    var regex = /^\w*$/;
    debug('Regex Test', regex.exec(playerNameInput.value));
    return regex.exec(playerNameInput.value) !== null;
}

window.onload = function () {

    var btn = document.getElementById('startButton'),
        btnS = document.getElementById('spectateButton'),
        nickErrorText = document.querySelector('#startMenu .input-error');

    if (btnS) {
        btnS.onclick = function () {
            startGame('spectator');
        };
    }

    btn.onclick = function () {

        // Checks if the nick is valid.
        if (validNick()) {
            nickErrorText.style.opacity = 0;
            startGame('player');
        } else {
            nickErrorText.style.opacity = 1;
        }
    };

    var settingsMenu = document.getElementById('settingsButton');
    var settings = document.getElementById('settings');

    settingsMenu.onclick = function () {
        if (settings.style.maxHeight == '300px') {
            settings.style.maxHeight = '0px';
        } else {
            settings.style.maxHeight = '300px';
        }
    };

    playerNameInput.addEventListener('keypress', function (e) {
        var key = e.which || e.keyCode;

        if (key === global.KEY_ENTER) {
            if (validNick()) {
                nickErrorText.style.opacity = 0;
                startGame('player');
            } else {
                nickErrorText.style.opacity = 1;
            }
        }
    });
};

// TODO: Break out into GameControls.

var playerConfig = {
    border: 6,
    textColor: '#FFFFFF',
    textBorder: '#000000',
    textBorderSize: 3,
    defaultSize: 30
};

var player = {
    id: -1,
    x: global.screen.width / 2,
    y: global.screen.height / 2,
    screenWidth: global.screen.width,
    screenHeight: global.screen.height,
    target: { x: global.screen.width / 2, y: global.screen.height / 2 }
};
global.player = player;

var foods = [];
var viruses = [];
var fireFood = [];
var users = [];
var leaderboard = [];
var eventStatus = null;
var latestLobbyState = null;
var lastPhaseId = null;
var sabotagePulses = [];
var phaseEffects = [];
var target = { x: player.x, y: player.y };
global.target = target;

window.canvas = new Canvas();
window.chat = new ChatClient();

var visibleBorderSetting = document.getElementById('visBord');
visibleBorderSetting.onchange = settings.toggleBorder;

var showMassSetting = document.getElementById('showMass');
showMassSetting.onchange = settings.toggleMass;

var continuitySetting = document.getElementById('continuity');
continuitySetting.onchange = settings.toggleContinuity;

setupPanelControls();
setupActionControls();
setupTVModeButton();
setupAdminCodeToggle();
var movementToggle = document.getElementById('movementToggle');
if (movementToggle) {
    movementToggle.onclick = function () {
        setMovementPaused(!global.movementPaused);
    };
}
var adminStartButton = document.getElementById('adminStartButton');
if (adminStartButton) {
    adminStartButton.onclick = function () {
        var input = document.getElementById('adminCodeInput');
        if (socket) {
            var tvPayload = getTVModePayload();
            socket.emit('adminStartGame', {
                code: input ? input.value : '',
                testMode: tvPayload.testMode,
                mode: tvPayload.mode,
                tv: tvPayload.tv,
                tvCode: tvPayload.tvCode
            });
        }
    };
}

var roundFoodSetting = document.getElementById('roundFood');
roundFoodSetting.onchange = settings.toggleRoundFood;

var c = window.canvas.cv;
var graph = c.getContext('2d');

$("#feed").click(function () {
    socket.emit('1');
    window.canvas.reenviar = false;
});

$("#split").click(function () {
    emitSplitAction();
    window.canvas.reenviar = false;
});

function handleDisconnect() {
    socket.close();
    if (!global.kicked) { // We have a more specific error message 
        render.drawErrorMessage('Disconnected!', graph, global.screen);
    }
}


function formatTime(ms) {
    var total = Math.max(0, Math.ceil(ms / 1000));
    var minutes = Math.floor(total / 60);
    var seconds = total % 60;
    return minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
}

function fragmentSummary(intel) {
    var slots = { xA: '??', xB: '??', yA: '??', yB: '??' };
    if (intel && intel.known) {
        intel.known.forEach(function (fragment) {
            slots[fragment.key] = fragment.value;
        });
    }
    return 'X-Alpha=' + slots.xA + ' | X-Beta=' + slots.xB + ' | Y-Alpha=' + slots.yA + ' | Y-Beta=' + slots.yB;
}

var lastFarSpaceWarningAt = 0;
function updateFarSpaceWarning(x, y) {
    if (!global || !global.game) return;
    var padding = 900;
    var far = x < -padding || y < -padding || x > global.game.width + padding || y > global.game.height + padding;
    if (!far) return;
    var now = Date.now();
    if (now - lastFarSpaceWarningAt < 18000) return;
    lastFarSpaceWarningAt = now;
    var surgeX = Math.round(global.game.width / 2);
    var surgeY = Math.round(global.game.height / 2);
    showPickupNotice({ type: 'action', title: 'Outer grid drift', text: 'Power surge near X=' + surgeX + ' Y=' + surgeY, detail: 'Use Warp Drive (F) to cross back fast.' });
}

function updateCoordStrip(data, playerState) {
    var strip = document.getElementById('coordStrip');
    if (!strip || !playerState) return;
    var rawX = Math.round(playerState.x || 0);
    var rawY = Math.round(playerState.y || 0);

    var x = rawX;
    var y = Math.round(global.game.height - rawY);
    var intel = playerState.beaconIntel || null;
    updateFarSpaceWarning(x, y);
    var text = '<b>POS</b> X=' + x + ' Y=' + y;
    if (intel && intel.hasLock && intel.beacon) {
        var beaconDisplayX = Math.round(intel.beacon.x);
        var beaconDisplayY = Math.round(global.game.height - intel.beacon.y);

        var dx = beaconDisplayX - x;
        var dy = beaconDisplayY - y;
        var distance = Math.round(Math.sqrt(dx * dx + dy * dy));
        var state = intel.activationOpen ? '<span class="beacon-live">BEACON LIVE</span>' : 'Beacon opens in Phase 4';
        text += ' • <b>BEACON</b> X=' + beaconDisplayX + ' Y=' + beaconDisplayY + ' • ΔX=' + dx + ' ΔY=' + dy;    } else if (intel) {
        text += ' • <b>FRAGMENTS</b> ' + intel.knownCount + '/' + intel.requiredCount + ' • eat rivals to steal beacon coordinates';
    } else {
        text += ' • Beacon intel offline';
    }
    strip.innerHTML = text;
}

function phaseAddsLine(phase) {
    if (!phase) return '';
    if (phase.id === 'arrival') return 'Emergency jump complete. Your core is unstable, your compass is lying politely, and every coordinate fragment matters.';
    if (phase.id === 'drone-awakening') return 'Relay lanes are waking up. Small drifter ships enter your screen as salvage targets, making the sector feel alive instead of embarrassingly empty.';
    if (phase.id === 'dark-matter-breach') return 'Purple matter breaches the sector. Reach 3/3, press E, and turn nearby rivals into leaking stardust. Elegant vandalism.';
    if (phase.id === 'singularity-collapse') return 'The beacon window opens. Coordinate hunters sprint, predators orbit, and the universe starts charging rent.';
    return '';
}

function showPhaseBanner(phase) {
    var banner = document.getElementById('phaseBanner');
    if (!banner || !phase) return;
    banner.className = 'phase-banner';
    banner.innerHTML = '<div class="phase-kicker">CHAPTER ' + phase.chapter + ' / STARFALL PROTOCOL</div>' +
        '<div class="phase-title">' + phase.name + '</div>' +
        '<div class="phase-copy">' + phase.message + '</div>';
    window.clearTimeout(showPhaseBanner.timeout);
    showPhaseBanner.timeout = window.setTimeout(function () {
        banner.className = 'phase-banner hidden';
    }, 10500);
}

function maybeShowPhaseBanner(phase) {
    if (!phase || !phase.started) return;
    if (phase.id !== lastPhaseId) {
        lastPhaseId = phase.id;
        showPhaseBanner(phase);
    }
}

function updateEventHud(data) {
    eventStatus = data;
    updateCoordStrip(data, player);
    updateLobbyOverlay(data && !data.started ? (latestLobbyState || { started: false, count: data.lobbyCount || 0, maxPlayers: null, players: [] }) : { started: true });
    var hud = document.getElementById('eventHudContent');
    if (!hud) return;
    var shards = player.darkMatter || 0;
    var cooldownText = '';
    var phase = data.phase || null;
    maybeShowPhaseBanner(phase);
    if (player.sabotageCooldownUntil && Date.now() < player.sabotageCooldownUntil) {
        cooldownText = ' • Pulse CD: ' + Math.ceil((player.sabotageCooldownUntil - Date.now()) / 1000) + 's';
    }
    var warpLine = '<br><span><b>F:</b> Warp Drive = super speed';
    if (player.warpCooldownUntil && Date.now() < player.warpCooldownUntil) {
        warpLine += ' • Warp CD: ' + Math.ceil((player.warpCooldownUntil - Date.now()) / 1000) + 's';
    } else if (player.warpBoostUntil && Date.now() < player.warpBoostUntil) {
        warpLine += ' • ACTIVE';
    } else {
        warpLine += ' • ready';
    }
    warpLine += '</span>';
    var modeLine = data.mode === 'tv' ? '<br><b>TV TEST MODE:</b> 5 minute run' : '<br><b>FINAL MODE:</b> 35 minute run';
    var phaseLine = phase ? ('<br>Phase ' + phase.chapter + ': <b>' + phase.name + '</b>') : '';
    var nextLine = phase && phase.nextPhaseInMs ? (' • Next: ' + formatTime(phase.nextPhaseInMs)) : '';
    var shardSlots = '';
    for (var shardIndex = 1; shardIndex <= 3; shardIndex++) {
        shardSlots += '<span class="dm-slot ' + (shards >= shardIndex ? 'filled' : '') + '">' + shardIndex + '/3</span>';
    }
    var sabotageLine = data.sabotageUnlocked ?
        ('Dark Matter: ' + Math.min(3, shards) + '/3 ' + shardSlots + cooldownText) :
        ('Sabotage: locked until Phase 3 ' + shardSlots);
    var intel = player.beaconIntel || null;
    var currentX = Math.round(player.x || 0);
    var currentY = Math.round(player.y || 0);
    var beaconLine = '<br><b>BEACON MODE:</b> waiting for coordinate fragment...';
    if (intel) {
        var beaconState = 'Beacon hidden';
        if (intel.hasLock && intel.activationOpen) beaconState = '<b>BEACON LIVE</b>';
        else if (intel.hasLock) beaconState = '<b>Coordinate locked, opens in Phase 4</b>';
        beaconLine = '<br><b>Coordinate Fragments:</b> ' + intel.knownCount + '/' + intel.requiredCount +
            '<br><span>' + fragmentSummary(intel) + '</span>' +
            '<br><span>' + beaconState + ' • navigation shown in the small coordinate strip.</span>';
    }

    hud.innerHTML = '<b>STARFALL: SINGULARITY RUSH</b>' +
        '<br><b>BEACON MODE BUILD</b>' +
        modeLine +
        '<br>Time: ' + formatTime(data.timeRemaining) +
        phaseLine + '<span>' + nextLine + '</span>' +
        '<br><span>' + phaseAddsLine(phase) + '</span>' +
        '<br>Energy: ' + Math.round(player.massTotal || 0) +
        ' • Score: ' + Math.round(player.score || player.massTotal || 0) +
        '<br>' + sabotageLine +
        '<br><span><b>E:</b> Dark Matter Pulse = spend 3 shards to drain nearby enemy mass</span>' +
        warpLine +
        beaconLine +
        '<br><span>Eat rivals to steal fragments • Full coordinate reveals beacon • Phase 4 unlocks activation</span>' +
        '<br><span>Move: Mouse • Split: Space • Pulse: E • Warp: F</span>';

    if (data.ended) {
        showEndOverlay(data.winner);
    }
}

function showEndOverlay(winner) {
    var overlay = document.getElementById('endOverlay');
    if (!overlay) return;
    overlay.className = 'end-overlay';
    var name = winner && winner.name ? winner.name : 'No winner';
    var score = winner && winner.score ? winner.score : 0;
    overlay.innerHTML = '<div class="end-card">' +
        '<h1>Sector Dominated</h1>' +
        '<h2>' + name + '</h2>' +
        '<p>Final Score: ' + score + '</p>' +
        '<p>Refresh only when the coordinator starts a new server/match.</p>' +
        '</div>';
}

// socket stuff.
function setupSocket(socket) {
    // Handle ping.
    socket.on('pongcheck', function () {
        var latency = Date.now() - global.startPingTime;
        debug('Latency: ' + latency + 'ms');
        window.chat.addSystemLine('Ping: ' + latency + 'ms');
    });

    // Handle error.
    socket.on('connect_error', handleDisconnect);
    socket.on('disconnect', handleDisconnect);

    // Handle connection.
    socket.on('welcome', function (playerSettings, gameSizes) {
        player = playerSettings;
        player.name = global.playerName;
        player.screenWidth = global.screen.width;
        player.screenHeight = global.screen.height;
        player.target = window.canvas.target;
        global.player = player;
        window.chat.player = player;
        socket.emit('gotit', player);
        global.gameStart = true;
        window.chat.addSystemLine('Connected to the game!');
        window.chat.addSystemLine('Type <b>-help</b> for a list of commands.');
        if (global.mobile) {
            document.getElementById('gameAreaWrapper').removeChild(document.getElementById('chatbox'));
        }
        c.focus();
        global.game.width = gameSizes.width;
        global.game.height = gameSizes.height;
        resize();
    });

    socket.on('playerDied', (data) => {
        const player = isUnnamedCell(data.playerEatenName) ? 'An unnamed cell' : data.playerEatenName;
        //const killer = isUnnamedCell(data.playerWhoAtePlayerName) ? 'An unnamed cell' : data.playerWhoAtePlayerName;

        //window.chat.addSystemLine('{GAME} - <b>' + (player) + '</b> was eaten by <b>' + (killer) + '</b>');
        window.chat.addSystemLine('{GAME} - <b>' + (player) + '</b> was eaten');
    });

    socket.on('playerDisconnect', (data) => {
        window.chat.addSystemLine('{GAME} - <b>' + (isUnnamedCell(data.name) ? 'An unnamed cell' : data.name) + '</b> disconnected.');
    });

    socket.on('playerJoin', (data) => {
        window.chat.addSystemLine('{GAME} - <b>' + (isUnnamedCell(data.name) ? 'An unnamed cell' : data.name) + '</b> joined.');
    });

    socket.on('leaderboard', (data) => {
        leaderboard = data.leaderboard;
        var status = '<span class="title">Leaderboard</span>';
        for (var i = 0; i < leaderboard.length; i++) {
            status += '<br />';
            if (leaderboard[i].id == player.id) {
                if (leaderboard[i].name.length !== 0)
                    status += '<span class="me">' + (i + 1) + '. ' + leaderboard[i].name + ' [' + (leaderboard[i].score || leaderboard[i].mass || 0) + ']</span>';
                else
                    status += '<span class="me">' + (i + 1) + '. Unknown Core</span>';
            } else {
                if (leaderboard[i].name.length !== 0)
                    status += (i + 1) + '. ' + leaderboard[i].name + ' [' + (leaderboard[i].score || leaderboard[i].mass || 0) + ']';
                else
                    status += (i + 1) + '. Unknown Core';
            }
        }
        //status += '<br />Players: ' + data.players;
        var statusContent = document.getElementById('statusContent');
        if (statusContent) statusContent.innerHTML = status;
    });

    socket.on('eventStatus', function (data) {
        updateEventHud(data);
    });

    socket.on('lobbyState', function (state) {
        latestLobbyState = state;
        updateLobbyOverlay(state);
    });

    socket.on('phaseChanged', function (phase) {
        maybeShowPhaseBanner(phase);
    });

    socket.on('sabotagePulse', function (pulse) {
        pulse.receivedAt = Date.now();
        sabotagePulses.push(pulse);
        if (sabotagePulses.length > 8) sabotagePulses.shift();
    });

    socket.on('phaseEffect', function (effect) {
        effect.receivedAt = Date.now();
        phaseEffects.push(effect);
        if (phaseEffects.length > 4) phaseEffects.shift();
    });

    socket.on('serverMSG', function (data) {
        window.chat.addSystemLine(data);
    });

    socket.on('tvModeRejected', function (message) {
        window.chat.addSystemLine(message || '{ADMIN} TV mode password rejected. Returning to final mode.');
        setTVMode(false);
    });

    socket.on('pickupNotice', function (notice) {
        showPickupNotice(notice);
    });

    // Chat.
    socket.on('serverSendPlayerChat', function (data) {
        window.chat.addChatLine(data.sender, data.message, false);
    });

    // Handle movement.
    socket.on('serverTellPlayerMove', function (playerData, userData, foodsList, massList, virusList) {
        if (global.playerType == 'player') {
            player.x = playerData.x;
            player.y = playerData.y;
            player.hue = playerData.hue;
            player.massTotal = playerData.massTotal;
            player.score = playerData.score;
            player.darkMatter = playerData.darkMatter || 0;
            player.sabotageCooldownUntil = playerData.sabotageCooldownUntil || 0;
            player.warpCooldownUntil = playerData.warpCooldownUntil || 0;
            player.warpBoostUntil = playerData.warpBoostUntil || 0;
            player.beaconIntel = playerData.beaconIntel || null;
            player.cells = playerData.cells;
            updateCoordStrip(eventStatus, player);
        }
        users = userData;
        foods = foodsList;
        viruses = virusList;
        fireFood = massList;
    });

    // Death.
    socket.on('RIP', function (data) {
        var delayMs = data && data.respawnDelayMs ? data.respawnDelayMs : 120000;
        var delaySeconds = Math.ceil(delayMs / 1000);
        render.drawErrorMessage('Core destroyed. Respawn in ' + formatTime(delayMs), graph, global.screen);
        window.chat.addSystemLine('{GAME} - Your core collapsed. Respawning in ' + delaySeconds + ' seconds. Beacon intel was stolen.');
        var remaining = delayMs;
        var countdown = window.setInterval(function () {
            remaining -= 1000;
            if (remaining > 0) {
                render.drawErrorMessage('Core destroyed. Respawn in ' + formatTime(remaining), graph, global.screen);
            } else {
                window.clearInterval(countdown);
            }
        }, 1000);
        window.setTimeout(() => {
            window.clearInterval(countdown);
            if (socket && !eventStatus?.ended) {
                socket.emit('respawn');
            }
        }, delayMs);
    });

    socket.on('kick', function (reason) {
        global.gameStart = false;
        global.kicked = true;
        if (reason === 'removed due to inactivity') {
            render.drawErrorMessage('Removed due to inactivity.', graph, global.screen);
        }
        else if (reason !== '') {
            render.drawErrorMessage('You were kicked for: ' + reason, graph, global.screen);
        }
        else {
            render.drawErrorMessage('You were kicked!', graph, global.screen);
        }
        socket.close();
    });
}

const isUnnamedCell = (name) => name.length < 1;

const getPosition = (entity, player, screen) => {
    return {
        x: entity.x - player.x + screen.width / 2,
        y: entity.y - player.y + screen.height / 2
    }
}

window.requestAnimFrame = (function () {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (callback) {
            window.setTimeout(callback, 1000 / 60);
        };
})();

window.cancelAnimFrame = (function (handle) {
    return window.cancelAnimationFrame ||
        window.mozCancelAnimationFrame;
})();

function animloop() {
    global.animLoopHandle = window.requestAnimFrame(animloop);
    gameLoop();
}

function gameLoop() {
    if (global.gameStart) {
        graph.fillStyle = global.backgroundColor;
        graph.fillRect(0, 0, global.screen.width, global.screen.height);

        if (global.movementPaused) {
            target.x = 0;
            target.y = 0;
            global.target = target;
            if (window.canvas) window.canvas.target = target;
        }

        render.drawGrid(global, player, global.screen, graph);
        if (eventStatus && eventStatus.phase) {
            render.drawPhaseAtmosphere(eventStatus.phase, graph, global.screen);
        }
        phaseEffects = phaseEffects.filter(effect => Date.now() - effect.receivedAt < 2600);
        phaseEffects.forEach(effect => render.drawPhaseImpact(effect, graph, global.screen));
        sabotagePulses = sabotagePulses.filter(pulse => Date.now() - pulse.receivedAt < 1300);
        sabotagePulses.forEach(pulse => {
            let position = getPosition(pulse, player, global.screen);
            render.drawSabotagePulse(position, pulse, graph);
        });
        if (player.beaconIntel && player.beaconIntel.hasLock && player.beaconIntel.beacon) {
            let beaconPosition = getPosition(player.beaconIntel.beacon, player, global.screen);
            render.drawBeacon(beaconPosition, player.beaconIntel, graph);
        }
        foods.forEach(food => {
            let position = getPosition(food, player, global.screen);
            render.drawFood(position, food, graph);
        });
        fireFood.forEach(fireFood => {
            let position = getPosition(fireFood, player, global.screen);
            render.drawFireFood(position, fireFood, playerConfig, graph);
        });
        viruses.forEach(virus => {
            let position = getPosition(virus, player, global.screen);
            render.drawVirus(position, virus, graph);
        });


        let borders = { // Position of the borders on the screen
            left: global.screen.width / 2 - player.x,
            right: global.screen.width / 2 + global.game.width - player.x,
            top: global.screen.height / 2 - player.y,
            bottom: global.screen.height / 2 + global.game.height - player.y
        }
        if (global.borderDraw) {
            render.drawBorder(borders, graph);
        }

        var cellsToDraw = [];
        for (var i = 0; i < users.length; i++) {
            let color = 'hsl(' + users[i].hue + ', 100%, 50%)';
            let borderColor = 'hsl(' + users[i].hue + ', 100%, 45%)';
            for (var j = 0; j < users[i].cells.length; j++) {
                cellsToDraw.push({
                    color: color,
                    borderColor: borderColor,
                    hue: users[i].hue,
                    angle: Math.atan2((users[i].target && users[i].target.y) || 0, (users[i].target && users[i].target.x) || 1),
                    mass: users[i].cells[j].mass,
                    name: users[i].name,
                    radius: users[i].cells[j].radius,
                    x: users[i].cells[j].x - player.x + global.screen.width / 2,
                    y: users[i].cells[j].y - player.y + global.screen.height / 2
                });
            }
        }
        cellsToDraw.sort(function (obj1, obj2) {
            return obj1.mass - obj2.mass;
        });
        render.drawCells(cellsToDraw, playerConfig, global.toggleMassState, borders, graph);

        socket.emit('0', global.movementPaused ? { x: 0, y: 0 } : window.canvas.target); // playerSendTarget "Heartbeat".
    }
}

window.addEventListener('resize', resize);

function resize() {
    if (!socket) return;

    player.screenWidth = c.width = global.screen.width = global.playerType == 'player' ? window.innerWidth : global.game.width;
    player.screenHeight = c.height = global.screen.height = global.playerType == 'player' ? window.innerHeight : global.game.height;

    if (global.playerType == 'spectator') {
        player.x = global.game.width / 2;
        player.y = global.game.height / 2;
    }

    socket.emit('windowResized', { screenWidth: global.screen.width, screenHeight: global.screen.height });
}
