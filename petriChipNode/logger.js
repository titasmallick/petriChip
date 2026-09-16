const io = require('socket.io-client');
const fs = require('fs');
const socket = io('http://localhost:3000');

const LOG_FILE = 'evolution_log.csv';
const LOG_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes (600,000 ms)

// Write CSV header if file doesn't exist
if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, 'timestamp,gen,pop,births,deaths,food,poison,max_lineage,avg_size,avg_speed,avg_connects\n');
}

let lastLogTime = 0;

socket.on('connect', () => {
    console.log(`[${new Date().toLocaleTimeString()}] Logger connected to simulation server. Waiting for state data...`);
});

socket.on('state', (data) => {
    const now = Date.now();
    // Also trigger on the very first packet to ensure it works immediately
    if (lastLogTime === 0 || now - lastLogTime >= LOG_INTERVAL_MS) {
        lastLogTime = now;
        
        let gen = data.e;
        let pop = data.a;
        let births = data.b;
        let deaths = data.d;
        let food = data.fC;
        let poison = data.pC;
        let maxLineage = data.mL;
        let avgSize = data.asz;
        let avgSpeed = data.asp;
        let avgConnects = data.aconn;

        let csvLine = `${new Date().toISOString()},${gen},${pop},${births},${deaths},${food},${poison},${maxLineage},${avgSize.toFixed(3)},${avgSpeed.toFixed(3)},${avgConnects.toFixed(1)}\n`;
        
        fs.appendFileSync(LOG_FILE, csvLine);
        console.log(`[${new Date().toLocaleTimeString()}] Logged data to ${LOG_FILE} (Pop: ${pop}, Lineage: ${maxLineage})`);
    }
});

socket.on('disconnect', () => {
    console.log(`[${new Date().toLocaleTimeString()}] Disconnected from simulation server.`);
});
