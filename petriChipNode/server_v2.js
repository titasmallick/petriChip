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
let envRadiation = 0;
let globalFertilizer = 500.0; // Biogeochemical cycle currency
let globalEra = 0; // 0: Normal, 1: Ice Age, 2: Greenhouse Drought
let eraTicks = 0;
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
    globalFertilizer = 500.0; // Reset biogeochemical cycle on mass extinction
    globalEra = 0; eraTicks = 0; // Reset to Holocene
    season = 0; seasonTicks = 0; // Reset to Spring
    
    // Spawn massive amounts of food and poison
    items = [];
    for(let i = 0; i < NUM_ITEMS; i++) {
        items.push({
            x: randomFloat(50, ARENA_SIZE - 50),
            y: randomFloat(50, ARENA_SIZE - 50),
            type: (Math.random() < 0.25) ? -1 : 1, // 25% poison
            active: true
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
            energy: 400.0,
            alive: alive,
            hue: Math.floor(Math.random() * 360),
            age: 0,
            lineage: 0,
            gene_speed: randomFloat(0.5, 3.0),
            gene_vision: randomFloat(30.0, 150.0),
            gene_size: randomFloat(0.5, 2.5),
            gene_insulation: randomFloat(0.0, 1.0),
            gene_immunity: randomFloat(0.0, 1.0),
            gene_chloroplast: 0.0, // Start as simple heterotrophs (chemotrophs)
            gene_scavenger: 0.0,
            gene_carnivore: 0.0,
            infected: false,
            viralLoad: 0.0,
            brain: buildBrain(), // NEAT Brain!
            mem: new Array(8).fill(0)
        };

        if (alive) aliveCount++;
        creatures.push(c);
    }
}

// --- NEAT LITE ARCHITECTURE ---
// Node IDs: 0-7 (Sensors), 8-15 (Mem In), 16-17 (Motors), 18-25 (Mem Out), 26+ (Hidden)
function buildBrain() {
    let brain = { maxNode: 25, conns: [] };
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
        newMem: newNodes.slice(18, 26)
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
    globalFertilizer += 10.0;
    if (globalFertilizer > 10000.0) globalFertilizer = 10000.0;

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
        globalEra = Math.floor(Math.random() * 3);
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
    
    if (Math.random() < foodSpawnRate && globalFertilizer > 0) {
        globalFertilizer -= 1.0; // 20% chance to spawn food every tick on massive board
        for (let f = 0; f < NUM_ITEMS; f++) {
            if (!items[f].active) {
                items[f].x = randomFloat(20, ARENA_SIZE - 20);
                items[f].y = randomFloat(20, ARENA_SIZE - 20);
                items[f].type = 1;
                items[f].active = true;
                break;
            }
        }
    }

    for (let i = 0; i < MAX_CREATURES; i++) {
        if (!creatures[i].alive) continue;
        
        let c = creatures[i];
        c.age++;
        
        let inputs = getSensors(c);
        let out = processBrain(c.brain, inputs, c.mem);
        
        c.mem = out.newMem; // Save memory state for next tick!
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
                c.energy += (c.gene_chloroplast * 0.1); 
                if (Math.random() < 0.01) globalFertilizer -= 1.0; 
            }
        }
        
        if (c.x < 0) { c.x = 0; c.angle += Math.PI; }
        if (c.x > ARENA_SIZE) { c.x = ARENA_SIZE; c.angle += Math.PI; }
        if (c.y < 0) { c.y = 0; c.angle += Math.PI; }
        if (c.y > ARENA_SIZE) { c.y = ARENA_SIZE; c.angle += Math.PI; }
        
        // Metabolism
        let baselineCost = 0.05 * c.gene_size; // Increased baseline to prevent infinite camping // Reduced for 200fps
        let movementCost = (Math.abs(leftMotor) + Math.abs(rightMotor)) * 0.005 * c.gene_size;
        let visionCost = (c.gene_vision * c.gene_vision) * 0.000001;
        let ageTax = c.age * 0.00001; // Scaled down for 200 ticks/sec
        let brainTax = c.brain.conns.length * 0.0001; 
        
        let heatMultiplier = (globalEra === 2) ? 2.0 : (globalEra === 1 ? 0.5 : 1.0);
        let freezeMultiplier = (globalEra === 1) ? 2.0 : (globalEra === 2 ? 0.5 : 1.0);
        
        let tempPenalty = 0;
        if (season === 1) tempPenalty = c.gene_insulation * 0.05 * heatMultiplier; // Summer overheating
        if (season === 3) tempPenalty = (1.0 - c.gene_insulation) * 0.1 * freezeMultiplier; // Winter freezing
        
        c.energy -= (baselineCost + movementCost + visionCost + ageTax + brainTax + tempPenalty);

        // Eating
        let mouthSize = 15.0 * c.gene_size;
        for (let f = 0; f < NUM_ITEMS; f++) {
            if (items[f].active) {
                let dx = items[f].x - c.x;
                let dy = items[f].y - c.y;
                if (dx*dx + dy*dy < mouthSize * mouthSize) {
                    items[f].active = false;
                    if (items[f].type === 1) {
                        c.energy += 60.0 * (1.0 - c.gene_carnivore);
                    } else {
                        c.energy += (-80.0 + (140.0 * c.gene_scavenger)); 
                        globalFertilizer += 1.0; 
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
                
                let hueDiff = Math.abs(c.hue - c2.hue);
                if (hueDiff > 180) hueDiff = 360 - hueDiff;
                
                if (hueDiff < 20) {
                    // Mating
                    let mateI = 150.0 * c.gene_size; // Increased threshold
                    let mateJ = 150.0 * c2.gene_size;
                    if (c.energy > mateI && c2.energy > mateJ && Math.abs(c.gene_size - c2.gene_size) < 0.5) {
                        let empty = creatures.findIndex(x => !x.alive);
                        if (empty !== -1) {
                            c.energy -= (40.0 * c.gene_size); 
                            c2.energy -= (40.0 * c2.gene_size);
                            let child = creatures[empty];
                            child.x = c.x; child.y = c.y;
                            child.angle = randomFloat(0, Math.PI*2);
                            child.age = 0;
                            child.mem.fill(0); // Clear memory at birth
                            child.familyId = Math.random() < 0.5 ? c.familyId : c2.familyId; // Inherit family
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
                            child.gene_insulation = Math.max(0.0, Math.min(1.0, child.gene_insulation));
                            child.gene_immunity = Math.max(0.0, Math.min(1.0, child.gene_immunity));
                            child.infected = false; child.viralLoad = 0;

                            
                            child.gene_speed = Math.max(0.5, Math.min(4.0, child.gene_speed));
                            child.gene_vision = Math.max(20.0, Math.min(200.0, child.gene_vision));
                            child.gene_size = Math.max(0.5, Math.min(2.5, child.gene_size));
                            
                            child.energy = 80.0 * child.gene_size;
                        }
                    } else {
                        // Symbiosis & Crowding Penalty
                        let total = c.energy + c2.energy;
                        c.energy = total/2; c2.energy = total/2;
                        // If they are clumped up on top of each other, they steal each other's sunlight and starve!
                        c.energy -= 2.0; c2.energy -= 2.0; 
                    }
                } else {
                    // Predation / Combat
                    if (c.gene_size > c2.gene_size * 1.5 && c.energy > c2.energy) {
                        let meat = Math.min(Math.max(0, c2.energy), 60.0 * c.gene_carnivore);
                        c.energy += meat; c2.energy -= (60.0 * c.gene_carnivore);
                    } else if (c2.gene_size > c.gene_size * 1.5 && c2.energy > c.energy) {
                        let meat = Math.min(Math.max(0, c.energy), 60.0 * c2.gene_carnivore);
                        c2.energy += meat; c.energy -= (60.0 * c2.gene_carnivore);
                    } else {
                        c.energy -= 10; c2.energy -= 10;
                        // Viral transmission on contact
                        if (c.infected && Math.random() < c.viralLoad) c2.infected = true;
                        if (c2.infected && Math.random() < c2.viralLoad) c.infected = true;

                    }
                }
            }
        }
        
        // Random disease/death (scaled for 200fps to mean 1 death per 1000 seconds on avg per unit)
        if (Math.random() < 0.00001) c.energy = -1;
        
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
            // Drop poison
            let emptyF = items.findIndex(x => !x.active);
            if (emptyF !== -1) {
                items[emptyF].x = c.x; items[emptyF].y = c.y; items[emptyF].type = -1; items[emptyF].active = true;
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
                child.mem.fill(0); // Clear memory at birth!
                child.familyId = c.familyId; // Inherit family
                child.lineage = c.lineage + 1;
                c.energy -= (200.0 * c.gene_size);
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
                child.gene_carnivore = Math.max(0.0, Math.min(1.0, c.gene_carnivore + randomFloat(-0.05, 0.05)));
                child.gene_insulation = Math.max(0.0, Math.min(1.0, child.gene_insulation));
                child.gene_immunity = Math.max(0.0, Math.min(1.0, child.gene_immunity));
                child.infected = false; child.viralLoad = 0;

                
                child.gene_speed = Math.max(0.5, Math.min(4.0, child.gene_speed));
                child.gene_vision = Math.max(20.0, Math.min(200.0, child.gene_vision));
                child.gene_size = Math.max(0.5, Math.min(2.5, child.gene_size));
                
                child.energy = 80.0 * child.gene_size; // Child energy scales with its new body size
                
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
    let sumImm = 0, sumIns = 0, infectedPop = 0, sumChloro = 0, sumScav = 0, sumCarn = 0;

    let payloadCreatures = [];
    for(let i=0; i<MAX_CREATURES; i++) {
        if (creatures[i].alive) {
            let c = creatures[i];
            sumSize += c.gene_size; sumSpeed += c.gene_speed; sumConn += c.brain.conns.length; count++;
            sumImm += c.gene_immunity; sumIns += c.gene_insulation; if (c.infected) infectedPop++; sumChloro += c.gene_chloroplast; sumScav += c.gene_scavenger; sumCarn += c.gene_carnivore;
            if (c.age > maxAge) maxAge = c.age;
            if (c.lineage > maxLineage) maxLineage = c.lineage;
            if (c.energy > maxEnergy) { maxEnergy = c.energy; alphaIndex = i; }
            let trophic = 3;
            if (c.gene_chloroplast > 0.5) trophic = 1;
            else if (c.gene_carnivore > 0.5) trophic = 4;
            else if (c.gene_scavenger > 0.5) trophic = 2;
            payloadCreatures.push([Math.round(c.x), Math.round(c.y), Number(c.angle.toFixed(2)), Number(c.gene_size.toFixed(2)), Math.round(c.hue), c.infected ? 1 : 0, trophic, Math.round(c.gene_vision), c.familyId]);
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
        let csvLine = `${new Date().toISOString()},${extinctions},${count},${totalBirths},${totalDeaths},${foodCount},${poisonCount},${maxLineage},${asz.toFixed(3)},${asp.toFixed(3)},${aconn.toFixed(1)},${maxAge},${maxEnergy.toFixed(1)},${season},${aimm.toFixed(3)},${ains.toFixed(3)},${infectedPop},${achloro.toFixed(3)},${ascav.toFixed(3)},${acarn.toFixed(3)},${globalFertilizer.toFixed(1)}\n`;
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
            if (Math.random() < 0.9) creatures[i].energy = -1; // 90% death rate
        }
        for (let i = 0; i < items.length; i++) {
            if (items[i].type === 1 && Math.random() < 0.9) items[i].active = false; // Vaporize food
        }
    });
});

server.listen(3000, () => {
    console.log('Node.js Petri Chip running wildly on http://localhost:3000');
});
