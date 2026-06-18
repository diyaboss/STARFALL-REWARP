const fs = require('fs');
const path = require('path');

function readLocalEnvFile() {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('\"') && value.endsWith('\"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (key && process.env[key] === undefined) process.env[key] = value;
    }
}

readLocalEnvFile();

module.exports = {
    host: "0.0.0.0",
    port: 3000,
    logpath: "logger.php",
    foodMass: 0.35, // visual/player mass grows slowly; score still rewards collection
    droneMassGain: 6, // drones no longer balloon players during a 35-min match
    rogueShipMassGain: 5, // drifter ships stay small/equal-size filler targets
    localDriftersPerPlayer: 6, // keep 4-6 small drifter ships around every pilot's screen
    localDrifterRadius: 1200, // approximate visible patrol radius around each active pilot
    shardTargetCount: 45,
    droneTargetCount: 75,
    matchDurationSeconds: 35 * 60, // final event match length
    respawnDelaySeconds: 120, // final event eaten-player respawn delay
    maxPlayerMassTotal: 150, // hard cap on playable size; score keeps rising, shield/orb stays event-safe
    beaconCaptureRadius: 180,
    beaconActivationStartRatio: 0.75, // beacon activates only in Phase 4; early coordinate locks reveal the marker but cannot end the match
    darkMatterCost: 3,
    maxDarkMatter: 3,
    sabotageRadius: 650,
    sabotageCooldownMs: 45000,
    fireFood: 20,
    limitSplit: 16,
    defaultPlayerMass: 10,
	virus: {
        fill: "#33ff33",
        stroke: "#19D119",
        strokeWidth: 20,
        defaultMass: {
            from: 100,
            to: 150
        },
        splitMass: 180,
        uniformDisposition: false,
	},
    gameWidth: 10000,
    gameHeight: 10000,
    adminPass: process.env.ADMIN_CODE || process.env.STARFALL_ADMIN_CODE || "",
    tvPass: process.env.TV_CODE || process.env.STARFALL_TV_CODE || "",
    warpCooldownMs: 3 * 60 * 1000,
    warpDurationMs: 6500,
    warpSpeedMultiplier: 3.2,
    farSpaceWarningPadding: 1500,
    testMatchDurationSeconds: 5 * 60,
    testRespawnDelaySeconds: 20,
    gameMass: 65000,
    maxFood: 5000,
    maxVirus: 45,
    slowBase: 4.5,
    logChat: 0,
    networkUpdateFactor: 40,
    maxHeartbeatInterval: 5 * 60 * 1000, // remove inactive players only after 5 full minutes
    foodUniformDisposition: true,
    newPlayerInitialPosition: "farthest",
    massLossRate: 1,
    minMassLoss: 50,
    sqlinfo: {
      fileName: "db.sqlite3",
    }
};
