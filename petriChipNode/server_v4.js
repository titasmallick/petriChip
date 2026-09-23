require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

// --- LOGGING & AI CONSTANTS ---
const LOG_FILE = 'evolution_v2_log.csv';
const LOG_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const AI_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index_v4.html'));
});

app.get('/api/history', (req, res) => {
    if (fs.existsSync(LOG_FILE)) {
        let content = fs.readFileSync(LOG_FILE, 'utf8');
        res.send(content);
    } else {
        res.status(404).send("No data yet");
    }
});


const serverStartTime = Date.now();
let lastLogTime = 0;
let forceLog = false;
let lastAiTime = Date.now();
let lastAiAnalysis = "No AI analysis performed yet. Waiting for enough data (runs every 30 mins).";

if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, 'timestamp,gen,pop,births,deaths,food,poison,max_lineage,avg_size,avg_speed,avg_connects,max_age,max_energy,season,avg_immunity,avg_insulation,infected_pop,avg_chloroplast,avg_scavenger,avg_carnivore,fertilizer\n');
}

// --- SIMULATION CONSTANTS ---
const ARENA_SIZE = 3000;
const MAX_CREATURES = 600;
const NUM_ITEMS = 1500;
const TICK_RATE_MS = 5; // 200 ticks per second (10x faster than ESP32!)
const BROADCAST_RATE_MS = 50; // Update UI 20 times per second

let totalBirths = 0;
let totalDeaths = 0;
let extinctions = 0;
let aliveCount = 0;
let epochStartMillis = Date.now();
let envRadiation = getGeoState(geologicEpoch).radBoost;
let globalFertilizer = 10000.0;
let geologicEpoch = 0;

function getGeoState(epoch) {
    let cycle = epoch % 70000;
    if (cycle < 10000) return { name: "Primordial Soup", seaLevel: -0.15, sizeCap: 2.5, radBoost: 15, coldTax: 0, heatTax: 0.1 };
    if (cycle < 25000) return { name: "Snowball Earth", seaLevel: 0.2, sizeCap: 2.5, radBoost: 0, coldTax: 0.4, heatTax: 0 };
    if (cycle < 40000) return { name: "Cambrian Bloom", seaLevel: 0, sizeCap: 3.0, radBoost: 0, coldTax: 0.05, heatTax: 0.05 };
    if (cycle < 55000) return { name: "Carboniferous (High O2)", seaLevel: 0.1, sizeCap: 5.0, radBoost: 0, coldTax: 0, heatTax: 0 };
    if (cycle < 58000) return { name: "The Great Dying (Permian)", seaLevel: -0.1, sizeCap: 2.0, radBoost: 5, coldTax: 0, heatTax: 0.5 };
    return { name: "Cenozoic (Modern)", seaLevel: 0, sizeCap: 2.5, radBoost: 0, coldTax: 0.05, heatTax: 0.05 };
}

function getElevation(x, y) {
    let state = getGeoState(geologicEpoch);
    return Math.sin(x/400 + geologicEpoch*0.001) * Math.cos(y/400 - geologicEpoch*0.0005) + Math.sin(x/150 + y/150)*0.2 + state.seaLevel;
}

let globalEra = 0; // 0: Normal, 1: Ice Age, 2: Greenhouse Drought
let eraTicks = 0;

    // Geological Event Triggers
    let curState = getGeoState(geologicEpoch);
    if (curState.name === \'The Great Dying (Permian)\' && Math.random() < 0.05) {
        // Toxic rain converts food to poison rapidly
        let fIdx = items.findIndex(i => i.active && i.type === 1);
        if (fIdx !== -1) items[fIdx].type = -1; 
    }
    let season = 0; // 0=Spring, 1=Summer, 2=Autumn, 3=Winter
let seasonTicks = 0;

let creatures = [];
let items = [];

function randomFloat(min, max) {
    return min + Math.random() * (max - min);
}

function initEcosystem() {
    aliveCount = 0;
    epochStartMillis = Date.now();
    globalFertilizer = 10000.0; // Reset biogeochemical cycle
    globalEra = 0; eraTicks = 0; // Reset to Holocene
    season = 0; seasonTicks = 0; // Reset to Spring
    
    // Spawn initial seed of food/poison, leaving plenty of empty slots for corpses and blooms
    items = [];
    for(let i = 0; i < NUM_ITEMS; i++) {
        let shouldBeActive = (i < 400); // Only seed 400 items so the array isn't instantly full
        items.push({
            x: randomFloat(50, ARENA_SIZE - 50),
            y: randomFloat(50, ARENA_SIZE - 50),
            type: (Math.random() < 0.25) ? -1 : 1,
            active: shouldBeActive
        });
    }

    // Genesis Event - 100 random ancestors
    creatures = [];
    for(let i = 0; i < MAX_CREATURES; i++) {
        let alive = (i < 400); // Increased from 100 to 400
        

        let c = {
            id: i, // Unique ID
            familyId: i, // Genesis root family
            x: alive ? randomFloat(50, ARENA_SIZE - 50) : 0, // Scattered across entire map
            y: alive ? randomFloat(50, ARENA_SIZE - 50) : 0,
            angle: randomFloat(0, Math.PI * 2),
            energy: 1000.0, // Give them enough time to wander and find food on a massive board
            alive: alive,
            hue: Math.floor(Math.random() * 360),
            age: 0,
            lineage: 0,
            gene_speed: randomFloat(0.5, 3.0),
            gene_vision: randomFloat(100.0, 200.0), // High initial vision to prevent immediate starvation
            gene_size: randomFloat(0.5, 2.5),
            gene_insulation: randomFloat(0.0, 1.0),
            gene_immunity: randomFloat(0.0, 1.0),
            gene_chloroplast: 0.0, // Start as simple heterotrophs (chemotrophs)
            gene_scavenger: 0.0,
            gene_carnivore: 0.0,
            infected: false,
            viralLoad: 0.0,
            brain: buildBrain(), // NEAT Brain!
            mem: new Array(8).fill(0),
            intent: 0.0,
            aggression: 0.0
        };

        if (alive) aliveCount++;
        creatures.push(c);
    }
}

// --- NEAT LITE ARCHITECTURE ---
// Node IDs: 0-7 (Sensors), 8-15 (Mem In), 16-17 (Motors), 18 (Reproductive Intent), 19 (Aggression/Bite), 20-27 (Mem Out), 28+ (Hidden)
function buildBrain() {
    let brain = { maxNode: 27, conns: [] };
    // Start with 1 to 5 random rudimentary instinct wires
    let startConns = Math.floor(randomFloat(1, 6));
    for(let i=0; i<startConns; i++) {
        let isFirst = (i === 0);
        brain.conns.push({
            in: Math.floor(Math.random() * 16),
            out: isFirst ? (Math.floor(Math.random() * 2) + 16) : (Math.floor(Math.random() * 10) + 16),
            w: randomFloat(-1.0, 1.0)
        });
    }
    return brain;
}

function processBrain(brain, inputs, mem) {
    let nodes = new Array(brain.maxNode + 1).fill(0);
    for(let i=0; i<8; i++) nodes[i] = inputs[i];
    for(let i=0; i<8; i++) nodes[8+i] = mem[i];
    
    let newNodes = [...nodes];
    
    // Evaluate connections
    for(let c of brain.conns) {
        newNodes[c.out] += nodes[c.in] * c.w;
    }
    
    // Activation (Tanh)
    for(let i=16; i<=brain.maxNode; i++) {
        newNodes[i] = Math.tanh(newNodes[i]);
    }
    
    
    return {
        motors: [newNodes[16], newNodes[17]],
        intent: newNodes[18],
        aggression: newNodes[19],
        mimicry: newNodes[26] || 0.0,
        newMem: newNodes.slice(20, 28)
    };

}

function mutateBrain(brain, rad) {
    let b = { maxNode: brain.maxNode, conns: JSON.parse(JSON.stringify(brain.conns)) };
    let mutSev = 0.1 + (rad * 0.01);
    
    let r = Math.random();
    if (r < 0.5) {
        // Mutate Weights (50% chance)
        for(let c of b.conns) {
            if(Math.random() < 0.2) {
                c.w += randomFloat(-mutSev, mutSev);
                c.w = Math.max(-5.0, Math.min(5.0, c.w)); // Prevent infinite weight drift
            }
        }
    } else if (r < 0.7 && b.conns.length > 0) {
        // DELETE CONNECTION (Pruning - 20% chance)
        let cIdx = Math.floor(Math.random() * b.conns.length);
        b.conns.splice(cIdx, 1);
    } else if (r < 0.85 && b.conns.length > 0 && b.maxNode < 200) {
        // ADD NODE (Split a wire - 15% chance, capped at 200 nodes for memory safety)
        let cIdx = Math.floor(Math.random() * b.conns.length);
        let oldC = b.conns[cIdx];
        b.maxNode++;
        b.conns.push({ in: oldC.in, out: b.maxNode, w: 1.0 });
        b.conns.push({ in: b.maxNode, out: oldC.out, w: oldC.w });
        b.conns.splice(cIdx, 1);
    } else {
        // ADD CONNECTION (New wire - 15% chance)
        let src = Math.floor(Math.random() * (b.maxNode + 1));
        let dst = Math.floor(Math.random() * (b.maxNode - 15)) + 16;
        if (!b.conns.find(c => c.in === src && c.out === dst)) {
            b.conns.push({ in: src, out: dst, w: randomFloat(-1.0, 1.0) });
        }
    }
    return b;
}

function crossoverBrain(b1, b2) {
    let child = { maxNode: Math.max(b1.maxNode, b2.maxNode), conns: [] };
    let map = {};
    for(let c of b1.conns) map[`${c.in}-${c.out}`] = { ...c };
    for(let c of b2.conns) {
        let key = `${c.in}-${c.out}`;
        if (map[key]) {
            if (Math.random() < 0.5) map[key].w = c.w; // 50/50 chance for weight
        } else {
            if (Math.random() < 0.5) map[key] = { ...c }; // Inherit disjoint 50% of the time
        }
    }
    child.conns = Object.values(map);
    return child;
}
// --- END NEAT ---

function getSensors(c) {
    let inputs = new Array(8).fill(0);
    let minFoodD = c.gene_vision * c.gene_vision, minPoisonD = c.gene_vision * c.gene_vision, minCreatureD = c.gene_vision * c.gene_vision;
    let v2 = c.gene_vision * c.gene_vision;

    for (let f = 0; f < NUM_ITEMS; f++) {
        if (!items[f].active) continue;
        
        // Corpses decay over time, returning their 60 mass to the soil
        if (items[f].type === -1 && Math.random() < 0.0001) {
            items[f].active = false;
            globalFertilizer += 60.0;
            continue;
        }
        let dx = items[f].x - c.x;
        let dy = items[f].y - c.y;
        let d2 = dx*dx + dy*dy;
        
        if (d2 < v2) {
            let relativeAngle = Math.atan2(dy, dx) - c.angle;
            while(relativeAngle > Math.PI) relativeAngle -= 2*Math.PI;
            while(relativeAngle < -Math.PI) relativeAngle += 2*Math.PI;
            
            if (items[f].type === 1 && d2 < minFoodD) {
                minFoodD = d2;
                inputs[0] = 1.0 - (Math.sqrt(d2) / c.gene_vision);
                inputs[1] = relativeAngle / Math.PI;
            } else if (items[f].type === -1 && d2 < minPoisonD) {
                minPoisonD = d2;
                inputs[2] = 1.0 - (Math.sqrt(d2) / c.gene_vision);
                inputs[3] = relativeAngle / Math.PI;
            }
        }
    }

    for (let j = 0; j < MAX_CREATURES; j++) {
        if (!creatures[j].alive || creatures[j] === c) continue;
        let dx = creatures[j].x - c.x;
        let dy = creatures[j].y - c.y;
        let d2 = dx*dx + dy*dy;
        if (d2 < minCreatureD) {
            minCreatureD = d2;
            let relativeAngle = Math.atan2(dy, dx) - c.angle;
            while(relativeAngle > Math.PI) relativeAngle -= 2*Math.PI;
            while(relativeAngle < -Math.PI) relativeAngle += 2*Math.PI;
            inputs[4] = 1.0 - (Math.sqrt(d2) / c.gene_vision);
            inputs[5] = relativeAngle / Math.PI;
        }
    }

    inputs[6] = c.energy / 200.0;
    inputs[7] = c.age / 1000.0;
    return inputs;
}

function tickPhysics() {
    // Geological nutrient cycle
    // globalFertilizer += 10.0; // Removed for conservation of mass
    // Removed hard cap on globalFertilizer to preserve total ecosystem mass after extinctions

    if (aliveCount === 0 && (Date.now() - epochStartMillis) > 2000) {
        forceLog = true;
        extinctions++;
        initEcosystem();
        return;
    }

    // Food Replenishment
    
    // Season Logic
    eraTicks++;
    if (eraTicks > 36000) { // ~15 minutes real-time for an Epoch shift
        // Milankovitch Cycle (Orbital eccentricity driving predictable climate shifts)
        // Progression: Holocene (0) -> Ice Age (1) -> Holocene (0) -> Greenhouse (2) -> Holocene (0)
        if (globalEra === 1 || globalEra === 2) {
            globalEra = 0; // Extreme periods always recede back to a temperate interglacial (Holocene)
        } else {
            // If in Holocene, flip a coin to determine which extreme the orbit swings towards next
            globalEra = Math.random() < 0.5 ? 1 : 2;
        }
        eraTicks = 0;
    }
    
    seasonTicks++;
    if (seasonTicks > 3000) { // ~2 minutes real time per season
        season = (season + 1) % 4;
        seasonTicks = 0;
        // Trigger a random viral outbreak in Winter
        if (season === 3 && Math.random() < 0.5) {
            let targets = creatures.filter(c => c.alive && !c.infected);
            if (targets.length > 0) {
                targets[Math.floor(Math.random()*targets.length)].infected = true;
                targets[Math.floor(Math.random()*targets.length)].viralLoad = 1.0;
            }
        }
    }
    
    let foodSpawnRate = 0.20;
    if (globalEra === 1) foodSpawnRate *= 0.5; // Ice age kills global food
    if (globalEra === 2) foodSpawnRate *= 0.8; // Drought reduces food
    if (season === 0) foodSpawnRate = 0.40; // Spring bloom
    if (season === 3) foodSpawnRate = 0.05; // Winter famine
    
    // True Dynamic Bloom: Soil richness mathematically dictates food spawn volume
    let maxPotentialFood = Math.floor(globalFertilizer / 60.0);
    let expectedSpawns = maxPotentialFood * 0.05 * foodSpawnRate; 
    let spawnsThisTick = Math.floor(expectedSpawns);
    if (Math.random() < (expectedSpawns - spawnsThisTick)) spawnsThisTick++; // Probabilistic fractional spawn
    
    for (let i = 0; i < spawnsThisTick; i++) {
        let emptySlot = items.findIndex(x => !x.active);
        if (emptySlot !== -1 && globalFertilizer >= 60.0) {
            globalFertilizer -= 60.0;
            items[emptySlot].x = randomFloat(20, ARENA_SIZE - 20);
            items[emptySlot].y = randomFloat(20, ARENA_SIZE - 20);
            items[emptySlot].type = 1;
            items[emptySlot].active = true;
        } else {
            break;
        }
    }

    for (let i = 0; i < MAX_CREATURES; i++) {
        if (!creatures[i].alive) continue;
        
        let c = creatures[i];
        c.age++;
        
        let inputs = getSensors(c);
        let out = processBrain(c.brain, inputs, c.mem);
        
        
        // 1. BIOLUMINESCENT MIMICRY (Active Camouflage)
        c.hue += out.mimicry * 5.0;
        if (c.hue > 360) c.hue -= 360; 
        if (c.hue < 0) c.hue += 360;

        // 2. CORDYCEPS MIND CONTROL OVERRIDE
        if (c.infected && closestCreatIdx !== -1) {
            // Parasite hijacks the nervous system, sprinting towards healthy organisms to spread!
            let target = creatures[closestCreatIdx];
            let angleToTarget = Math.atan2(target.y - c.y, target.x - c.x);
            c.angle = angleToTarget;
            out.motors[0] = 1.0; 
            out.motors[1] = 1.0;
            out.aggression = 1.0; // Force them to attack/spread
            c.energy -= 1.0; // Rapid metabolic burnout
        }

        c.mem = out.newMem; // Save memory state for next tick!
        c.intent = out.intent;
        c.aggression = out.aggression;

        let leftMotor = out.motors[0] * c.gene_speed;
        let rightMotor = out.motors[1] * c.gene_speed;
        
        let v = (leftMotor + rightMotor) / 2.0;
        let omega = (rightMotor - leftMotor) / 10.0;
        
        v *= (1.0 - c.gene_chloroplast); // Producers are rooted/slow
        c.angle += omega;
        c.x += Math.cos(c.angle) * v;
        c.y += Math.sin(c.angle) * v;
        
        if (season === 0 || season === 1) {
            if (c.gene_chloroplast > 0.2 && globalFertilizer > 0) {
                let energyGained = c.gene_chloroplast * 0.1;
                // Strict Conservation of Mass
                c.energy += energyGained;
                globalFertilizer -= energyGained; 
            }
        }
        
        if (c.x < 0) { c.x = 0; c.angle += Math.PI; }
        if (c.x > ARENA_SIZE) { c.x = ARENA_SIZE; c.angle += Math.PI; }
        if (c.y < 0) { c.y = 0; c.angle += Math.PI; }
        if (c.y > ARENA_SIZE) { c.y = ARENA_SIZE; c.angle += Math.PI; }
        
        // Metabolism (Kleiber's Law Allometric Scaling)
        let baselineCost = 0.05 * Math.pow(c.gene_size, 0.75); // S^0.75 basal metabolic rate
        let actualV = Math.abs(v);
        let movementCost = c.gene_size * actualV * actualV * 0.01; // S * v^2 kinetic energy drag
        let visionCost = (c.gene_vision * c.gene_vision) * 0.000001;
        let ageTax = c.age * 0.00001; 
        let brainTax = c.brain.conns.length * 0.0001; 
        
        let heatMultiplier = (globalEra === 2) ? 2.0 : (globalEra === 1 ? 0.5 : 1.0);
        let freezeMultiplier = (globalEra === 1) ? 2.0 : (globalEra === 2 ? 0.5 : 1.0);
        
        let tempPenalty = 0;
        if (season === 1) tempPenalty = c.gene_insulation * 0.05 * heatMultiplier; // Summer overheating
        if (season === 3) tempPenalty = (1.0 - c.gene_insulation) * 0.1 * freezeMultiplier; // Winter freezing
        
        // Viral Replication & Immune Drain
        let viralTax = 0;
        if (c.infected) {
            c.viralLoad += 0.005 * (1.0 - c.gene_immunity); // Virus replicates faster in weak hosts
            c.viralLoad = Math.min(1.0, c.viralLoad);
            viralTax = c.viralLoad * 0.5 * (1.0 - c.gene_immunity); // Fever/Metabolic drain
            
            // Immune system fights back (Chance to clear infection)
            if (Math.random() < (c.gene_immunity * 0.001)) {
                c.infected = false;
                c.viralLoad = 0.0;
            }
        }
        
        let totalCost = baselineCost + movementCost + visionCost + ageTax + brainTax + tempPenalty + viralTax;
        c.energy -= totalCost;
        globalFertilizer += totalCost; // Geochemical loop: 100% of burned energy returns to soil (Perfect Conservation)

        // Eating
        let mouthSize = 15.0 * c.gene_size;
        for (let f = 0; f < NUM_ITEMS; f++) {
            if (items[f].active) {
                let dx = items[f].x - c.x;
                let dy = items[f].y - c.y;
                if (dx*dx + dy*dy < mouthSize * mouthSize) {
                    items[f].active = false;
                    if (items[f].type === 1) {
                        let energyGained = 60.0 * (1.0 - c.gene_carnivore);
                        c.energy += energyGained;
                        globalFertilizer += (60.0 - energyGained); // Return undigested mass to soil
                    } else {
                        let energyGained = -80.0 + (140.0 * c.gene_scavenger);
                        c.energy += energyGained;
                        globalFertilizer += (60.0 - energyGained); // Conserve corpse mass and poisoned energy loss
                    }
                }
            }
        }

        // Mating / Predation / Symbiosis
        for (let j = i + 1; j < MAX_CREATURES; j++) {
            if (!creatures[j].alive) continue;
            let c2 = creatures[j];
            let dx = c.x - c2.x;
            let dy = c.y - c2.y;
            let dist2 = dx*dx + dy*dy;
            let collideDist = 100.0 * ((c.gene_size + c2.gene_size) / 2.0);
            
            if (dist2 < collideDist) {
                // Anti-clumping pushback
                c.x += dx * 0.05; c.y += dy * 0.05;
                c2.x -= dx * 0.05; c2.y -= dy * 0.05;
                
                // True Kin Recognition (Hamilton's Rule via Neural Net, not Hue) & Predation Intent
                if (c.intent > 0 && c2.intent > 0) {
                    // Mating (Both consent via Output 18)
                    let mateI = 150.0 * c.gene_size; 
                    let mateJ = 150.0 * c2.gene_size;
                    if (c.energy > mateI && c2.energy > mateJ && Math.abs(c.gene_size - c2.gene_size) < 0.5) {
                        let empty = creatures.findIndex(x => !x.alive);
                        if (empty !== -1) {
                            let cost1 = 40.0 * c.gene_size;
                            let cost2 = 40.0 * c2.gene_size;
                            c.energy -= cost1; 
                            c2.energy -= cost2;
                            let child = creatures[empty];
                            child.x = c.x; child.y = c.y;
                            child.angle = randomFloat(0, Math.PI*2);
                            child.age = 0;
                            child.mem.fill(0);
                            child.intent = 0.0; child.aggression = 0.0; 
                            child.familyId = Math.random() < 0.5 ? c.familyId : c2.familyId; 
                            child.lineage = Math.max(c.lineage, c2.lineage) + 1;
                            child.alive = true;
                            aliveCount++; totalBirths++;
                            
                            child.brain = crossoverBrain(c.brain, c2.brain);
                            child.brain = mutateBrain(child.brain, envRadiation);
                            
                            let saltChance = 0.05 + (envRadiation * 0.01);
                            
                            if (Math.random() < saltChance) child.hue = Math.floor(Math.random() * 360);
                            else child.hue = (c.hue + c2.hue) / 2.0 + randomFloat(-10, 10);
                            if (child.hue < 0) child.hue += 360; if (child.hue > 360) child.hue -= 360;
                            
                            child.gene_speed = (c.gene_speed + c2.gene_speed) / 2.0 + randomFloat(-0.1, 0.1);
                            child.gene_vision = (c.gene_vision + c2.gene_vision) / 2.0 + randomFloat(-5, 5);
                            child.gene_size = (c.gene_size + c2.gene_size) / 2.0 + randomFloat(-0.1, 0.1);
                            child.gene_insulation = (c.gene_insulation + c2.gene_insulation) / 2.0 + randomFloat(-0.05, 0.05);
                            child.gene_immunity = (c.gene_immunity + c2.gene_immunity) / 2.0 + randomFloat(-0.05, 0.05);
                            child.gene_chloroplast = Math.max(0.0, Math.min(1.0, (c.gene_chloroplast + c2.gene_chloroplast) / 2.0 + randomFloat(-0.05, 0.05)));
                            child.gene_scavenger = Math.max(0.0, Math.min(1.0, (c.gene_scavenger + c2.gene_scavenger) / 2.0 + randomFloat(-0.05, 0.05)));
                            child.gene_carnivore = Math.max(0.0, Math.min(1.0, (c.gene_carnivore + c2.gene_carnivore) / 2.0 + randomFloat(-0.05, 0.05)));
                            
                            // Trophic Mutual Exclusivity (The Polymath Paradox)
                            let trophicSum = child.gene_chloroplast + child.gene_scavenger + child.gene_carnivore;
                            if (trophicSum > 1.0) {
                                child.gene_chloroplast /= trophicSum;
                                child.gene_scavenger /= trophicSum;
                                child.gene_carnivore /= trophicSum;
                            }
                            
                            child.gene_insulation = Math.max(0.0, Math.min(1.0, child.gene_insulation));
                            child.gene_immunity = Math.max(0.0, Math.min(1.0, child.gene_immunity));
                            child.infected = false; child.viralLoad = 0;
                            
                            child.gene_speed = Math.max(0.5, Math.min(4.0, child.gene_speed));
                            child.gene_vision = Math.max(20.0, Math.min(200.0, child.gene_vision));
                            child.gene_size = Math.max(0.5, Math.min(getGeoState(geologicEpoch).sizeCap, child.gene_size));
                            
                            child.energy = cost1 + cost2;
                        }
                    } else {
                        // Symbiosis & Crowding Penalty
                        let total = c.energy + c2.energy;
                        c.energy = total/2; c2.energy = total/2;
                        c.energy -= 2.0; c2.energy -= 2.0; 
                    }
                } else if (c.aggression > 0 || c2.aggression > 0) {
                    // Predation / Combat (Only if they actively decide to attack via Output 19)
                    if (c.aggression > c2.aggression && c.gene_carnivore > 0.1 && c.gene_size > c2.gene_size * 1.2) {
                        c.energy -= 5; // Cost of attack
                        
                        if (c.gene_parasite > 0.8 && c.energy > 300) {
                            // 4. XENOMORPH PARASITISM: Impregnate the prey instead of eating it!
                            c2.impregnatedBy = c.familyId;
                            c2.parasitePayload = JSON.parse(JSON.stringify({
                                hue: c.hue, gene_speed: c.gene_speed, gene_vision: c.gene_vision, gene_size: c.gene_size,
                                gene_insulation: c.gene_insulation, gene_immunity: c.gene_immunity, gene_parasite: c.gene_parasite,
                                gene_aquatic: c.gene_aquatic, gene_scavenger: c.gene_scavenger, gene_carnivore: c.gene_carnivore,
                                brain: c.brain
                            }));
                            c.energy -= 200; // Cost of laying the egg
                        } else {
                            let meat = Math.min(Math.max(0, c2.energy), 60.0 * c.gene_carnivore);
                            c.energy += meat; c2.energy -= meat;
                        }

                    } else if (c2.aggression > c.aggression && c2.gene_carnivore > 0.1 && c2.gene_size > c.gene_size * 1.2) {
                        c2.energy -= 5; // Cost of attack
                        
                        if (c2.gene_parasite > 0.8 && c2.energy > 300) {
                            // XENOMORPH PARASITISM
                            c.impregnatedBy = c2.familyId;
                            c.parasitePayload = JSON.parse(JSON.stringify({
                                hue: c2.hue, gene_speed: c2.gene_speed, gene_vision: c2.gene_vision, gene_size: c2.gene_size,
                                gene_insulation: c2.gene_insulation, gene_immunity: c2.gene_immunity, gene_parasite: c2.gene_parasite,
                                gene_aquatic: c2.gene_aquatic, gene_scavenger: c2.gene_scavenger, gene_carnivore: c2.gene_carnivore,
                                brain: c2.brain
                            }));
                            c2.energy -= 200;
                        } else {
                            let meat = Math.min(Math.max(0, c.energy), 60.0 * c2.gene_carnivore);
                            c2.energy += meat; c.energy -= meat;
                        }

                    } else {
                        c.energy -= 10; c2.energy -= 10; // Mutual scuffle cost
                        // Viral transmission on contact (Resisted by gene_immunity)
                        if (c.infected && Math.random() < c.viralLoad * (1.0 - c2.gene_immunity)) c2.infected = true;
                        if (c2.infected && Math.random() < c2.viralLoad * (1.0 - c.gene_immunity)) c.infected = true;
                    }
                }
            }
        }
        
        // Senescence (Age & Mass-related mortality curve)
        // Older and larger organisms have a higher chance of spontaneous heart failure/cancer
        let mortalityChance = 0.000001 * (c.age / 1000.0) * c.gene_size;
        if (Math.random() < mortalityChance) {
            globalFertilizer += Math.max(0, c.energy); // Return remaining life force to the soil
            c.energy = -1;
        }
        
        if (c.energy <= 0) {
            c.alive = false;
            aliveCount--;
            totalDeaths++;
            if (aliveCount === 0) {
                forceLog = true;
                extinctions++;
                initEcosystem();
                return;
            }
            // Strict Mass Conservation & Decomp
            globalFertilizer += Math.max(0, c.energy); // Return residual energy to soil
            let emptyF = items.findIndex(x => !x.active);
            if (emptyF !== -1) {
                globalFertilizer -= 60.0; // Materialize corpse mass
                items[emptyF].x = c.x; items[emptyF].y = c.y; items[emptyF].type = -1; items[emptyF].active = true;
            } else {
                // If items array is full of food, corpse instantly dissolves into soil
                // (Mass is perfectly conserved since we don't deduct 60)
            }
            continue;
        }

        // Mitosis
        let mitosis_barrier = 300.0 * c.gene_size; // Raised to slow down explosive cloning
        if (c.energy > mitosis_barrier) {
            let empty = creatures.findIndex(x => !x.alive);
            if (empty !== -1) {
                let child = creatures[empty];
                child.x = c.x + randomFloat(-30, 30); child.y = c.y + randomFloat(-30, 30);
                child.angle = randomFloat(0, 2*Math.PI);
                child.age = 0;
                child.mem.fill(0);
                            child.intent = 0.0; child.aggression = 0.0; // Clear memory at birth!
                child.familyId = c.familyId; // Inherit family
                child.lineage = c.lineage + 1;
                let asexualCost = 200.0 * c.gene_size; c.energy -= asexualCost;
                child.alive = true;
                aliveCount++; totalBirths++;
                
                let saltChance = 0.05 + (envRadiation * 0.01);
                
                if (Math.random() < saltChance) child.hue = Math.floor(Math.random() * 360);
                else child.hue = c.hue + randomFloat(-10, 10);
                if (child.hue < 0) child.hue += 360; if (child.hue > 360) child.hue -= 360;
                
                child.gene_speed = c.gene_speed + randomFloat(-0.1, 0.1);
                child.gene_vision = c.gene_vision + randomFloat(-5, 5);
                child.gene_size = c.gene_size + randomFloat(-0.1, 0.1);
                child.gene_insulation = c.gene_insulation + randomFloat(-0.05, 0.05);
                child.gene_immunity = c.gene_immunity + randomFloat(-0.05, 0.05);
                child.gene_chloroplast = Math.max(0.0, Math.min(1.0, c.gene_chloroplast + randomFloat(-0.05, 0.05)));
                child.gene_scavenger = Math.max(0.0, Math.min(1.0, c.gene_scavenger + randomFloat(-0.05, 0.05)));
                child.gene_aquatic = Math.max(0.0, Math.min(1.0, c.gene_aquatic + randomFloat(-0.05, 0.05)));
                            child.gene_parasite = Math.max(0.0, Math.min(1.0, c.gene_parasite + randomFloat(-0.05, 0.05)));
                child.gene_carnivore = Math.max(0.0, Math.min(1.0, c.gene_carnivore + randomFloat(-0.05, 0.05)));
                
                let trophicSum = child.gene_chloroplast + child.gene_scavenger + child.gene_carnivore;
                if (trophicSum > 1.0) {
                    child.gene_chloroplast /= trophicSum;
                    child.gene_scavenger /= trophicSum;
                    child.gene_carnivore /= trophicSum;
                }
                
                child.gene_insulation = Math.max(0.0, Math.min(1.0, child.gene_insulation));
                child.gene_immunity = Math.max(0.0, Math.min(1.0, child.gene_immunity));
                child.infected = false; child.viralLoad = 0;

                
                child.gene_speed = Math.max(0.5, Math.min(4.0, child.gene_speed));
                child.gene_vision = Math.max(20.0, Math.min(200.0, child.gene_vision));
                child.gene_size = Math.max(0.5, Math.min(getGeoState(geologicEpoch).sizeCap, child.gene_size));
                
                child.energy = asexualCost; // Strict mass conservation
                
                child.brain = mutateBrain(c.brain, envRadiation);
                if(Math.random() < saltChance) child.brain = buildBrain(); // Saltation restarts brain
            } else {
                c.energy = 160; // Cap energy if world is overpopulated
            }
        }
    }
}

// Stats & Broadcast
function broadcastState() {
    let alphaIndex = -1, maxEnergy = -1, maxAge = 0, maxLineage = 0;
    let sumSize = 0, sumSpeed = 0, sumConn = 0, count = 0;
    let sumImm = 0, sumIns = 0, infectedPop = 0, sumChloro = 0, sumScav = 0, sumCarn = 0, sumAquatic = 0;

    let payloadCreatures = [];
    for(let i=0; i<MAX_CREATURES; i++) {
        if (creatures[i].alive) {
            let c = creatures[i];
            sumSize += c.gene_size; sumSpeed += c.gene_speed; sumConn += c.brain.conns.length; count++;
            sumImm += c.gene_immunity; sumAquatic += c.gene_aquatic; sumIns += c.gene_insulation; if (c.infected) infectedPop++; sumChloro += c.gene_chloroplast; sumScav += c.gene_scavenger; sumCarn += c.gene_carnivore;
            if (c.age > maxAge) maxAge = c.age;
            if (c.lineage > maxLineage) maxLineage = c.lineage;
            if (c.energy > maxEnergy) { maxEnergy = c.energy; alphaIndex = i; }
            let trophic = 3;
            if (c.gene_chloroplast > 0.5) trophic = 1;
            else if (c.gene_carnivore > 0.5) trophic = 4;
            else if (c.gene_scavenger > 0.5) trophic = 2;
            payloadCreatures.push([Math.round(c.x), Math.round(c.y), Number(c.angle.toFixed(2)), Number(c.gene_size.toFixed(2)), Math.round(c.hue), c.infected ? 1 : 0, c.gene_aquatic > 0.5 ? 5 : trophic, Math.round(c.gene_vision), c.familyId]);
        }
    }

    let foodCount = 0, poisonCount = 0;
    let payloadItems = [];
    for(let i=0; i<NUM_ITEMS; i++) {
        if(items[i].active) {
            if(items[i].type === 1) foodCount++; else poisonCount++;
            payloadItems.push([Math.round(items[i].x), Math.round(items[i].y), items[i].type]);
        }
    }

    let epochAge = Math.floor((Date.now() - epochStartMillis) / 1000);
    
    let asz = count ? sumSize/count : 0;
    let asp = count ? sumSpeed/count : 0;
    let aconn = count ? sumConn/count : 0;
    let aimm = count ? sumImm/count : 0;
    let ains = count ? sumIns/count : 0;
    let achloro = count ? sumChloro/count : 0;
    let ascav = count ? sumScav/count : 0;
    let acarn = count ? sumCarn/count : 0;

    io.emit('state', {
        e: extinctions, a: count, b: totalBirths, d: totalDeaths,
        asz: asz, asp: asp, aconn: aconn,
        achloro: achloro, ascav: ascav, acarn: acarn, aimm: aimm, ains: ains, fert: globalFertilizer,
        rad: envRadiation, alpha: alphaIndex, age: epochAge,
        mE: maxEnergy, mA: maxAge, mL: maxLineage,
        fC: foodCount, pC: poisonCount,
        c: payloadCreatures, f: payloadItems,
        arenaSize: ARENA_SIZE,
        startT: serverStartTime,
        era: globalEra,
        season: season
    });

    let now = Date.now();
    
    // --- CSV LOGGING ---
    if (forceLog || lastLogTime === 0 || now - lastLogTime >= LOG_INTERVAL_MS) {
        lastLogTime = now;
        forceLog = false; // Reset the flag
        let aaquatic = (count>0)?sumAquatic/count:0;
          let csvLine = `${new Date().toISOString()},${extinctions},${count},${totalBirths},${totalDeaths},${foodCount},${poisonCount},${maxLineage},${asz.toFixed(3)},${asp.toFixed(3)},${aconn.toFixed(1)},${maxAge},${maxEnergy.toFixed(1)},${season},${aimm.toFixed(3)},${ains.toFixed(3)},${infectedPop},${achloro.toFixed(3)},${ascav.toFixed(3)},${acarn.toFixed(3)},${globalFertilizer.toFixed(1)},${aaquatic.toFixed(3)}\n`;
        try {
            fs.appendFileSync(LOG_FILE, csvLine);
        } catch(e) {
            console.error("Warning: Could not write to CSV log. Is the file open in Excel?", e.message);
        }
    }
    
    // --- GEMINI AI LOOP ---
    if (now - lastAiTime >= AI_INTERVAL_MS) {
        lastAiTime = now;
        runAiAnalysis();
    }
}

async function runAiAnalysis() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return;
    try {
        let csvData = fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE, 'utf8') : "No data yet.";
        // only keep last 50 lines to save tokens
        let lines = csvData.split('\n');
        if (lines.length > 51) {
            csvData = lines[0] + '\n' + lines.slice(-50).join('\n');
        }
        
        const prompt = `You are an evolutionary biologist analyzing an artificial life simulation. The dataset below represents the last few hours of evolution (Pop: active population, gen: extinctions, max_lineage: highest unbroken family tree, avg_connects: neural network size). Analyze what biological phenomena are playing out (like insular dwarfism, red queen hypothesis, carrying capacity), what recent changes occurred, and predict what happens next. Keep it under 250 words and format as clean HTML for a web dashboard. DO NOT use markdown tags (like \`\`\`html), just return the raw HTML string.\n\nDATA:\n${csvData}`;

        let apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;
        
        let reqBody = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] });
        
        let res = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: reqBody });
        
        // Fallback cascade
        if (!res.ok) {
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${apiKey}`;
            res = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: reqBody });
        }
        if (!res.ok) {
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
            res = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: reqBody });
        }
        
        if (res.ok) {
            const data = await res.json();
            let rawText = data.candidates[0].content.parts[0].text;
            // Clean up any potential markdown code blocks (```html ... ```) the AI might generate
            rawText = rawText.replace(/```html/g, '').replace(/```/g, '').trim();
            lastAiAnalysis = rawText;
            io.emit('ai_analysis', lastAiAnalysis);
        }
    } catch (e) {
        console.error("AI Analysis failed:", e);
    }
}

// Start simulation loops
initEcosystem();
setInterval(tickPhysics, TICK_RATE_MS);
setInterval(broadcastState, BROADCAST_RATE_MS);

io.on('connection', (socket) => {
    // Send immediate AI state
    socket.emit('ai_analysis', lastAiAnalysis);
    
    // Radiation burst event
    socket.on('trigger_radiation', () => {
        envRadiation = 50; // Severe mutation rate!
        io.emit('radiation_warning', true);
        setTimeout(() => { 
            envRadiation = 0; 
            io.emit('radiation_warning', false);
        }, 10000);
    });
    
    // Divine Intervention (Click to feed)
    socket.on('divine_intervention', (coords) => {
        // Drop a cluster of 3 food items at the mouse click!
        for(let j=0; j<3; j++) {
            let empty = items.findIndex(x => !x.active);
            if (empty !== -1) {
                items[empty] = {
                    x: coords.x + (Math.random() * 40 - 20),
                    y: coords.y + (Math.random() * 40 - 20),
                    type: 1, // Food
                    active: true
                };
            }
        }
    });

    // Meteor strike event
    socket.on('trigger_meteor', () => {
        io.emit('meteor_warning');
        for (let i = 0; i < creatures.length; i++) {
            if (creatures[i].alive && Math.random() < 0.9) { globalFertilizer += Math.max(0, creatures[i].energy); creatures[i].energy = -1; }
        }
        for (let i = 0; i < items.length; i++) {
            if (items[i].type === 1 && Math.random() < 0.9) { items[i].active = false; globalFertilizer += 60.0; } // Vaporize food (Returns mass as ash)
        }
    });
});

server.listen(3000, () => {
    console.log('Node.js Petri Chip running wildly on http://localhost:3000');
});
