const FULL_ANGLE = 2 * Math.PI;


const ASSET_BASE = '/img/starfall/';
const SPRITE_PATHS = {
    background: 'background_dark_purple.png',
    ships: ['ship_blue.png', 'ship_green.png', 'ship_orange.png', 'ship_red.png', 'ship_blue_alt.png'],
    drones: ['drone_blue.png', 'drone_green.png', 'drone_red.png', 'drone_black.png'],
    stardust: ['stardust_1.png', 'stardust_2.png', 'stardust_3.png'],
    shard: 'dark_matter_core.png',
    anomaly: 'anomaly_meteor.png',
    asteroid: 'asteroid_brown.png',
    energy: 'energy_pickup.png',
    shield: 'shield_2.png',
    pulse: 'effect_glow_1.png'
};

const starfallSprites = {};
const loadSprite = (key, filename) => {
    if (typeof Image === 'undefined') return null;
    const img = new Image();
    img.src = ASSET_BASE + filename;
    starfallSprites[key] = img;
    return img;
};

if (typeof Image !== 'undefined') {
    SPRITE_PATHS.ships.forEach((filename, index) => loadSprite('ship' + index, filename));
    SPRITE_PATHS.drones.forEach((filename, index) => loadSprite('drone' + index, filename));
    SPRITE_PATHS.stardust.forEach((filename, index) => loadSprite('stardust' + index, filename));
    loadSprite('background', SPRITE_PATHS.background);
    loadSprite('shard', SPRITE_PATHS.shard);
    loadSprite('anomaly', SPRITE_PATHS.anomaly);
    loadSprite('asteroid', SPRITE_PATHS.asteroid);
    loadSprite('energy', SPRITE_PATHS.energy);
    loadSprite('shield', SPRITE_PATHS.shield);
    loadSprite('pulse', SPRITE_PATHS.pulse);
}

const spriteReady = (sprite) => sprite && sprite.complete && sprite.naturalWidth > 0;

const spriteIndex = (seed, count) => {
    if (!count) return 0;
    const raw = String(seed || 'starfall');
    let hash = 0;
    for (let i = 0; i < raw.length; i++) hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
    return Math.abs(hash) % count;
};

const drawSpriteCentered = (graph, sprite, x, y, size, angle = 0, alpha = 1) => {
    if (!spriteReady(sprite)) return false;
    graph.save();
    graph.globalAlpha *= alpha;
    graph.translate(x, y);
    graph.rotate(angle);
    const maxSide = Math.max(sprite.naturalWidth, sprite.naturalHeight);
    const scale = size / maxSide;
    const width = sprite.naturalWidth * scale;
    const height = sprite.naturalHeight * scale;
    graph.drawImage(sprite, -width / 2, -height / 2, width, height);
    graph.restore();
    return true;
};

const drawRoundObject = (position, radius, graph) => {
    graph.beginPath();
    graph.arc(position.x, position.y, radius, 0, FULL_ANGLE);
    graph.closePath();
    graph.fill();
    graph.stroke();
}

const circlePoint = (origo, radius, theta) => ({
    x: origo.x + radius * Math.cos(theta),
    y: origo.y + radius * Math.sin(theta)
});

const drawStar = (position, radius, graph) => {
    graph.save();
    graph.translate(position.x, position.y);
    graph.rotate(Math.PI / 4);
    graph.beginPath();
    for (let i = 0; i < 8; i++) {
        const r = i % 2 === 0 ? radius : radius * 0.42;
        const a = i * Math.PI / 4;
        graph.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    graph.closePath();
    graph.fill();
    graph.restore();
};

const drawDrifterShip = (position, ship, graph) => {
    const angle = Math.atan2(ship.vy || 0.01, ship.vx || 0.01);
    const sprite = starfallSprites['ship' + spriteIndex(ship.id || ship.x + ':' + ship.y, SPRITE_PATHS.ships.length)];

    graph.save();
    graph.shadowColor = '#ffb45c';
    graph.shadowBlur = 18;
    if (drawSpriteCentered(graph, sprite, position.x, position.y, ship.radius * 3.2, angle + Math.PI / 2, 0.92)) {
        graph.restore();
    } else {
        graph.restore();
        graph.save();
        graph.translate(position.x, position.y);
        graph.rotate(angle);
        graph.shadowColor = '#ffb45c';
        graph.shadowBlur = 14;
        graph.fillStyle = '#ffb45c';
        graph.strokeStyle = '#fff0d1';
        graph.lineWidth = 2;
        graph.beginPath();
        graph.moveTo(ship.radius * 1.25, 0);
        graph.lineTo(-ship.radius, -ship.radius * 0.62);
        graph.lineTo(-ship.radius * 0.55, 0);
        graph.lineTo(-ship.radius, ship.radius * 0.62);
        graph.closePath();
        graph.fill();
        graph.stroke();
        graph.restore();
    }

    graph.save();
    graph.globalAlpha = 0.72;
    graph.strokeStyle = 'rgba(255, 210, 128, 0.75)';
    graph.lineWidth = 2;
    graph.beginPath();
    graph.arc(position.x, position.y, ship.radius * 1.35, 0, FULL_ANGLE);
    graph.stroke();
    graph.fillStyle = '#fff0d1';
    graph.font = 'bold 10px sans-serif';
    graph.textAlign = 'center';
    graph.fillText('DRIFTER', position.x, position.y + ship.radius * 2.05);
    graph.restore();
};

const drawDrone = (position, drone, graph) => {
    const angle = Math.atan2(drone.vy || 0.01, drone.vx || 0.01);
    const sprite = starfallSprites['drone' + spriteIndex(drone.id || drone.x + ':' + drone.y, SPRITE_PATHS.drones.length)];

    graph.save();
    graph.shadowColor = '#82f7ff';
    graph.shadowBlur = 14;
    if (drawSpriteCentered(graph, sprite, position.x, position.y, drone.radius * 3.35, angle + Math.PI / 2)) {
        graph.restore();
        return;
    }
    graph.restore();

    graph.save();
    graph.translate(position.x, position.y);
    graph.rotate(angle);
    graph.shadowColor = '#82f7ff';
    graph.shadowBlur = 12;
    graph.fillStyle = '#88f7ff';
    graph.strokeStyle = '#d8fdff';
    graph.lineWidth = 2;
    graph.beginPath();
    graph.moveTo(drone.radius, 0);
    graph.lineTo(-drone.radius * 0.55, -drone.radius * 0.52);
    graph.lineTo(-drone.radius * 0.32, 0);
    graph.lineTo(-drone.radius * 0.55, drone.radius * 0.52);
    graph.closePath();
    graph.fill();
    graph.stroke();

    graph.shadowBlur = 0;
    graph.fillStyle = '#040814';
    graph.beginPath();
    graph.arc(0, 0, Math.max(2, drone.radius * 0.22), 0, FULL_ANGLE);
    graph.fill();
    graph.restore();
};

const drawShard = (position, shard, graph) => {
    const size = Math.max(30, shard.radius * 3.1);
    const spin = Date.now() / 700;
    graph.save();
    graph.shadowColor = '#b45cff';
    graph.shadowBlur = 20;
    if (drawSpriteCentered(graph, starfallSprites.shard, position.x, position.y, size, spin)) {
        graph.restore();
        return;
    }
    graph.restore();

    graph.save();
    graph.translate(position.x, position.y);
    graph.rotate(spin);
    graph.shadowColor = '#b45cff';
    graph.shadowBlur = 18;
    graph.fillStyle = '#b45cff';
    graph.strokeStyle = '#f2d6ff';
    graph.lineWidth = 2;
    graph.beginPath();
    graph.moveTo(0, -shard.radius * 1.35);
    graph.lineTo(shard.radius, 0);
    graph.lineTo(0, shard.radius * 1.35);
    graph.lineTo(-shard.radius, 0);
    graph.closePath();
    graph.fill();
    graph.stroke();
    graph.restore();
};

const drawFood = (position, food, graph) => {
    if (food.kind === 'drone') {
        drawDrone(position, food, graph);
        return;
    }
    if (food.kind === 'shard') {
        drawShard(position, food, graph);
        return;
    }
    if (food.kind === 'rogueShip') {
        drawDrifterShip(position, food, graph);
        return;
    }

    const sprite = starfallSprites['stardust' + spriteIndex(food.id || food.x + ':' + food.y, SPRITE_PATHS.stardust.length)];
    graph.save();
    graph.shadowColor = '#7bdfff';
    graph.shadowBlur = 10;
    if (drawSpriteCentered(graph, sprite, position.x, position.y, Math.max(12, food.radius * 3.2), Date.now() / 1600)) {
        graph.restore();
        return;
    }
    graph.restore();

    graph.save();
    graph.shadowColor = '#7bdfff';
    graph.shadowBlur = 8;
    graph.fillStyle = 'hsl(' + food.hue + ', 100%, 65%)';
    graph.strokeStyle = 'rgba(255,255,255,0.55)';
    graph.lineWidth = 1;
    drawStar(position, Math.max(3, food.radius), graph);
    graph.restore();
};

const drawVirus = (position, virus, graph) => {
    const spin = Date.now() / 2600;
    const gradient = graph.createRadialGradient(position.x, position.y, 2, position.x, position.y, virus.radius + 28);
    gradient.addColorStop(0, '#000000');
    gradient.addColorStop(0.45, '#130022');
    gradient.addColorStop(0.70, '#6a00ff');
    gradient.addColorStop(1, 'rgba(122, 219, 255, 0)');

    graph.save();
    graph.shadowColor = '#8b5cff';
    graph.shadowBlur = 26;
    graph.fillStyle = gradient;
    graph.strokeStyle = '#c18cff';
    graph.lineWidth = 2;
    drawRoundObject(position, virus.radius * 1.05, graph);

    if (drawSpriteCentered(graph, starfallSprites.anomaly, position.x, position.y, virus.radius * 2.15, spin, 0.78)) {
        graph.globalAlpha = 1;
    }

    graph.strokeStyle = 'rgba(255,255,255,0.48)';
    graph.lineWidth = 1.5;
    graph.beginPath();
    graph.ellipse(position.x, position.y, virus.radius * 1.25, virus.radius * 0.36, spin, 0, FULL_ANGLE);
    graph.stroke();
    graph.beginPath();
    graph.ellipse(position.x, position.y, virus.radius * 1.0, virus.radius * 0.25, -spin * 1.5, 0, FULL_ANGLE);
    graph.stroke();
    graph.restore();
};

const drawFireFood = (position, mass, playerConfig, graph) => {
    const sprite = starfallSprites.energy;
    graph.save();
    graph.shadowColor = 'hsl(' + mass.hue + ', 100%, 60%)';
    graph.shadowBlur = 12;
    if (drawSpriteCentered(graph, sprite, position.x, position.y, Math.max(12, mass.radius * 2.7), 0)) {
        graph.restore();
        return;
    }
    graph.strokeStyle = 'hsl(' + mass.hue + ', 100%, 45%)';
    graph.fillStyle = 'hsl(' + mass.hue + ', 100%, 60%)';
    graph.lineWidth = playerConfig.border + 2;
    drawRoundObject(position, Math.max(2, mass.radius - 1), graph);
    graph.restore();
};

const valueInRange = (min, max, value) => Math.min(max, Math.max(min, value))

const cellTouchingBorders = (cell, borders) =>
    cell.x - cell.radius <= borders.left ||
    cell.x + cell.radius >= borders.right ||
    cell.y - cell.radius <= borders.top ||
    cell.y + cell.radius >= borders.bottom

const regulatePoint = (point, borders) => ({
    x: valueInRange(borders.left, borders.right, point.x),
    y: valueInRange(borders.top, borders.bottom, point.y)
});

const drawShieldOrb = (cell, graph) => {
    const hue = cell.hue || 195;
    const gradient = graph.createRadialGradient(cell.x, cell.y, cell.radius * 0.1, cell.x, cell.y, cell.radius);
    gradient.addColorStop(0, 'hsla(' + hue + ', 100%, 70%, 0.30)');
    gradient.addColorStop(0.72, 'hsla(' + hue + ', 100%, 54%, 0.13)');
    gradient.addColorStop(1, 'hsla(' + hue + ', 100%, 62%, 0.48)');

    graph.save();
    graph.shadowColor = 'hsl(' + hue + ', 100%, 62%)';
    graph.shadowBlur = 18;
    graph.fillStyle = gradient;
    graph.strokeStyle = 'hsla(' + hue + ', 100%, 70%, 0.85)';
    graph.lineWidth = 3;
    drawRoundObject(cell, cell.radius, graph);

    graph.strokeStyle = 'rgba(255,255,255,0.22)';
    graph.lineWidth = 1;
    graph.beginPath();
    graph.arc(cell.x, cell.y, cell.radius * 0.72, 0, FULL_ANGLE);
    graph.stroke();
    graph.restore();
};

const drawVectorShip = (cell, graph, shipSize, hue, angle) => {
    graph.save();
    graph.translate(cell.x, cell.y);
    graph.rotate(angle);
    graph.shadowColor = '#ffffff';
    graph.shadowBlur = 5;

    graph.fillStyle = 'rgba(91, 205, 255, 0.8)';
    graph.beginPath();
    graph.moveTo(-shipSize * 0.45, 0);
    graph.lineTo(-shipSize * 0.9, -shipSize * 0.16);
    graph.lineTo(-shipSize * 0.9, shipSize * 0.16);
    graph.closePath();
    graph.fill();

    graph.fillStyle = 'hsl(' + hue + ', 85%, 47%)';
    graph.strokeStyle = 'rgba(255,255,255,0.8)';
    graph.lineWidth = 1.5;
    graph.beginPath();
    graph.moveTo(shipSize * 0.95, 0);
    graph.lineTo(-shipSize * 0.35, -shipSize * 0.62);
    graph.lineTo(-shipSize * 0.12, -shipSize * 0.18);
    graph.lineTo(-shipSize * 0.55, -shipSize * 0.12);
    graph.lineTo(-shipSize * 0.55, shipSize * 0.12);
    graph.lineTo(-shipSize * 0.12, shipSize * 0.18);
    graph.lineTo(-shipSize * 0.35, shipSize * 0.62);
    graph.closePath();
    graph.fill();
    graph.stroke();

    graph.fillStyle = '#dffaff';
    graph.beginPath();
    graph.ellipse(shipSize * 0.2, 0, shipSize * 0.22, shipSize * 0.14, 0, 0, FULL_ANGLE);
    graph.fill();

    graph.restore();
};

const drawShip = (cell, graph) => {
    const hue = cell.hue || 195;
    const shipSize = Math.min(46, Math.max(22, 17 + Math.sqrt(cell.mass) * 1.75));
    const angle = typeof cell.angle === 'number' && !isNaN(cell.angle) ? cell.angle : -Math.PI / 2;
    const index = Math.max(0, Math.min(SPRITE_PATHS.ships.length - 1, Math.floor(((hue % 360) / 360) * SPRITE_PATHS.ships.length)));
    const sprite = starfallSprites['ship' + index] || starfallSprites.ship0;

    graph.save();
    graph.shadowColor = '#ffffff';
    graph.shadowBlur = 8;
    // Kenney top-down ships face upward, so add PI/2 to match the old right-facing math angle.
    if (drawSpriteCentered(graph, sprite, cell.x, cell.y, shipSize * 2.25, angle + Math.PI / 2)) {
        graph.restore();
        return;
    }
    graph.restore();

    drawVectorShip(cell, graph, shipSize, hue, angle);
};

const drawCellWithLines = (cell, borders, graph) => {
    let pointCount = 30 + ~~(cell.mass / 5);
    let points = [];
    for (let theta = 0; theta < FULL_ANGLE; theta += FULL_ANGLE / pointCount) {
        let point = circlePoint(cell, cell.radius, theta);
        points.push(regulatePoint(point, borders));
    }
    graph.beginPath();
    graph.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        graph.lineTo(points[i].x, points[i].y);
    }
    graph.closePath();
    graph.fill();
    graph.stroke();
}

const drawCells = (cells, playerConfig, toggleMassState, borders, graph) => {
    for (let cell of cells) {
        drawShieldOrb(cell, graph);
        if (cellTouchingBorders(cell, borders)) {
            graph.save();
            graph.globalAlpha = 0.15;
            graph.fillStyle = cell.color;
            graph.strokeStyle = cell.borderColor;
            graph.lineWidth = 2;
            drawCellWithLines(cell, borders, graph);
            graph.restore();
        }
        drawShip(cell, graph);

        let fontSize = Math.max(cell.radius / 3.4, 12);
        graph.lineWidth = playerConfig.textBorderSize;
        graph.fillStyle = playerConfig.textColor;
        graph.strokeStyle = playerConfig.textBorder;
        graph.miterLimit = 1;
        graph.lineJoin = 'round';
        graph.textAlign = 'center';
        graph.textBaseline = 'middle';
        graph.font = 'bold ' + fontSize + 'px sans-serif';
        graph.strokeText(cell.name, cell.x, cell.y + cell.radius + fontSize);
        graph.fillText(cell.name, cell.x, cell.y + cell.radius + fontSize);

        if (toggleMassState === 1) {
            graph.font = 'bold ' + Math.max(fontSize / 3 * 2, 10) + 'px sans-serif';
            graph.strokeText(Math.round(cell.mass), cell.x, cell.y + cell.radius + fontSize * 2);
            graph.fillText(Math.round(cell.mass), cell.x, cell.y + cell.radius + fontSize * 2);
        }
    }
};

const drawGrid = (global, player, screen, graph) => {
    graph.save();

    const bg = starfallSprites.background;
    if (spriteReady(bg)) {
        const scale = 2.25;
        const tileW = bg.naturalWidth * scale;
        const tileH = bg.naturalHeight * scale;
        const offsetX = ((-player.x * 0.02) % tileW + tileW) % tileW;
        const offsetY = ((-player.y * 0.02) % tileH + tileH) % tileH;
        graph.globalAlpha = 0.34;
        for (let x = -offsetX; x < screen.width; x += tileW) {
            for (let y = -offsetY; y < screen.height; y += tileH) {
                graph.drawImage(bg, x, y, tileW, tileH);
            }
        }
        graph.globalAlpha = 1;
    }

    const t = Date.now() / 5000;
    for (let i = 0; i < 120; i++) {
        const x = ((i * 997 + -player.x * 0.04) % screen.width + screen.width) % screen.width;
        const y = ((i * 557 + -player.y * 0.04) % screen.height + screen.height) % screen.height;
        const r = 0.7 + ((i * 13) % 24) / 20;
        graph.globalAlpha = 0.25 + ((i * 7) % 50) / 100;
        graph.fillStyle = '#ffffff';
        graph.beginPath();
        graph.arc(x, y + Math.sin(t + i) * 0.8, r, 0, FULL_ANGLE);
        graph.fill();
    }

    graph.globalAlpha = 0.16;
    graph.lineWidth = 1;
    graph.strokeStyle = global.lineColor;
    graph.beginPath();

    for (let x = -player.x; x < screen.width; x += screen.height / 18) {
        graph.moveTo(x, 0);
        graph.lineTo(x, screen.height);
    }

    for (let y = -player.y; y < screen.height; y += screen.height / 18) {
        graph.moveTo(0, y);
        graph.lineTo(screen.width, y);
    }

    graph.stroke();
    graph.restore();
};

const drawBorder = (borders, graph) => {
    graph.lineWidth = 2;
    graph.strokeStyle = '#7bdfff'
    graph.beginPath()
    graph.moveTo(borders.left, borders.top);
    graph.lineTo(borders.right, borders.top);
    graph.lineTo(borders.right, borders.bottom);
    graph.lineTo(borders.left, borders.bottom);
    graph.closePath()
    graph.stroke();
};


const drawSabotagePulse = (position, pulse, graph) => {
    const lifetime = 1300;
    const age = Date.now() - pulse.receivedAt;
    if (age < 0 || age > lifetime) return;

    const progress = age / lifetime;
    const radius = Math.max(20, pulse.radius * progress);
    const alpha = Math.max(0, 1 - progress);

    graph.save();
    graph.globalAlpha = alpha;
    graph.shadowColor = '#d85cff';
    graph.shadowBlur = 34;
    graph.strokeStyle = '#d85cff';
    graph.lineWidth = 7;
    graph.beginPath();
    graph.arc(position.x, position.y, radius, 0, FULL_ANGLE);
    graph.stroke();

    if (spriteReady(starfallSprites.pulse)) {
        drawSpriteCentered(graph, starfallSprites.pulse, position.x, position.y, Math.max(80, radius * 0.85), Date.now() / 900, alpha * 0.6);
    }

    graph.globalAlpha = alpha * 0.16;
    graph.fillStyle = '#b45cff';
    graph.beginPath();
    graph.arc(position.x, position.y, radius, 0, FULL_ANGLE);
    graph.fill();

    graph.globalAlpha = alpha;
    graph.shadowBlur = 12;
    graph.fillStyle = '#ffffff';
    graph.font = 'bold 18px sans-serif';
    graph.textAlign = 'center';
    graph.fillText('DARK MATTER PULSE', position.x, position.y - radius - 12);
    graph.restore();
};


const drawBeacon = (position, intel, graph) => {
    const time = Date.now() / 500;
    const radius = Math.max(60, intel.captureRadius || 180);
    graph.save();
    graph.globalAlpha = 0.85;
    graph.shadowColor = '#ffd65c';
    graph.shadowBlur = 32;
    graph.strokeStyle = '#ffd65c';
    graph.lineWidth = 4;
    graph.beginPath();
    graph.arc(position.x, position.y, radius, 0, FULL_ANGLE);
    graph.stroke();

    graph.globalAlpha = 0.20 + Math.sin(time) * 0.05;
    graph.fillStyle = '#ffd65c';
    graph.beginPath();
    graph.arc(position.x, position.y, radius * 0.75, 0, FULL_ANGLE);
    graph.fill();

    graph.globalAlpha = 1;
    graph.strokeStyle = '#ffffff';
    graph.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
        const angle = time * 0.7 + i * Math.PI / 2;
        graph.beginPath();
        graph.moveTo(position.x + Math.cos(angle) * 14, position.y + Math.sin(angle) * 14);
        graph.lineTo(position.x + Math.cos(angle) * (radius * 0.75), position.y + Math.sin(angle) * (radius * 0.75));
        graph.stroke();
    }

    graph.fillStyle = '#ffffff';
    graph.font = 'bold 22px sans-serif';
    graph.textAlign = 'center';
    graph.textBaseline = 'middle';
    graph.fillText('FINAL BEACON', position.x, position.y - radius - 24);
    graph.font = 'bold 14px sans-serif';
    graph.fillText('X=' + intel.x + '  Y=' + intel.y, position.x, position.y - radius - 4);
    graph.restore();
};

const drawPhaseAtmosphere = (phase, graph, screen) => {
    if (!phase || !phase.id) return;
    graph.save();
    if (phase.id === 'dark-matter-breach') {
        const pulse = 0.05 + (Math.sin(Date.now() / 450) + 1) * 0.018;
        graph.fillStyle = 'rgba(126, 57, 255, ' + pulse + ')';
        graph.fillRect(0, 0, screen.width, screen.height);
        graph.globalAlpha = 0.32;
        graph.strokeStyle = 'rgba(196, 126, 255, 0.45)';
        graph.lineWidth = 2;
        for (let i = 0; i < 9; i++) {
            const x = (Date.now() / 18 + i * 211) % (screen.width + 240) - 120;
            const y = (i * 97 + Math.sin(Date.now() / 650 + i) * 80) % screen.height;
            graph.beginPath();
            graph.moveTo(x - 18, y);
            graph.lineTo(x + 18, y);
            graph.moveTo(x, y - 18);
            graph.lineTo(x, y + 18);
            graph.stroke();
        }
    }
    if (phase.id === 'singularity-collapse') {
        const g = graph.createRadialGradient(screen.width / 2, screen.height / 2, screen.height * 0.18, screen.width / 2, screen.height / 2, screen.height * 0.75);
        g.addColorStop(0, 'rgba(255, 214, 92, 0.04)');
        g.addColorStop(0.65, 'rgba(96, 0, 130, 0.12)');
        g.addColorStop(1, 'rgba(255, 59, 93, 0.23)');
        graph.fillStyle = g;
        graph.fillRect(0, 0, screen.width, screen.height);
        graph.strokeStyle = 'rgba(255, 90, 128, 0.55)';
        graph.lineWidth = 5;
        graph.strokeRect(8, 8, screen.width - 16, screen.height - 16);
        graph.font = 'bold 14px sans-serif';
        graph.fillStyle = 'rgba(255, 210, 230, 0.65)';
        graph.textAlign = 'center';
        graph.fillText('FINAL COLLAPSE: BEACON ACTIVATION WINDOW OPEN', screen.width / 2, 34);
    }
    graph.restore();
};

const drawPhaseImpact = (effect, graph, screen) => {
    if (!effect || !effect.receivedAt) return;
    const age = Date.now() - effect.receivedAt;
    const alpha = Math.max(0, 1 - age / 2600);
    graph.save();
    graph.globalAlpha = alpha;
    graph.textAlign = 'center';
    graph.textBaseline = 'middle';
    graph.font = '900 46px sans-serif';
    graph.shadowBlur = 24;
    graph.shadowColor = effect.id === 'singularity-collapse' ? '#ff5a80' : '#b45cff';
    graph.fillStyle = effect.id === 'singularity-collapse' ? '#ffd65c' : '#d9a6ff';
    graph.fillText('PHASE ' + effect.chapter, screen.width / 2, screen.height * 0.31);
    graph.font = '900 28px sans-serif';
    graph.fillStyle = '#ffffff';
    graph.fillText(effect.name, screen.width / 2, screen.height * 0.31 + 46);
    graph.restore();
};

const drawErrorMessage = (message, graph, screen) => {
    graph.fillStyle = '#050814';
    graph.fillRect(0, 0, screen.width, screen.height);
    graph.textAlign = 'center';
    graph.fillStyle = '#FFFFFF';
    graph.font = 'bold 30px sans-serif';
    graph.fillText(message, screen.width / 2, screen.height / 2);
}

module.exports = {
    drawFood,
    drawVirus,
    drawFireFood,
    drawCells,
    drawErrorMessage,
    drawGrid,
    drawBorder,
    drawSabotagePulse,
    drawBeacon,
    drawPhaseAtmosphere,
    drawPhaseImpact
};
