import re

with open('petriChipNode/server_v2.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Add getElevation and Swarm variables at the top of the file
code = code.replace('let globalFertilizer = 10000.0; // Massive initial bloom to support scattered genesis pop // Biogeochemical cycle currency', 'let globalFertilizer = 10000.0;\nlet geologicEpoch = 0;\nfunction getElevation(x, y) {\n    return Math.sin(x/400 + geologicEpoch*0.001) * Math.cos(y/400 - geologicEpoch*0.0005) + Math.sin(x/150 + y/150)*0.2;\n}')

# Update geologicEpoch in tick
code = code.replace('const now = Date.now();', 'const now = Date.now();\ngeologicEpoch++;\n')

# 2. Add gene_aquatic to creatures
code = code.replace('child.gene_carnivore = Math.max(0.0, Math.min(1.0, c.gene_carnivore + randomFloat(-0.05, 0.05)));', 'child.gene_aquatic = Math.max(0.0, Math.min(1.0, c.gene_aquatic + randomFloat(-0.05, 0.05)));\n                child.gene_carnivore = Math.max(0.0, Math.min(1.0, c.gene_carnivore + randomFloat(-0.05, 0.05)));')

# Add to init
code = code.replace('c.gene_carnivore = Math.random();', 'c.gene_carnivore = Math.random();\n        c.gene_aquatic = Math.random();')
code = code.replace('sumChloro = 0, sumScav = 0, sumCarn = 0;', 'sumChloro = 0, sumScav = 0, sumCarn = 0, sumAquatic = 0;')

# 3. Apply suffocation logic in Physics Engine Start
metabolism_logic = '''
        // Geographic & Habitat Suitability (Sea to Land Evolution)
        let elev = getElevation(c.x, c.y);
        let inWater = elev < 0;
        let aquaticMismatch = inWater ? (1.0 - c.gene_aquatic) : c.gene_aquatic; // Distance from ideal habitat
        let suffocationTax = aquaticMismatch > 0.6 ? (aquaticMismatch * 0.5 * c.gene_size) : 0;
        
        let metabolism = (baseline + movementTax + visionTax + ageTax + neuralTax + seasonCost) * radMult + suffocationTax;
'''
code = code.replace('let metabolism = (baseline + movementTax + visionTax + ageTax + neuralTax + seasonCost) * radMult;', metabolism_logic)

# 4. Plant/Food spawn logic:
code = code.replace('items[empty].x = randomFloat(20, ARENA_SIZE - 20);', 'items[empty].x = randomFloat(20, ARENA_SIZE - 20);\n                    let elev = getElevation(items[empty].x, items[empty].y);\n                    if (Math.random() < 0.6 && elev < 0) continue; // 60% less food in deep ocean to push them to land')

# 5. Swarm Intelligence (Neural networking)
swarm_logic = '''
                if (hueDiff < 20.0 && distSq < 4000) {
                    c.swarmMode = true;
                    c2.swarmMode = true;
                    // Hyperintelligent neural link: Share intent and stabilize aggression
                    c.intent = (c.intent + c2.intent) / 2.0;
                    c.aggression = Math.min(c.aggression, c2.aggression);
                }
'''
code = code.replace('if (hueDiff > 180.0) hueDiff = 360.0 - hueDiff;', 'if (hueDiff > 180.0) hueDiff = 360.0 - hueDiff;\n' + swarm_logic)

# Apply swarm intelligence benefits
code = code.replace('let neuralTax = c.brain.conns.length * 0.0001;', 'let neuralTax = c.brain.conns.length * 0.0001;\n        if (c.swarmMode) neuralTax *= 0.1; // 90% discount for hyper-intelligent swarms\n        c.swarmMode = false; // Reset for next tick')

# 6. Make JSON payload send aquatic gene
code = code.replace('sumImm += c.gene_immunity;', 'sumImm += c.gene_immunity; sumAquatic += c.gene_aquatic;')
code = code.replace('Number(c.gene_size.toFixed(2)), Math.round(c.hue), c.infected ? 1 : 0, trophic, Math.round(c.gene_vision)', 'Number(c.gene_size.toFixed(2)), Math.round(c.hue), c.infected ? 1 : 0, c.gene_aquatic > 0.5 ? 5 : trophic, Math.round(c.gene_vision)')

# And log the new variable
code = code.replace('let csvLine = `${new Date().toISOString()}', 'let aaquatic = (count>0)?sumAquatic/count:0;\n          let csvLine = `${new Date().toISOString()}')
code = code.replace(',${acarn.toFixed(3)},${globalFertilizer.toFixed(1)}\\n`;', ',${acarn.toFixed(3)},${globalFertilizer.toFixed(1)},${aaquatic.toFixed(3)}\\n`;')
code = code.replace('Avg Carnivore,Global Fertilizer\\n"', 'Avg Carnivore,Global Fertilizer,Avg Aquatic\\n"')

# Send terrain state via API so the UI can draw the ocean and land
code = code.replace('res.json(payload);', 'payload.geoEpoch = geologicEpoch;\n        res.json(payload);')

with open('petriChipNode/server_v3.js', 'w', encoding='utf-8') as f:
    f.write(code)
