
        const window = { lastGen: undefined, logEvent: function(){}, selectedFamilyId: -1, lastM: -1, lastB: -1 };
        const document = { 
            createElement: function(tag) { return { innerHTML: '', style: {} }; },
            getElementById: function(id) { 
                return { 
                    addEventListener: function(){}, appendChild: function(){}, prepend: function(){}, innerText: '', style: {}, 
                    getContext: function(){ 
                        return { clearRect:function(){}, fillText:function(){}, fillRect:function(){}, beginPath:function(){}, arc:function(){}, fill:function(){}, stroke:function(){}, moveTo:function(){}, lineTo:function(){}, closePath:function(){}, save:function(){}, restore:function(){}, translate:function(){}, rotate:function(){}, strokeRect:function(){}, scale:function(){}, setLineDash:function(){}, createLinearGradient:function(){return {addColorStop:function(){}};} }; 
                    }, getBoundingClientRect: function(){ return {left:0, top:0, width:100, height:100}; } 
                }; 
            },
            body: { style: {} }
        };
        const Math = global.Math;
        let handlers = {};
        const io = function() { return { on: function(evt, cb) { handlers[evt] = cb; }, emit: function(){} }; };
        
    const socket = io();
    const canvas = document.getElementById('arena');
    const ctx = canvas.getContext('2d');
    
    const gCanvas = document.getElementById('graph');
    const gCtx = gCanvas.getContext('2d');
    
    // Fill with empty bucket objects so mapping p.total doesn't return NaN
    let popHistory = new Array(1200).fill(null).map(() => ({ total: 0, r: 0, y: 0, g: 0, c: 0, b: 0, m: 0 }));
    
    // Smooth rendering interpolation mapping
    let creatures = [];
    let items = [];
    
    socket.on('state', (data) => {
        document.getElementById('alive').innerText = data.a;
        document.getElementById('exts').innerText = data.e;
        document.getElementById('age').innerText = data.age + "s";
        document.getElementById('births').innerText = data.b;
        document.getElementById('deaths').innerText = data.d;
        document.getElementById('avg-size').innerText = (data.asz || 0).toFixed(2);
        document.getElementById('avg-spd').innerText = (data.asp || 0).toFixed(2);
        document.getElementById('avg-vis').innerText = Math.floor(data.aconn || 0);
        
        document.getElementById('food-cnt').innerText = data.fC;
        document.getElementById('poison-cnt').innerText = data.pC;
        document.getElementById('max-energy').innerText = (data.mE || 0).toFixed(0);
        document.getElementById('max-age').innerText = data.mA || 0;
        document.getElementById('max-lineage').innerText = data.mL || 0;
        
        if (data.startT) {
            let d = new Date(data.startT);
            document.getElementById('start-time').innerText = d.toLocaleString();
        }
        
        if (data.era !== undefined) {
            let eUI = document.getElementById('era-ui');
            if (data.era === 0) { eUI.innerText = '🌍 EPOCH: Holocene (Normal Climate)'; eUI.style.color = '#aaa'; }
            if (data.era === 1) { eUI.innerText = '🧊 EPOCH: ICE AGE (Extreme Freezing, 50% Food)'; eUI.style.color = '#00ffff'; }
            if (data.era === 2) { eUI.innerText = '🔥 EPOCH: GREENHOUSE (Extreme Heatwaves)'; eUI.style.color = '#ff3300'; }
        }
        
        if (data.season !== undefined) {
            let sUI = document.getElementById('season-ui');
            if (data.season === 0) { sUI.innerText = '🌸 SPRING (Abundant Food)'; sUI.style.color = '#ff99cc'; document.body.style.borderTop = '5px solid #ff99cc'; }
            if (data.season === 1) { sUI.innerText = '☀️ SUMMER (Overheating)'; sUI.style.color = '#ffcc00'; document.body.style.borderTop = '5px solid #ffcc00'; }
            if (data.season === 2) { sUI.innerText = '🍂 AUTUMN (Decay)'; sUI.style.color = '#ff9933'; document.body.style.borderTop = '5px solid #ff9933'; }
            if (data.season === 3) { sUI.innerText = '❄️ WINTER (Famine & Viruses)'; sUI.style.color = '#99ccff'; document.body.style.borderTop = '5px solid #99ccff'; }
        }
        
        // Update Graph with Color Buckets (Muller Plot)
        let buckets = { r: 0, y: 0, g: 0, c: 0, b: 0, m: 0 };
        creatures = data.c;
        items = data.f;
        
        creatures.forEach(c => {
            let h = c[4]; // Hue
            if (h >= 330 || h < 30) buckets.r++;
            else if (h >= 30 && h < 90) buckets.y++;
            else if (h >= 90 && h < 150) buckets.g++;
            else if (h >= 150 && h < 210) buckets.c++;
            else if (h >= 210 && h < 270) buckets.b++;
            else buckets.m++;
        });
        
        popHistory.push({ total: data.a, ...buckets });
        if(popHistory.length > 1200) popHistory.shift();
        
        gCtx.clearRect(0, 0, 900, 150);
        
        let maxPop = Math.max(...popHistory.map(p => p.total), 50);
        let barWidth = 900 / 1200;
        
        // Draw Stacked Area Columns
        for(let i=0; i<popHistory.length; i++) {
            let p = popHistory[i];
            let x = i * barWidth;
            let currentY = 150; // Start drawing from the bottom
            
            let colorStacks = [
                { count: p.r, fill: '#ff3333' }, // Red
                { count: p.y, fill: '#ffff33' }, // Yellow
                { count: p.g, fill: '#33ff33' }, // Green
                { count: p.c, fill: '#33ffff' }, // Cyan
                { count: p.b, fill: '#3333ff' }, // Blue
                { count: p.m, fill: '#ff33ff' }  // Magenta
            ];
            
            colorStacks.forEach(col => {
                if (col.count > 0) {
                    let h = (col.count / maxPop) * 130;
                    gCtx.fillStyle = col.fill;
                    gCtx.fillRect(x, currentY - h, Math.ceil(barWidth), h);
                    currentY -= h; // Stack the next color on top
                }
            });
        }
        
        gCtx.fillStyle = "rgba(255, 255, 255, 0.8)";
        gCtx.font = "12px monospace";
        gCtx.fillText("Species Evolution History (Live) - Peak: " + maxPop, 10, 20);
        
        // --- Evolutionary Observer Logic ---
        if (typeof window.lastGen === 'undefined') {
            window.lastGen = data.e;
            window.lastDom = "";
            window.lastLineage = 0;
            window.lastConn = 4;
            window.logEvent = function(msg, color="#fff") {
                let box = document.getElementById('log-box');
                if (!box) return;
                let time = new Date().toLocaleTimeString();
                let entry = document.createElement('div');
                entry.innerHTML = `<span style="color:#555">[${time}]</span> <span style="color:${color}">${msg}</span>`;
                box.appendChild(entry);
                box.scrollTop = box.scrollHeight;
                if(box.childNodes.length > 50) box.removeChild(box.firstChild);
            };
            window.logEvent("Observer Drone online. Monitoring primordial soup...", "#00ffcc");
        }
        
        if (data.e > window.lastGen) {
            window.logEvent(`MASS EXTINCTION EVENT #${data.e}. All life perished. Seeding new primitive ancestors.`, "#ff3333");
            window.lastGen = data.e;
            window.lastLineage = 0;
            window.lastConn = 4;
        }
        
        if (data.mL > window.lastLineage + 10) {
            window.logEvent(`Life is persisting! A lineage has survived ${data.mL} generations deep.`, "#33ff33");
            window.lastLineage = data.mL;
        }
        
        if (data.aconn >= window.lastConn + 2) {
            window.logEvent(`EVOLUTIONARY LEAP: Average brain complexity grew to ${Math.floor(data.aconn)} connections.`, "#ff00ff");
            window.lastConn += 2;
        }
        
        // --- EVOLUTIONARY MILESTONES ---
        window.milestones = window.milestones || { plant: false, carnivore: false, scavenger: false, immune: false, fur: false };
        
        if (data.a > 50) { // Only announce if population is stable
            if (data.achloro > 0.70 && !window.milestones.plant) {
                window.logEvent(`🌿 MILESTONE: The ecosystem is now dominated by Autotrophic Plants!`, "#00ffcc");
                window.milestones.plant = true;
            } else if (data.achloro < 0.50) window.milestones.plant = false;
            
            if (data.acarn > 0.70 && !window.milestones.carnivore) {
                window.logEvent(`🩸 MILESTONE: Apex Predators have taken over the food web!`, "#ff3333");
                window.milestones.carnivore = true;
            } else if (data.acarn < 0.50) window.milestones.carnivore = false;
            
            if (data.ascav > 0.70 && !window.milestones.scavenger) {
                window.logEvent(`🪲 MILESTONE: A massive population of Decomposers has emerged!`, "#999999");
                window.milestones.scavenger = true;
            } else if (data.ascav < 0.50) window.milestones.scavenger = false;
            
            if (data.aimm > 0.75 && !window.milestones.immune) {
                window.logEvent(`🦠 MILESTONE: The population has evolved extreme Viral Immunity!`, "#00ff00");
                window.milestones.immune = true;
            } else if (data.aimm < 0.55) window.milestones.immune = false;
            
            if (data.ains > 0.75 && !window.milestones.fur) {
                window.logEvent(`❄️ MILESTONE: The population has evolved thick fur for Ice Age survival!`, "#ffffff");
                window.milestones.fur = true;
            } else if (data.ains < 0.55) window.milestones.fur = false;
        }
        
        // Find current dominant color
        let currentDom = "None";
        let maxCount = 0;
        for (let col in buckets) {
            if (buckets[col] > maxCount) {
                maxCount = buckets[col];
                currentDom = col;
            }
        }
        
        if (maxCount > 15 && currentDom !== window.lastDom) {
            let colorNames = { r: "Red", y: "Yellow", g: "Green", c: "Cyan", b: "Blue", m: "Magenta" };
            let colorHex = { r: "#ff3333", y: "#ffff33", g: "#33ff33", c: "#33ffff", b: "#3333ff", m: "#ff33ff" };
            if (window.lastDom !== "") {
                window.logEvent(`SPECIES SHIFT: The ${colorNames[currentDom]} strain is aggressively taking over the ecosystem!`, colorHex[currentDom]);
            }
            window.lastDom = currentDom;
        }
        
        // Draw frame directly
        ctx.clearRect(0, 0, 3000, 3000);
        
        // 1. Dynamic Soil Color
        let fert = Math.min(10000, Math.max(0, data.fert || 500));
        let soilG = Math.floor(34 + (fert / 10000) * 30); // Max 64 (rich green)
        let soilR = Math.floor(34 - (fert / 10000) * 10);
        let soilB = Math.floor(34 - (fert / 10000) * 15);
        document.getElementById('arena').style.backgroundColor = `rgb(${soilR}, ${soilG}, ${soilB})`;
        
        // 2. Weather Overlays (Particles)
        window.weatherParticles = window.weatherParticles || [];
        let targetCount = 0; let pColor = 'white'; let pSize = 2; let pDrift = 1;
        if (data.season === 3) { targetCount = 800; pColor = 'rgba(255,255,255,0.8)'; pSize = 3; pDrift = 0; } // Winter Snow
        else if (data.season === 2) { targetCount = 200; pColor = 'rgba(217, 123, 41, 0.8)'; pSize = 4; pDrift = 2; } // Autumn Leaves
        
        while (window.weatherParticles.length < targetCount) {
            window.weatherParticles.push({ x: Math.random() * 3000, y: Math.random() * 3000, vx: (Math.random() - 0.5) * pDrift, vy: Math.random() * 3 + 1, wobbly: Math.random() * 0.1 });
        }
        if (window.weatherParticles.length > targetCount) window.weatherParticles.splice(0, window.weatherParticles.length - targetCount);
        
        ctx.fillStyle = pColor;
        window.weatherParticles.forEach(p => {
            p.x += p.vx + Math.sin(Date.now() * 0.001 * p.wobbly) * 2;
            p.y += p.vy;
            if (p.y > 3000) { p.y = -10; p.x = Math.random() * 3000; }
            if (p.x > 3000) p.x = 0; else if (p.x < 0) p.x = 3000;
            ctx.beginPath(); ctx.arc(p.x, p.y, pSize, 0, Math.PI*2); ctx.fill();
        });
        
        if (data.season === 1 && data.era === 2) { // Greenhouse Summer Heatwave
            ctx.fillStyle = 'rgba(255, 60, 0, 0.05)';
            ctx.fillRect(0, 0, 3000, 3000);
        }
        
        if (data.rad) { // Radiation Active
            ctx.fillStyle = 'rgba(0, 255, 0, 0.08)'; // Toxic Green Wash
            ctx.fillRect(0, 0, 3000, 3000);
            
            // Draw a massive glowing green border
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 20;
            ctx.strokeRect(0, 0, 3000, 3000);
        }
        
        if (window.meteorFlash > 0) {
            ctx.fillStyle = `rgba(255, 140, 0, ${window.meteorFlash})`;
            ctx.fillRect(0, 0, 3000, 3000);
            window.meteorFlash -= 0.05;
        }
        
        // Items & Corpses
        items.forEach(i => {
           if (i[2] === 1) { // Food
               ctx.beginPath();
               ctx.arc(i[0], i[1], 8, 0, Math.PI*2);
               ctx.fillStyle = '#00ffcc';
               ctx.fill();
           } else { // Corpse / Poison
               // Draw tiny crossed bones
               ctx.strokeStyle = '#ff0033';
               ctx.lineWidth = 3;
               ctx.beginPath();
               ctx.moveTo(i[0] - 6, i[1] - 6);
               ctx.lineTo(i[0] + 6, i[1] + 6);
               ctx.moveTo(i[0] + 6, i[1] - 6);
               ctx.lineTo(i[0] - 6, i[1] + 6);
               ctx.stroke();
           }
        });
        
        // Draw Interaction Lines (Mating & Combat Thunderbolts)
        ctx.lineWidth = 2;
        for (let i = 0; i < creatures.length; i++) {
            for (let j = i + 1; j < creatures.length; j++) {
                let c1 = creatures[i], c2 = creatures[j];
                let dx = c1[0] - c2[0], dy = c1[1] - c2[1];
                let distSq = dx*dx + dy*dy;
                
                if (distSq < 1500) { // Touching physically
                    let h1 = c1[4], h2 = c2[4];
                    let hueDiff = Math.abs(h1 - h2);
                    if (hueDiff > 180) hueDiff = 360 - hueDiff;
                    
                    if (hueDiff < 20) {
                        // Kin / Mating
                        ctx.beginPath();
                        ctx.moveTo(c1[0], c1[1]);
                        ctx.lineTo(c2[0], c2[1]);
                        ctx.strokeStyle = 'rgba(255, 105, 180, 0.7)'; // Pink
                        ctx.stroke();
                    } else if (c1[6] === 4 || c2[6] === 4) {
                        // Combat / Predation (Carnivore involved)
                        ctx.beginPath();
                        ctx.moveTo(c1[0], c1[1]);
                        ctx.lineTo(c1[0] - dx*0.5 + 8, c1[1] - dy*0.5 + 8); // Jagged thunderbolt center
                        ctx.lineTo(c2[0], c2[1]);
                        ctx.strokeStyle = 'rgba(255, 30, 30, 0.9)'; // Red lightning
                        ctx.stroke();
                    }
                }
            }
        }

        // Creatures
        creatures.forEach((c, index) => {
            let x = c[0], y = c[1], angle = c[2], size = c[3], hue = c[4], infected = c[5], trophic = c[6], vision = c[7] || 50;
            
            // 3. Draw Vision Radar
            ctx.beginPath();
            ctx.arc(x, y, vision, 0, Math.PI*2);
            ctx.fillStyle = `hsla(${hue}, 100%, 50%, 0.03)`;
            ctx.fill();
            ctx.strokeStyle = `hsla(${hue}, 100%, 50%, 0.1)`;
            ctx.lineWidth = 1;
            ctx.stroke();
            
            // Highlight selected family lineage
            if (window.selectedFamilyId !== -1 && c[8] === window.selectedFamilyId) {
                ctx.beginPath();
                ctx.arc(x, y, size * 15, 0, Math.PI*2);
                ctx.strokeStyle = `hsl(${hue}, 100%, 80%)`;
                ctx.lineWidth = 4;
                ctx.stroke();
                
                // Draw connecting lines to nearby family members
                for (let j = index + 1; j < creatures.length; j++) {
                    let kin = creatures[j];
                    if (kin[8] === window.selectedFamilyId) {
                        let dist = Math.hypot(x - kin[0], y - kin[1]);
                        if (dist < 400) {
                            ctx.beginPath();
                            ctx.moveTo(x, y);
                            ctx.lineTo(kin[0], kin[1]);
                            ctx.strokeStyle = `hsla(${hue}, 100%, 70%, 0.4)`;
                            ctx.lineWidth = 2;
                            ctx.stroke();
                        }
                    }
                }
            }
            
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);
            ctx.scale(size, size);
            
            ctx.beginPath();
            if (trophic === 1) { 
                ctx.arc(0, 0, 12, 0, Math.PI * 2);
            } else if (trophic === 2) { 
                ctx.moveTo(20, 0);
                ctx.lineTo(-5, 12);
                ctx.lineTo(-15, 0);
                ctx.lineTo(-5, -12);
            } else if (trophic === 3) { 
                ctx.rect(-10, -10, 20, 20);
            } else { 
                ctx.moveTo(15, 0);
                ctx.lineTo(-10, 10);
                ctx.lineTo(-10, -10);
            }
            ctx.closePath();
            
            ctx.fillStyle = infected ? '#00ff00' : `hsl(${hue}, 100%, 50%)`;
            if (infected) {
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#00ff00';
            } else {
                ctx.shadowBlur = 0;
            }
            ctx.fill();
            ctx.shadowBlur = 0; // Reset for other draws
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#fff';
            ctx.stroke();
            
            if (index === data.alpha) { // Alpha halo
                ctx.beginPath();
                ctx.arc(0, 0, 30, 0, Math.PI*2);
                ctx.strokeStyle = 'gold';
                ctx.lineWidth = 4;
                ctx.stroke();
            }
            
            ctx.restore();
        });
    });

    socket.on('ai_analysis', (htmlData) => {
        let readout = document.getElementById('ai-readout');
        htmlData = htmlData.replace(/`html/g, '').replace(/`/g, '');
        if(readout) readout.innerHTML = htmlData;
    });

    socket.on('radiation_warning', (isActive) => {
        if (isActive) window.logEvent('☣️ INCOMING: Extreme cosmic radiation burst detected! Genetic mutation rate +500%!', '#00ff00');
        else window.logEvent('Shields stabilized. Cosmic radiation levels returned to normal.', '#00ff00');
        let btn = document.getElementById('rad-btn');
        if (isActive) {
            btn.style.background = 'white';
            btn.style.color = 'red';
            btn.innerText = '☢️ RADIATION BURST ACTIVE ☢️';
        } else {
            btn.style.background = '#ff0033';
            btn.style.color = 'white';
            btn.innerText = '⚠️ TRIGGER RADIATION BURST (10s) ⚠️';
        }
    });

    document.getElementById('rad-btn').addEventListener('click', () => {
        socket.emit('trigger_radiation');
    });
    
    document.getElementById('meteor-btn').addEventListener('click', () => {
        socket.emit('trigger_meteor');
    });

    // Divine Intervention & Lineage Tracing
    window.selectedFamilyId = -1;
    canvas.addEventListener('click', (e) => {
        let rect = canvas.getBoundingClientRect();
        let simX = ((e.clientX - rect.left) / rect.width) * 3000;
        let simY = ((e.clientY - rect.top) / rect.height) * 3000;
        
        // Check if clicked on a creature
        let found = false;
        for (let i = 0; i < creatures.length; i++) {
            let c = creatures[i];
            let dist = Math.hypot(c[0] - simX, c[1] - simY);
            if (dist < c[3] * 15) { // Radius check
                window.selectedFamilyId = c[8];
                window.logEvent(`🧬 LINEAGE TRACER: Tracking Family Dynasty #${c[8]}!`, `hsl(${c[4]}, 100%, 50%)`);
                found = true;
                break;
            }
        }
        
        if (!found) {
            window.selectedFamilyId = -1; // Deselect
            socket.emit('divine_intervention', {x: simX, y: simY});
        }
    });

    socket.on('meteor_warning', () => {
        window.logEvent('☄️ K-T EXTINCTION EVENT: A massive asteroid has struck! 90% of all life and food vaporized!', '#ff8c00');
        window.meteorFlash = 1.0;
    });

    // Historical Charting Logic
    let histChart = null;
    async function loadHistoricalData() {
        try {
            let res = await fetch('/api/history');
            if(!res.ok) return;
            let text = await res.text();
            let lines = text.trim().split('\n');
            
            let labels = [], popData = [], sizeData = [], speedData = [], connData = [];
            
            for(let i=1; i<lines.length; i++) {
                let cols = lines[i].split(',');
                if(cols.length < 11) continue;
                let date = new Date(cols[0]);
                labels.push(date.getHours() + ":" + date.getMinutes().toString().padStart(2, '0'));
                popData.push(parseFloat(cols[2]));
                sizeData.push(parseFloat(cols[8]));
                speedData.push(parseFloat(cols[9]));
                connData.push(parseFloat(cols[10]));
            }
            
            if (labels.length === 0) {
                // No valid data yet, show placeholder
                labels.push("Awaiting first 10-min log...");
                popData.push(0); sizeData.push(0); speedData.push(0); connData.push(0);
            }
            
            let ctxChart = document.getElementById('metricsChart').getContext('2d');
            if(histChart) histChart.destroy();
            
            histChart = new Chart(ctxChart, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'Population', data: popData, borderColor: '#fdf800', yAxisID: 'yPop', tension: 0.3, pointRadius: 3, borderWidth: 2 },
                        { label: 'Avg Size', data: sizeData, borderColor: '#33ff33', yAxisID: 'yStats', tension: 0.3, pointRadius: 3, borderWidth: 2 },
                        { label: 'Avg Speed', data: speedData, borderColor: '#ff3333', yAxisID: 'yStats', tension: 0.3, pointRadius: 3, borderWidth: 2 },
                        { label: 'Avg Connects', data: connData, borderColor: '#ff00ff', yAxisID: 'yStats', tension: 0.3, pointRadius: 3, borderWidth: 2 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { grid: { color: '#333' } },
                        yPop: { type: 'linear', position: 'left', grid: { color: '#333' }, title: {display: true, text: 'Population'} },
                        yStats: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, title: {display: true, text: 'Phenotype / Neural'} }
                    },
                    plugins: { legend: { labels: { color: '#fff' } } }
                }
            });
        } catch(e) { console.error('Chart load error:', e); }
    }
    
    // Refresh historical chart every 5 minutes
    loadHistoricalData();
    setInterval(loadHistoricalData, 5 * 60 * 1000);

  
        let mockData = {
            a: 10, e: 0, age: 10, b: 10, d: 0, asz: 1, asp: 1, aconn: 1, fC: 10, pC: 0, mE: 200, mA: 10, mL: 0, startT: 100000, era: 1, season: 2, fert: 500,
            c: [[100, 100, 1.5, 1.0, 120, 0, 1, 50, 5, 0]],
            f: [[200, 200, 1]]
        };
        handlers['state'](mockData);
        console.log('Runtime test passed');
        