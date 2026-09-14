# 🧫 Silicon Petri Dish (petriChip)

A fully autonomous, real-time evolutionary ecosystem running entirely on the **ESP32** microcontroller.

This project is a biologically-inspired artificial life simulation. The ESP32 hosts a C++ physics engine and a mathematical neural-network ecosystem, broadcasting a high-performance 60FPS dashboard to any connected browser via its own local web server.

## 🧬 Biological Phenomena Implemented

The entities in this simulation are not hard-coded to survive. They are equipped with **40-gene neural networks** (7 sensory inputs, 4 hidden neurons, 2 motor outputs). They must mathematically learn to hunt food, avoid poison, and interact with other species.

* **Social Sight:** Organisms do not just see food; they can see the distance, angle, and *genetic similarity* of the nearest living organism, allowing them to evolve complex emergent behaviors like pack hunting, swarming, and predator evasion.
* **Speciation (Genetics):** An organism's color represents its genetic code. Children inherit their parent's color. As mutations occur, the ecosystem visually splinters into different color strains.
* **Mutualism & Kin Selection:** When two organisms of a similar genetic color bump into each other, they recognize kin and pool their energy to prevent starvation. (Visualized as a **Green Energy Beam**).
* **Competitive Exclusion (Predation):** When organisms of different species collide, the stronger species attacks and steals energy from the weaker one. (Visualized as a **Red Lightning Bolt**).
* **Mitosis:** Organisms that successfully hunt enough food (reaching 160% energy) instantly reproduce by splitting in half, dropping a mutated child up to 30 pixels away.
* **Bacterial Toxicity:** In a closed environment, dead organisms lyse and release toxic metabolic waste. Starving organisms pollute the arena with deadly poison upon death.
* **Horizontal Gene Transfer:** Organisms that bump into each other have a 5% chance of randomly conjugating and swapping a piece of their neural DNA.
* **Alpha Vault (Elitism):** The ecosystem tracks the DNA of the absolute best hunter in a given epoch. If a mass extinction wipes out the entire board, the Alpha's DNA is germinated from endospores to seed the next epoch, guaranteeing that successful hunting traits are never lost.

## 📡 Interactive EMF Radiation

The ESP32 asynchronously scans for nearby WiFi networks using `WiFi.RSSI()`. 
If you bring a phone (with a Mobile Hotspot enabled) physically close to the ESP32 chip, the simulation detects the signal strength and interprets it as **Environmental Radiation**.

* Triggers a Red Radar Pulse on the UI.
* Physically irradiates the organisms, knocking them around via electromagnetic drift.
* Radically scrambles their DNA, forcing **Saltation** (extreme speciation events) if they reproduce while irradiated.

## 💻 Dashboard & Analytics

The dashboard is served directly from the ESP32 `PROGMEM` to your browser.
* **Evolutionary Muller Plot:** A real-time Stacked Area Chart tracking the population history of 12 distinct genetic strains over the last 60 seconds.
* **Dominant Species Predictor:** Analyzes growth trends to predict which species will achieve dominance or face collapse.
* **Circadian Rhythms:** The environment smoothly interpolates between Day and Night every 60 seconds, halving the organisms' vision at night and forcing them to adapt their hunting strategies.
* **"God Mode":** Tapping the petri dish on a phone screen manually drops clusters of food and poison into the simulation.
* **Asteroid Strike:** A manual trigger to instantly kill 95% of the ecosystem to demonstrate the Endospore recovery mechanic.
* **WebAudio Geiger Counter:** Synthesizes Geiger counter clicks proportional to the detected WiFi radiation.

## 🛠️ Hardware & Setup

* **Hardware:** Any standard ESP32 development board.
* **Dependencies:** None. Only native `WiFi.h` and `WebServer.h`.
* **Installation:** 
  1. Open `BionotesESP32.ino` in the Arduino IDE.
  2. Update the `ssid` and `password` variables to match your local WiFi network.
  3. Flash to the ESP32.
  4. Open the Serial Monitor (115200 baud) to find the ESP32's local IP address (e.g., `http://192.168.0.116`).
  5. Open that IP address in any modern desktop or mobile browser.

## 🚀 Performance Notes

* The C++ physics engine runs asynchronously at 20 ticks per second on the ESP32.
* The frontend uses a decoupled `requestAnimationFrame` loop with mathematical `lerp` interpolation to render the entities at a buttery-smooth 60fps, even on mobile devices.
* The state payload is severely optimized to keep the JSON string small, preventing heap fragmentation on the microcontroller.

---
*Created as a demonstration of artificial life, edge computing, and biological data visualization.*
