# // THE SILICON PETRI DISH (CLOUD SCALE)

A massive-scale Artificial Life, Neuro-Evolution, and Complex Systems simulation built on Node.js and HTML5 Canvas.

## Overview
This project simulates an entire microscopic ecosystem governed by the principles of **Artificial Life (ALife)**. Thousands of digital organisms, driven by NeuroEvolution of Augmenting Topologies (NEAT) and genetic morphological traits, compete in a real-time, 200-ticks-per-second environment. 

There are no hardcoded behaviors. Every action—flocking, hunting, fleeing, and speciation—is an emergent property of natural selection punishing inefficiency and rewarding survival.

---

## 🧬 Version 1: The Core Simulation
The foundation of the petri dish (server.js).

### Emergent Mechanics
- **Neural Topologies (NEAT):** Brains start as simple 2-node reflex connections. Over generations, mutations structurally add new hidden nodes and synapses, leading to rapid encephalization as the environment demands intelligence for survival.
- **Evolvable Morphology (r/K Selection):** The physical bodies of the organisms mutate. Large bodies (K-strategists) dominate physical collisions but burn massive passive calories. Tiny bodies (r-strategists) are weak but hyper-efficient. The environment often triggers *Insular Dwarfism* when food is scarce.
- **The Red Queen Hypothesis:** A perpetual speed arms race. Organisms are forced to evolve faster kinetic speeds just to beat their kin to the remaining food, driving exponential energy usage.
- **Assortative Mating & Speciation:** Organisms are color-coded by genetic lineage. They practice mate choice, only mating with kin of similar color and size, leading to the organic fracturing of the population into distinct, color-coded species.
- **Asymmetric Predation:** When different species collide, physics calculates their \Energy × Speed × Size\. The victor physically overpowers and steals energy from the loser.

---

## 🌍 Version 2: The Planetary Update
The groundbreaking expansion (server_v2.js) that introduces Climate, Epidemiology, and Biogeochemistry, creating a Grand Unified Sandbox.

### 1. Trophic Levels & Biogeochemical Cycling
Infinite food drops have been eliminated. The planet relies on a closed-loop **Fertilizer** system governed by the 10% Trophic Rule (Lindeman's Law). Organisms evolve shape-shifting physical traits based on their dominant genes:
- 🟢 **Producers (Circles):** Evolve \gene_chloroplast\. They passively generate energy from the Sun but suffer extreme kinetic movement penalties, eventually rooting to the ground.
- 🔺 **Herbivores (Triangles):** Consume plant matter, serving as the primary energy transfer vector.
- ♦️ **Carnivores (Spikes):** Evolve \gene_carnivore\ to steal massive energy from hunting others. However, the evolutionary tradeoff permanently breaks their ability to digest plant matter.
- 🔲 **Decomposers (Squares):** Evolve \gene_scavenger\. They are the only species that can consume toxic Corpses. By doing so, they return Fertilizer to the global soil, allowing Producers to grow. *If Decomposers go extinct, the entire planetary food web collapses.*

### 2. Viral Epidemiology (Pathogens)
Winter triggers the random spawning of Pathogens. Viruses drain metabolic energy and transmit horizontally upon physical collision (indicated by a glowing radioactive green aura). 
- **The Auto-Immune Trap:** Organisms must mutate a massive \gene_immunity\ to clear the infection. However, a high immune system requires permanent passive metabolic calories. Perfect immunity leads to rapid starvation, forcing a delicate evolutionary balance.

### 3. Dynamic Climate Change
The environment cyclically rotates between four distinct seasons:
- **Spring:** Massive PAR (Photosynthetically Active Radiation) from the sun drives explosive Producer growth.
- **Summer (Overheating):** Organisms with thick \gene_insulation\ suffer massive energy drain penalties.
- **Autumn:** Ecological decay.
- **Winter (Famine):** The Sun turns off (zero PAR). Bare organisms freeze to death, while those who evolved \gene_insulation\ survive.

---

## 🚀 Running the Simulation
\\ash
# Install dependencies
npm install express socket.io dotenv

# Run V1
node server.js

# Run V2
node server_v2.js
\Navigate to \http://localhost:3000\ (for V1) or \http://localhost:3000/index_v2.html\ (for V2) in your browser.

## 🤖 Gemini AI Integration
The server securely integrates with Google Gemini via a background daemon. Every 30 minutes, it packages the CSV historical tracking data and queries Gemini to act as an Evolutionary Biologist, providing a real-time, highly analytical readout of the ecosystem's dynamics directly to the web dashboard.
