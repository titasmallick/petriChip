import re

with open('petriChipNode/server_v3.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Define getGeoState
geo_state = '''
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
'''
code = re.sub(r'function getElevation\(x, y\)\s*\{\s*return Math\.sin.*?\;\s*\}', geo_state, code, flags=re.DOTALL)

# 2. Apply geoState in the game loop
code = code.replace('let seasonCost = 0.0;', 'let geoState = getGeoState(geologicEpoch);\n        let seasonCost = geoState.coldTax > geoState.heatTax ? geoState.coldTax : geoState.heatTax;')

# 3. Apply size cap in Mitosis & Mating limits
code = code.replace('child.gene_size = Math.max(0.5, Math.min(2.5, child.gene_size));', 'child.gene_size = Math.max(0.5, Math.min(getGeoState(geologicEpoch).sizeCap, child.gene_size));')

# 4. Apply radiation boost
code = code.replace('let envRadiation = 0;', 'let envRadiation = getGeoState(geologicEpoch).radBoost;')

# 5. Volcanic Poison Rain during The Great Dying
rain_logic = '''
    // Geological Event Triggers
    let curState = getGeoState(geologicEpoch);
    if (curState.name === "The Great Dying (Permian)" && Math.random() < 0.05) {
        // Toxic rain converts food to poison rapidly
        let fIdx = items.findIndex(i => i.active && i.type === 1);
        if (fIdx !== -1) items[fIdx].type = -1; 
    }
'''
code = code.replace('// Physics Engine Start', rain_logic + '\n    // Physics Engine Start')

# 6. Add to payload
code = code.replace('payload.geoEpoch = geologicEpoch;', 'payload.geoEpoch = geologicEpoch; payload.geoName = getGeoState(geologicEpoch).name;')

with open('petriChipNode/server_v3.js', 'w', encoding='utf-8') as f:
    f.write(code)
