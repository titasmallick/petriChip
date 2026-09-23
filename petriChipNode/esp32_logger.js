const fs = require('fs');
const http = require('http');

const ESP32_IP = process.argv[2] || '192.168.0.100';
const ESP32_URL = `http://${ESP32_IP}/api/state`;
const LOG_FILE = 'esp32_evolution_log.csv';
const LOG_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const POLL_INTERVAL_MS = 2000; // Poll every 2 seconds to catch extinctions

// Initialize CSV header if it doesn't exist
if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, "timestamp,extinctions,pop,births,deaths,avg_size,avg_speed,avg_vision,max_lineage,max_age,max_energy,food_count,poison_count,radiation,day_cycle,epoch_age_sec\n");
}

let lastLogTime = 0;
let lastExtinctions = -1;

console.log(`\n======================================================`);
console.log(` 📡 ESP32 Telemetry Logger Started`);
console.log(`======================================================`);
console.log(` Target IP : ${ESP32_IP}`);
console.log(` Log File  : ${LOG_FILE}`);
console.log(` Interval  : Every ${LOG_INTERVAL_MS / 60000} minutes AND on every Extinction`);
console.log(` Polling   : Every ${POLL_INTERVAL_MS / 1000} seconds\n`);

function fetchState() {
    http.get(ESP32_URL, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            try {
                const state = JSON.parse(data);
                processState(state);
            } catch (e) {
                // Occasional truncated JSON from chunked transfer or buffer overflow
                // We just silently ignore and wait for the next 2-second poll to keep the terminal clean.
            }
        });
    }).on('error', (err) => {
        process.stdout.write(`\r[Connection Error] Unable to reach ${ESP32_IP} - retrying...       `);
    });
}

function processState(data) {
    const now = Date.now();
    let forceLog = false;
    
    // Check for extinctions (detect when e increases)
    if (lastExtinctions !== -1 && data.e > lastExtinctions) {
        console.log(`\n[!] 💀 Extinction Event Detected! (Gen ${lastExtinctions} -> ${data.e})`);
        forceLog = true;
    }
    lastExtinctions = data.e;
    
    // Log if forced or interval reached
    if (forceLog || lastLogTime === 0 || now - lastLogTime >= LOG_INTERVAL_MS) {
        lastLogTime = now;
        
        // Safely extract data with fallbacks for NaN/undefined
        const e = data.e || 0;
        const a = data.a || 0;
        const b = data.b || 0;
        const d = data.d || 0;
        const asz = typeof data.asz === 'number' ? data.asz : 0;
        const asp = typeof data.asp === 'number' ? data.asp : 0;
        const avi = typeof data.avi === 'number' ? data.avi : 0;
        const mL = data.mL || 0;
        const mA = data.mA || 0;
        const mE = typeof data.mE === 'number' ? data.mE : 0;
        const fC = data.fC || 0;
        const pC = data.pC || 0;
        const rad = data.rad || 0;
        const day = typeof data.day === 'number' ? data.day : 0;
        const age = data.age || 0;
        
        const csvLine = `${new Date().toISOString()},${e},${a},${b},${d},${asz.toFixed(3)},${asp.toFixed(3)},${avi.toFixed(1)},${mL},${mA},${mE.toFixed(1)},${fC},${pC},${rad},${day.toFixed(2)},${age}\n`;
        
        try {
            fs.appendFileSync(LOG_FILE, csvLine);
            process.stdout.write(`\r[${new Date().toLocaleTimeString()}] 💾 Logged: Pop ${a} | Gen ${e} | Max Age ${mA}t | Max Lineage ${mL} | Max Energy ${mE.toFixed(1)}      `);
        } catch(err) {
            console.error("\nWarning: Could not write to CSV log. Is it open in another program?", err.message);
        }
    } else {
        // Just print a passive live update so the user knows it's connected and listening
        const a = data.a || 0;
        const e = data.e || 0;
        const mA = data.mA || 0;
        const mL = data.mL || 0;
        const mE = data.mE || 0;
        process.stdout.write(`\r[Listening...] Pop: ${a}/50 | Gen: ${e} | Max Age: ${mA}t | Max Lineage: ${mL} | Max Energy: ${mE.toFixed(1)}           `);
    }
}

// Start polling
setInterval(fetchState, POLL_INTERVAL_MS);
fetchState();
