# Silicon Petri Dish — Agent Development Guide

## Overview
The **Silicon Petri Dish** is a high-speed Artificial Life simulation engine running on Node.js. It features a complete physics engine, neural network evaluation, genomic evolution, and complex mechanics like trophic layers (producers, carnivores, scavengers), environmental hazards (radiation, meteors, seasons, ice ages), and dynamic terrain.

This document serves as the primary technical anchor for any AI agents interacting with the codebase.

## Repository Structure
- **Node Backend (`server_v1.js` -> `server_v4.js`)**: The evolutionary physics engine and socket.io broadcasting hub. The latest engine is always `server_v4.js`.
- **Frontend (`public/index_v4.html`)**: The client-side "Research Terminal" that renders the simulation via HTML5 Canvas and Chart.js, communicating continuously with the backend over WebSockets.
- **ESP Integration (Legacy/Hardware)**: The architecture originated as an ESP32/ESP8266-driven simulation ("PetriChip"). While the main computational load has shifted to Node.js, the design remains capable of running localized simulation nodes or receiving physical hardware sensor telemetry.

## Core Simulation Architecture (V4)
- **State Loop (`tickPhysics`)**: Evaluates biology, aging, energy metabolism, combat, and collision.
- **Neural Network (`processBrain`)**: An evolvable NEAT-lite architecture (Sensors -> Hidden -> Motors) using Tanh activation. Mutated via radiation or reproduction.
- **Array Management**: `creatures` and `items` arrays are padded and recycled to prevent memory leaks during rapid population shifts. 
- **Reproduction**: Triggered automatically when energy thresholds are met (Mitosis) or when kin collide (Assortative Mating).

## UI / Design System Specifications
The frontend strictly adheres to a **Nocturnal Field Station / Scientific Minimalist** design.
- **Vibe:** Biological telemetry, observant, information-rich, non-game-like.
- **Base:** `#08090c` (Background), `#0b1114` (Surface), `rgba(255,255,255,0.035)` (Muted Surface).
- **Accents (Semantic Only):**
  - Cyan (`#73f4df`): Telemetry, Producers, Water.
  - Lime (`#c7ff56`): Active states, Primary buttons, Focus rings.
  - Fuchsia (`#e9a7ff`): Apex data, Intervention brushes, Dynasty highlighting.
  - Amber (`#f7c873`): Warnings, generational data.
  - Success (`#86efac`): Live healthy status.
- **Typography:** Inter (Sans) for headers/UI. JetBrains Mono (Monospace) for all telemetry, timestamps, IDs, and inputs.
- **Layout:** Sticky right-rail for controls. Left-rail for canvases. No heavy shadows, mostly translucent surfaces and subtle borders.

## Future Development Constraints
1. **Performance:** Collision detection is currently $O(N^2)$. If requested to scale >2000 entities, implement QuadTree spatial partitioning.
2. **Persistence:** Use `save_data` / JSON dumps to persist state.
3. **Immutability:** Do NOT remove features when modifying the UI. Always map existing HTML IDs (`#btn-update`, `#inp-fert`, `#arena`, etc.) to new DOM elements.

## Execution
To start the engine:
```bash
node server_v4.js
```
Access the terminal at `http://localhost:3004` (port configured in v4).
