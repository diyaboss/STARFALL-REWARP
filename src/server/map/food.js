"use strict";

const util = require('../lib/util');
const { v4: uuidv4 } = require('uuid');
const {getPosition} = require("../lib/entityUtils");

class Food {
    constructor(position, radius, kind = 'stardust', massGain = 1) {
        this.id = uuidv4();
        this.x = position.x;
        this.y = position.y;
        this.radius = radius;
        this.kind = kind;
        this.massGain = massGain;
        this.mass = Math.max(1, massGain);
        this.hue = kind === 'shard' ? 278 : Math.round(185 + Math.random() * 75);
        this.vx = 0;
        this.vy = 0;
        if (kind === 'drone' || kind === 'rogueShip') {
            const angle = Math.random() * Math.PI * 2;
            const baseSpeed = kind === 'rogueShip' ? 0.65 : 0.8;
            const speed = baseSpeed + Math.random() * (kind === 'rogueShip' ? 1.15 : 1.6);
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed;
            this.hue = kind === 'rogueShip' ? Math.round(15 + Math.random() * 45) : this.hue;
        }
    }
}

exports.FoodManager = class {
    constructor(foodMass, foodUniformDisposition) {
        this.data = [];
        this.foodMass = foodMass;
        this.foodUniformDisposition = foodUniformDisposition;
    }

    addNew(number) {
        const radius = util.massToRadius(this.foodMass) * 0.65;
        while (number--) {
            const position = getPosition(this.foodUniformDisposition, radius, this.data)
            this.data.push(new Food(position, radius, 'stardust', this.foodMass));
        }
    }

    addDrones(number, droneMassGain) {
        const radius = util.massToRadius(droneMassGain) * 0.85;
        while (number--) {
            const position = getPosition(false, radius, this.data);
            this.data.push(new Food(position, radius, 'drone', droneMassGain));
        }
    }

    addRogueShips(number, rogueShipMassGain) {
        const radius = util.massToRadius(rogueShipMassGain) * 0.62;
        while (number--) {
            const position = getPosition(false, radius, this.data);
            this.data.push(new Food(position, radius, 'rogueShip', rogueShipMassGain));
        }
    }

    addShards(number) {
        const radius = 13;
        while (number--) {
            const position = getPosition(false, radius, this.data);
            this.data.push(new Food(position, radius, 'shard', 0));
        }
    }

    addShardsNear(x, y, number, gameWidth, gameHeight) {
        const radius = 18;
        while (number--) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 120 + Math.random() * 520;
            const position = {
                x: x + Math.cos(angle) * distance,
                y: y + Math.sin(angle) * distance
            };
            this.data.push(new Food(position, radius, 'shard', 0));
        }
    }

    addDronesNear(x, y, number, gameWidth, gameHeight, droneMassGain) {
        const radius = util.massToRadius(droneMassGain) * 0.85;
        while (number--) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 260 + Math.random() * 760;
            const position = {
                x: x + Math.cos(angle) * distance,
                y: y + Math.sin(angle) * distance
            };
            this.data.push(new Food(position, radius, 'drone', droneMassGain));
        }
    }

    addRogueShipsNear(x, y, number, gameWidth, gameHeight, rogueShipMassGain) {
        const radius = util.massToRadius(rogueShipMassGain) * 0.62;
        while (number--) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 360 + Math.random() * 980;
            const position = {
                x: x + Math.cos(angle) * distance,
                y: y + Math.sin(angle) * distance
            };
            this.data.push(new Food(position, radius, 'rogueShip', rogueShipMassGain));
        }
    }

    addStorm(x, y, amount, gameWidth, gameHeight) {
        while (amount--) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 320;
            const radius = util.massToRadius(this.foodMass) * 0.7;
            const position = {
                x: x + Math.cos(angle) * distance,
                y: y + Math.sin(angle) * distance
            };
            this.data.push(new Food(position, radius, 'stardust', this.foodMass));
        }
    }

    moveNeutralShips(gameWidth, gameHeight) {
        for (const item of this.data) {
            if (item.kind !== 'drone' && item.kind !== 'rogueShip') continue;
            item.x += item.vx;
            item.y += item.vy;

            if (Math.random() < 0.012) {
                const angle = Math.random() * Math.PI * 2;
                const baseSpeed = item.kind === 'rogueShip' ? 0.45 : 0.8;
                const speed = baseSpeed + Math.random() * (item.kind === 'rogueShip' ? 0.75 : 1.6);
                item.vx = Math.cos(angle) * speed;
                item.vy = Math.sin(angle) * speed;
            }

            // No hard wall. Drifter ships can float beyond the old arena edge.
            // If they wander extremely far, nudge them back toward the relay lanes instead of snapping.
            const centerX = gameWidth / 2;
            const centerY = gameHeight / 2;
            const far = Math.max(gameWidth, gameHeight) * 2;
            if (Math.abs(item.x - centerX) > far || Math.abs(item.y - centerY) > far) {
                const angleHome = Math.atan2(centerY - item.y, centerX - item.x);
                const speedHome = Math.max(0.6, Math.hypot(item.vx, item.vy));
                item.vx = Math.cos(angleHome) * speedHome;
                item.vy = Math.sin(angleHome) * speedHome;
            }
        }
    }

    removeExcess(number) {
        while (number-- && this.data.length) {
            const removableIndex = this.data.findIndex(item => item.kind === 'stardust');
            if (removableIndex > -1) this.data.splice(removableIndex, 1);
            else this.data.pop();
        }
    }

    delete(foodsToDelete) {
        if (foodsToDelete.length > 0) {
            this.data = util.removeIndexes(this.data, foodsToDelete);
        }
    }
};
