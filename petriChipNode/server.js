require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

app.get('/api/history', (req, res) => {
    if (fs.existsSync('evolution_log.csv')) {
        const path = require('path');
        res.sendFile(path.resolve('evolution_log.csv'));
    } else {
        res.status(404).send("No data yet");
    }
});

// --- LOGGING & AI CONSTANTS ---
const LOG_FILE = 'evolution_log.csv';
const LOG_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const AI_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
let lastLogTime = 0;
let lastAiTime = Date.now();
let lastAiAnalysis = "No AI analysis performed yet. Waiting for enough data (runs every 30 mins).";

if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, 'timestamp,gen,pop,births,deaths,food,poison,max_lineage,avg_size,avg_speed,avg_connects,max_age,max_energy\n');
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

let creatures = [];
let items = [];

function randomFloat(min, max) {
    return min + Math.random() * (max - min);
}

function initEcosystem() {
    aliveCount = 0;
    epochStartMillis = Date.now();
    
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
        let alive = (i < 100);
        

        let c = {
            x: alive ? randomFloat(50, ARENA_SIZE - 50) : 0,
            y: alive ? randomFloat(50, ARENA_SIZE - 50) : 0,
            angle: randomFloat(0, Math.PI * 2),
            energy: 200.0,
            alive: alive,
            hue: Math.floor(Math.random() * 360),
            age: 0,
            lineage: 0,
            gene_speed: randomFloat(0.5, 3.0),
            gene_vision: randomFloat(30.0, 150.0),
            gene_size: randomFloat(0.5, 2.5),
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
    if (aliveCount === 0) {
        extinctions++;
        initEcosystem();
        return;
    }

    // Food Replenishment
    if (Math.random() < 0.20) { // 20% chance to spawn food every tick on massive board
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
        
        c.angle += omega;
        c.x += Math.cos(c.angle) * v;
        c.y += Math.sin(c.angle) * v;
        
        if (c.x < 0) { c.x = 0; c.angle += Math.PI; }
        if (c.x > ARENA_SIZE) { c.x = ARENA_SIZE; c.angle += Math.PI; }
        if (c.y < 0) { c.y = 0; c.angle += Math.PI; }
        if (c.y > ARENA_SIZE) { c.y = ARENA_SIZE; c.angle += Math.PI; }
        
        // Metabolism
        let baselineCost = 0.015 * c.gene_size; // Reduced for 200fps
        let movementCost = (Math.abs(leftMotor) + Math.abs(rightMotor)) * 0.005 * c.gene_size;
        let visionCost = (c.gene_vision * c.gene_vision) * 0.000001;
        let ageTax = c.age * 0.00001; // Scaled down for 200 ticks/sec
        let brainTax = c.brain.conns.length * 0.0001; 
        c.energy -= (baselineCost + movementCost + visionCost + ageTax + brainTax);

        // Eating
        let mouthSize = 15.0 * c.gene_size;
        for (let f = 0; f < NUM_ITEMS; f++) {
            if (items[f].active) {
                let dx = items[f].x - c.x;
                let dy = items[f].y - c.y;
                if (dx*dx + dy*dy < mouthSize * mouthSize) {
                    items[f].active = false;
                    c.energy += (items[f].type === 1) ? 60.0 : -80.0;
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
                            c.energy -= 40; c2.energy -= 40;
                            let child = creatures[empty];
                            child.energy = 80; child.x = c.x; child.y = c.y;
                            child.angle = randomFloat(0, Math.PI*2);
                            child.age = 0;
                            child.mem.fill(0); // Clear memory at birth
                            child.lineage = Math.max(c.lineage, c2.lineage) + 1;
                            child.alive = true;
                            aliveCount++; totalBirths++;
                            
                            child.brain = crossoverBrain(c.brain, c2.brain);
                            child.brain = mutateBrain(child.brain, envRadiation);
                            
                            child.hue = (c.hue + c2.hue)/2.0 + randomFloat(-10, 10);
                            child.gene_speed = (c.gene_speed + c2.gene_speed)/2.0 + randomFloat(-0.1, 0.1);
                            child.gene_vision = (c.gene_vision + c2.gene_vision)/2.0 + randomFloat(-5, 5);
                            child.gene_size = (c.gene_size + c2.gene_size)/2.0 + randomFloat(-0.1, 0.1);
                            
                            if (child.hue < 0) child.hue += 360; if (child.hue > 360) child.hue -= 360;
                            child.gene_speed = Math.max(0.5, Math.min(4.0, child.gene_speed));
                            child.gene_vision = Math.max(20.0, Math.min(200.0, child.gene_vision));
                            child.gene_size = Math.max(0.5, Math.min(2.5, child.gene_size));
                        }
                    } else {
                        // Symbiosis
                        let total = c.energy + c2.energy;
                        c.energy = total/2; c2.energy = total/2;
                    }
                } else {
                    // Predation / Combat
                    if (c.gene_size > c2.gene_size * 1.5 && c.energy > c2.energy) {
                        c.energy += 30; c2.energy -= 60;
                    } else if (c2.gene_size > c.gene_size * 1.5 && c2.energy > c.energy) {
                        c2.energy += 30; c.energy -= 60;
                    } else {
                        c.energy -= 10; c2.energy -= 10;
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
        let mitosis_barrier = 220.0 * c.gene_size;
        if (c.energy > mitosis_barrier) {
            let empty = creatures.findIndex(x => !x.alive);
            if (empty !== -1) {
                let child = creatures[empty];
                child.x = c.x + randomFloat(-30, 30); child.y = c.y + randomFloat(-30, 30);
                child.angle = randomFloat(0, 2*Math.PI);
                child.energy = 80;
                child.age = 0;
                child.mem.fill(0); // Clear memory at birth!
                child.lineage = c.lineage + 1;
                c.energy -= 120;
                child.alive = true;
                aliveCount++; totalBirths++;
                
                let saltChance = 0.05 + (envRadiation * 0.01);
                
                if (Math.random() < saltChance) child.hue = Math.floor(Math.random() * 360);
                else child.hue = c.hue + randomFloat(-10, 10);
                if (child.hue < 0) child.hue += 360; if (child.hue > 360) child.hue -= 360;
                
                child.gene_speed = c.gene_speed + randomFloat(-0.1, 0.1);
                child.gene_vision = c.gene_vision + randomFloat(-5, 5);
                child.gene_size = c.gene_size + randomFloat(-0.1, 0.1);
                
                child.gene_speed = Math.max(0.5, Math.min(4.0, child.gene_speed));
                child.gene_vision = Math.max(20.0, Math.min(200.0, child.gene_vision));
                child.gene_size = Math.max(0.5, Math.min(2.5, child.gene_size));
                
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

    let payloadCreatures = [];
    for(let i=0; i<MAX_CREATURES; i++) {
        if (creatures[i].alive) {
            let c = creatures[i];
            sumSize += c.gene_size; sumSpeed += c.gene_speed; sumConn += c.brain.conns.length; count++;
            if (c.age > maxAge) maxAge = c.age;
            if (c.lineage > maxLineage) maxLineage = c.lineage;
            if (c.energy > maxEnergy) { maxEnergy = c.energy; alphaIndex = i; }
            payloadCreatures.push([Math.round(c.x), Math.round(c.y), Number(c.angle.toFixed(2)), 1, Math.round(c.hue)]);
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

    io.emit('state', {
        e: extinctions, a: count, b: totalBirths, d: totalDeaths,
        asz: asz, asp: asp, aconn: aconn,
        rad: envRadiation, alpha: alphaIndex, age: epochAge,
        mE: maxEnergy, mA: maxAge, mL: maxLineage,
        fC: foodCount, pC: poisonCount,
        c: payloadCreatures, f: payloadItems,
        arenaSize: ARENA_SIZE
    });

    let now = Date.now();
    
    // --- CSV LOGGING ---
    if (lastLogTime === 0 || now - lastLogTime >= LOG_INTERVAL_MS) {
        lastLogTime = now;
        let csvLine = `${new Date().toISOString()},${extinctions},${count},${totalBirths},${totalDeaths},${foodCount},${poisonCount},${maxLineage},${asz.toFixed(3)},${asp.toFixed(3)},${aconn.toFixed(1)},${maxAge},${maxEnergy.toFixed(1)}\n`;
        fs.appendFileSync(LOG_FILE, csvLine);
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
});

server.listen(3000, () => {
    console.log('Node.js Petri Chip running wildly on http://localhost:3000');
});
