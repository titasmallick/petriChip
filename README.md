# 🧫 Silicon Petri Dish (petriChip)

A fully autonomous, real-time evolutionary ecosystem running entirely on the **ESP32** microcontroller.

This project is a biologically-inspired artificial life simulation. The ESP32 hosts a C++ physics engine and a mathematical neural-network ecosystem, broadcasting a high-performance 60FPS dashboard to any connected browser via its own local web server.

## 🧬 Biological Phenomena Implemented

The entities in this simulation are not hard-coded to survive. They are equipped with **100-gene neural networks** (8 sensory inputs, 8 hidden neurons, 2 motor outputs). There is no artificial fitness score or overarching objective function; they must mathematically learn to hunt food, avoid poison, and interact with other species purely to gather enough energy to reproduce. Survival and replication are their own intrinsic metrics.

* **Social Sight & Niche Selection:** Organisms do not just see food; they can see the distance, angle, and *genetic similarity* of the nearest living organism. They also possess an internal sensory input for their own **Self Energy**, allowing them to dynamically switch between aggressive pack hunting when starving and predator evasion/hiding when full.
* **Evolvable Morphology (r/K Selection):** Organisms do not just evolve their brains; they evolve their bodies. Each organism has specific genes for **Base Speed**, **Vision Radius**, and **Body Size (`gene_size`)**. Size dictates an organism's life strategy: massive organisms have incredible predation power and can store huge amounts of energy, but they move slower, burn massive amounts of baseline calories, and require enormous food reserves to reproduce. Tiny organisms are weak but can breed incredibly fast on very little food.
* **Senescence (Aging) & Extrinsic Mortality:** Organisms are not biologically immortal. As their `age` increases, their metabolic efficiency decays. Additionally, there is a constant background stochastic mortality rate (random death via disease/accidents), forcing a true Darwinian pressure to hunt and reproduce before they die.
* **True Sexual Reproduction (Crossover):** When two organisms of a similar genetic color (Kin) bump into each other, and *both* have sufficient energy reserves, they will expend their energy to mate! They spawn a child that inherits a 50/50 genetic crossover of both parents' neural weights and morphological body plans, massively accelerating the discovery of beneficial traits. Organisms practice **Mate Choice**, refusing to mate with partners that have starvation-level energy reserves or drastically different body sizes.
* **Mitosis (Asexual):** If an organism is utterly alone but successfully hunts a massive amount of food, it can reproduce asexually by splitting in half. However, this is *brutally expensive* compared to sexual reproduction, enforcing the evolutionary advantage of seeking a mate.
* **Asymmetric Predation:** When organisms of different species collide, it is no longer a coin-flip. The stronger organism—calculated by multiplying its current energy reserves by its evolved **Speed and Body Size**—overpowers the weaker species, stealing its energy.
* **Bacterial Toxicity:** In a closed environment, dead organisms lyse and release toxic metabolic waste. Starving organisms pollute the arena with deadly poison upon death.
* **True Darwinian Extinction:** There is no "Alpha Vault" or genetic backup. If a lineage goes extinct, it is gone forever. If a mass extinction wipes out the entire board, the simulation experiences a "Genesis Event", randomly seeding the board with primitive ancestors to start evolution entirely from scratch.

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
* **Asteroid Strike:** A manual trigger to instantly kill 95% of the ecosystem to test the survivors' evolutionary resilience or trigger a Genesis reset.
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
