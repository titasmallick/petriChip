import re

with open('petriChipNode/public/index_v3.html', 'r', encoding='utf-8') as f:
    code = f.read()

geo_state = '''
        function getGeoState(epoch) {
            let cycle = epoch % 70000;
            if (cycle < 10000) return { name: "Primordial Soup", seaLevel: -0.15 };
            if (cycle < 25000) return { name: "Snowball Earth", seaLevel: 0.2 };
            if (cycle < 40000) return { name: "Cambrian Bloom", seaLevel: 0 };
            if (cycle < 55000) return { name: "Carboniferous (High O2)", seaLevel: 0.1 };
            if (cycle < 58000) return { name: "The Great Dying (Permian)", seaLevel: -0.1 };
            return { name: "Cenozoic (Modern)", seaLevel: 0 };
        }

        function getElevation(x, y, geologicEpoch) {
            let state = getGeoState(geologicEpoch);
            return Math.sin(x/400 + geologicEpoch*0.001) * Math.cos(y/400 - geologicEpoch*0.0005) + Math.sin(x/150 + y/150)*0.2 + state.seaLevel;
        }
'''
code = re.sub(r'function getElevation\(x, y, geologicEpoch\)\s*\{\s*return Math\.sin.*?\;\s*\}', geo_state, code, flags=re.DOTALL)

ui_html = '''
    <h1>Silicon Petri Dish: Earth Edition</h1>
    <h2 id="geo-era" style="color: #ff9900; margin-top: -10px; font-size: 1.5rem; text-shadow: 0 0 10px rgba(255,153,0,0.5);">Primordial Soup</h2>
'''
code = code.replace('<h1>Silicon Petri Dish: Node.js Cloud Edition</h1>', ui_html)

code = code.replace("document.getElementById('alive').innerText = state.a;", "document.getElementById('alive').innerText = state.a;\n          if (state.geoName) document.getElementById('geo-era').innerText = 'Era: ' + state.geoName;")

with open('petriChipNode/public/index_v3.html', 'w', encoding='utf-8') as f:
    f.write(code)
