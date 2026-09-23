import re

with open('petriChipNode/public/index_v3.html', 'r', encoding='utf-8') as f:
    code = f.read()

terrain_logic = """
        function getElevation(x, y, geologicEpoch) {
            return Math.sin(x/400 + geologicEpoch*0.001) * Math.cos(y/400 - geologicEpoch*0.0005) + Math.sin(x/150 + y/150)*0.2;
        }

        let terrainCanvas = document.createElement('canvas');
        terrainCanvas.width = 3000;
        terrainCanvas.height = 3000;
        let terrainCtx = terrainCanvas.getContext('2d');
        let lastGeoEpoch = -1;

        function renderTerrain(geoEpoch) {
            if (geoEpoch === lastGeoEpoch) return;
            lastGeoEpoch = geoEpoch;
            const cellSize = 50;
            for (let y = 0; y < 3000; y += cellSize) {
                for (let x = 0; x < 3000; x += cellSize) {
                    let elev = getElevation(x, y, geoEpoch);
                    if (elev < 0) { // Sea
                        let depth = Math.min(1.0, -elev * 1.5);
                        terrainCtx.fillStyle = `rgba(0, 50, ${100 + depth*155}, 1)`;
                    } else { // Land
                        let height = Math.min(1.0, elev * 1.5);
                        terrainCtx.fillStyle = `rgba(${50 + height*50}, ${100 + height*100}, 50, 1)`;
                    }
                    terrainCtx.fillRect(x, y, cellSize, cellSize);
                }
            }
        }
"""
code = code.replace("const canvas = document.getElementById('arena');", terrain_logic + "\n      const canvas = document.getElementById('arena');")

code = code.replace("ctx.clearRect(0, 0, canvas.width, canvas.height);", "ctx.clearRect(0, 0, canvas.width, canvas.height);\n          if (state.geoEpoch !== undefined) renderTerrain(state.geoEpoch);\n          ctx.drawImage(terrainCanvas, 0, 0);")

code = code.replace('Chloroplast (Autotroph): <span id="chloro">', 'Aquatic (Gills): <span id="aquatic">')
code = code.replace("document.getElementById('chloro').innerText = state.achloro;", "document.getElementById('aquatic').innerText = state.aaquatic || 0;")
code = code.replace("document.getElementById('chloro').innerText = (state.achloro || 0).toFixed(2);", "document.getElementById('aquatic').innerText = (state.aaquatic || 0).toFixed(2);")

code = code.replace('ctx.fillStyle = item[2] === 1 ? "#00ffcc" : "#ff3333";', 'let isFood = item[2] === 1;\n              let elev = getElevation(item[0], item[1], state.geoEpoch || 0);\n              ctx.fillStyle = isFood ? (elev > 0 ? "#22aa22" : "#00ffcc") : "#ff3333";')

swarm_draw = """
          // Draw Swarm Links
          ctx.lineWidth = 2;
          for (let i = 0; i < state.c.length; i++) {
              for (let j = i + 1; j < state.c.length; j++) {
                  let c1 = state.c[i]; let c2 = state.c[j];
                  let dx = c1[0]-c2[0]; let dy = c1[1]-c2[1];
                  if (dx*dx + dy*dy < 4000) {
                      let h1 = c1[4]; let h2 = c2[4];
                      let hueDiff = Math.abs(h1 - h2);
                      if (hueDiff > 180) hueDiff = 360 - hueDiff;
                      if (hueDiff < 20.0) {
                          ctx.strokeStyle = `hsla(${h1}, 100%, 70%, 0.5)`;
                          ctx.beginPath();
                          ctx.moveTo(c1[0], c1[1]);
                          ctx.lineTo(c2[0], c2[1]);
                          ctx.stroke();
                      }
                  }
              }
          }
"""
code = code.replace('state.c.forEach(c => {', swarm_draw + '\n          state.c.forEach(c => {')

with open('petriChipNode/public/index_v3.html', 'w', encoding='utf-8') as f:
    f.write(code)
