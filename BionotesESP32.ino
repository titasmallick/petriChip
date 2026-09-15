#include <WiFi.h>
#include <WebServer.h>
#include <math.h>

const char* ssid = "Titas Mallick";
const char* password = "YOUR_PASSWORD*";

WebServer server(80);

// --- OPEN ECOSYSTEM CONFIG ---
const int ARENA_SIZE = 800;   // Doubled size (4x area)
const int MAX_CREATURES = 50; // Increased Population cap
const int NUM_ITEMS = 100;    // Increased Food + Poison to fill arena
const float MAX_VISION = 150.0;  

struct Item {
  float x, y;
  int type; // 1 = Food, -1 = Poison
  bool active;
};

struct Creature {
  float x, y, angle;
  float energy;
  bool alive;
  float hue; // Color-coding for Speciation!
  int age; // Senescence (Aging)
  
  // Morphology (Body Plan Genes)
  float gene_speed;  // Base speed multiplier (costs energy)
  float gene_vision; // Base vision radius (costs energy)
  float gene_size;   // 0.5 (tiny/fast/cheap) to 2.5 (huge/slow/expensive) - Drives r/K Selection!

  float w[100]; // 8 inputs * 8 hidden + 9 * 2 outputs = 82 weights (padded to 100)
};

Creature creatures[MAX_CREATURES];
Item items[NUM_ITEMS];

int totalBirths = 0;
int extinctions = 0;
int aliveCount = 0;
unsigned long lastTick = 0;
unsigned long epochStartMillis = 0;

int envRadiation = 0; // Tracks nearby WiFi hotspots as "Radiation"

float randomFloat(float min, float max) {
  return min + ((float)random(10000) / 10000.0) * (max - min);
}

void initEcosystem() {
  aliveCount = 0;
  epochStartMillis = millis();
  
  // Scatter initial items (mostly food, some poison)
  for(int i = 0; i < NUM_ITEMS; i++) {
    items[i].x = randomFloat(20, ARENA_SIZE - 20);
    items[i].y = randomFloat(20, ARENA_SIZE - 20);
    items[i].type = (random(100) < 25) ? -1 : 1; // 25% poison
    items[i].active = true;
  }
  
  // Genesis Event (Pure Random)
  // Extinction is now a true bottleneck. No backups. No Alpha Vault.
  for(int i = 0; i < 20; i++) {
    creatures[i].x = randomFloat(20, ARENA_SIZE - 20); 
    creatures[i].y = randomFloat(20, ARENA_SIZE - 20);
    creatures[i].angle = randomFloat(0, 2*PI);
    creatures[i].energy = 100.0;
    creatures[i].age = 0; 
    creatures[i].alive = true;
    
    for(int w = 0; w < 100; w++) {
      creatures[i].w[w] = randomFloat(-1.0, 1.0);
    }
    
    creatures[i].hue = random(0, 360);
    creatures[i].gene_speed = randomFloat(0.5, 3.0);
    creatures[i].gene_vision = randomFloat(30.0, 150.0);
    creatures[i].gene_size = randomFloat(0.5, 2.5); // Morphological Size!
    
    aliveCount++;
  }
  
  // Clear the rest (Empty graves for future children)
  for(int i = 20; i < MAX_CREATURES; i++) {
    creatures[i].alive = false;
  }
}

void tickPhysics() {
  if (aliveCount == 0) {
    extinctions++;
    initEcosystem();
    return;
  }
  
  aliveCount = 0;
  
  // ECOLOGICAL PHENOMENON: Random Immigration 
  // Alien organisms occasionally wander in from outside the petri dish
  if (random(1000) < 5) { // 0.5% chance per tick
      int emptySlot = -1;
      for(int j=0; j<MAX_CREATURES; j++) {
          if(!creatures[j].alive) { emptySlot = j; break; }
      }
      if(emptySlot != -1) {
          creatures[emptySlot].x = (random(100) < 50) ? 10 : ARENA_SIZE - 10; // Spawn at left or right edge
          creatures[emptySlot].y = randomFloat(10, ARENA_SIZE - 10);
          creatures[emptySlot].angle = randomFloat(0, 2*PI);
          creatures[emptySlot].energy = 100.0;
          creatures[emptySlot].alive = true;
          for(int w=0; w<26; w++) creatures[emptySlot].w[w] = randomFloat(-2.0, 2.0); // Completely alien DNA
      }
  }
  
  // Rare renewable resources (Food & Poison bloom)
  if (random(100) < 5) { // 5% chance per tick
    for (int f = 0; f < NUM_ITEMS; f++) {
      if (!items[f].active) {
         items[f].x = randomFloat(20, ARENA_SIZE - 20);
         items[f].y = randomFloat(20, ARENA_SIZE - 20);
         items[f].type = (random(100) < 20) ? -1 : 1; 
         items[f].active = true;
         break;
      }
    }
  }
  
  // RADIOACTIVE TOXIC RAIN: Dialed back. Only rarely spawns poison under high radiation.
  if (envRadiation > 20 && random(1000) < envRadiation) {
    for (int f = 0; f < NUM_ITEMS; f++) {
      if (!items[f].active) {
         items[f].x = randomFloat(20, ARENA_SIZE - 20);
         items[f].y = randomFloat(20, ARENA_SIZE - 20);
         items[f].type = -1; // Pure poison
         items[f].active = true;
         break;
      }
    }
  }

  // --- PHYSICS ENGINE START ---
  float dayCycle = (sin(millis() * 2.0 * PI / 60000.0) + 1.0) / 2.0;

  for (int i = 0; i < MAX_CREATURES; i++) {
    if (!creatures[i].alive) continue;
    aliveCount++;
    creatures[i].age++; // Senescence (Aging clock)
    
    // Morphology: Individual vision radius affected by day/night cycle
    float myVision = creatures[i].gene_vision * (0.5 + 0.5 * dayCycle);
    
    // 1. Calculate inputs for Neural Net (Sight!)
    float closestDist = myVision;
    float closestAngle = 0;
    float closestType = 0; // 1.0 for Food, -1.0 for Poison
    
    for (int f = 0; f < NUM_ITEMS; f++) {
      if (!items[f].active) continue;
      float dx = items[f].x - creatures[i].x;
      float dy = items[f].y - creatures[i].y;
      float d = sqrt(dx*dx + dy*dy);
      
      if (d < closestDist) {
        closestDist = d;
        closestAngle = atan2(dy, dx) - creatures[i].angle;
        while (closestAngle > PI) closestAngle -= 2*PI;
        while (closestAngle < -PI) closestAngle += 2*PI;
        closestType = (items[f].type == 1) ? 1.0 : -1.0;
      }
      
      // Eating logic
      if (d < 10.0) { // Increased eat radius so they don't miss it at high speeds
        items[f].active = false;
        if (items[f].type == 1) {
           creatures[i].energy += 60.0; // Food provides energy
        } else {
           creatures[i].energy -= 80.0; // Poison is DEADLY
        }
      }
    }

    // 2. SOCIAL SIGHT: Find the closest other organism!
    float closestCreatDist = myVision;
    float closestCreatAngle = 0;
    float closestCreatSim = 0; // 1.0 = Same Species (Kin), -1.0 = Different Species (Alien)

    for (int j = 0; j < MAX_CREATURES; j++) {
      if (i == j || !creatures[j].alive) continue;
      float dx = creatures[j].x - creatures[i].x;
      float dy = creatures[j].y - creatures[i].y;
      float d = sqrt(dx*dx + dy*dy);
      
      if (d < closestCreatDist) {
        closestCreatDist = d;
        closestCreatAngle = atan2(dy, dx) - creatures[i].angle;
        while (closestCreatAngle > PI) closestCreatAngle -= 2*PI;
        while (closestCreatAngle < -PI) closestCreatAngle += 2*PI;
        
        float hueDiff = abs(creatures[i].hue - creatures[j].hue);
        if (hueDiff > 180.0) hueDiff = 360.0 - hueDiff;
        closestCreatSim = 1.0 - (hueDiff / 90.0); // Map 0-180 diff to 1.0 to -1.0
      }
    }
    
    // Normalize inputs (8 Inputs now!)
    float in_bias = 1.0;
    float in_item_dist = closestDist / myVision;
    float in_item_angle = closestAngle / PI; 
    float in_item_type = closestType;
    float in_creat_dist = closestCreatDist / myVision;
    float in_creat_angle = closestCreatAngle / PI;
    float in_creat_sim = closestCreatSim;
    float in_self_energy = creatures[i].energy / (160.0 * creatures[i].gene_size); // Normalize by body size
    
    // Hidden Layer (8 neurons) with 8 inputs each = 64 weights (w[0] to w[63])
    float h[8];
    for (int n = 0; n < 8; n++) {
      float sum = (in_bias        * creatures[i].w[n*8]) + 
                  (in_item_dist   * creatures[i].w[n*8+1]) + 
                  (in_item_angle  * creatures[i].w[n*8+2]) + 
                  (in_item_type   * creatures[i].w[n*8+3]) +
                  (in_creat_dist  * creatures[i].w[n*8+4]) +
                  (in_creat_angle * creatures[i].w[n*8+5]) +
                  (in_creat_sim   * creatures[i].w[n*8+6]) +
                  (in_self_energy * creatures[i].w[n*8+7]);
      h[n] = tanh(sum);
    }
    
    // Output Layer (2 neurons: Speed, Turn) = 18 weights (w[64] to w[81])
    float sumSpeed = (1.0 * creatures[i].w[64]) + (h[0]*creatures[i].w[65]) + (h[1]*creatures[i].w[66]) + (h[2]*creatures[i].w[67]) + (h[3]*creatures[i].w[68]) + (h[4]*creatures[i].w[69]) + (h[5]*creatures[i].w[70]) + (h[6]*creatures[i].w[71]) + (h[7]*creatures[i].w[72]);
    float sumTurn  = (1.0 * creatures[i].w[73]) + (h[0]*creatures[i].w[74]) + (h[1]*creatures[i].w[75]) + (h[2]*creatures[i].w[76]) + (h[3]*creatures[i].w[77]) + (h[4]*creatures[i].w[78]) + (h[5]*creatures[i].w[79]) + (h[6]*creatures[i].w[80]) + (h[7]*creatures[i].w[81]);
    
    // WANDER MECHANIC: If absolutely nothing is in vision, inject random turn noise so they sweep the arena
    if (closestDist >= myVision - 0.1 && closestCreatDist >= myVision - 0.1) {
        sumTurn += randomFloat(-0.8, 0.8);
    }
    
    // Morphology: Evolved Speed & Turn Rate. Larger bodies (gene_size) move slower!
    float radMult = 1.0 + (envRadiation * 0.02); 
    if (radMult > 2.0) radMult = 2.0;
    float speed = (tanh(sumSpeed) + 1.0) * (creatures[i].gene_speed / creatures[i].gene_size) * radMult; 
    float turn = tanh(sumTurn) * (creatures[i].gene_speed * 0.25 / creatures[i].gene_size) * radMult; 
    
    creatures[i].angle += turn;
    creatures[i].x += cos(creatures[i].angle) * speed;
    creatures[i].y += sin(creatures[i].angle) * speed;
    
    // EMF INTERFERENCE: Dialed back to a gentle magnetic drift rather than a violent push
    if (envRadiation > 15) {
        creatures[i].x += randomFloat(-envRadiation, envRadiation) * 0.05;
        creatures[i].y += randomFloat(-envRadiation, envRadiation) * 0.05;
    }
    
    // MULTIPLE ECOLOGICAL INTERACTIONS (When organisms physically touch)
    for(int j = i + 1; j < MAX_CREATURES; j++) {
      if (!creatures[j].alive) continue;
      float ddx = creatures[i].x - creatures[j].x;
      float ddy = creatures[i].y - creatures[j].y;
      
      // Collision radius scales with body size!
      float collideDist = 100.0 * ((creatures[i].gene_size + creatures[j].gene_size) / 2.0);
      
      if (ddx*ddx + ddy*ddy < collideDist) { 
         
         // Anti-clumping physical pushback
         creatures[i].x += ddx * 0.05;
         creatures[i].y += ddy * 0.05;
         creatures[j].x -= ddx * 0.05;
         creatures[j].y -= ddy * 0.05;
         
         // Calculate Genetic Distance (Color difference: 0 to 180 degrees)
         float hueDiff = abs(creatures[i].hue - creatures[j].hue);
         if (hueDiff > 180.0) hueDiff = 360.0 - hueDiff;

         // 2. SYMBIOSIS, MATING, vs PREDATION
         if (hueDiff < 20.0) {
             // KIN SELECTION & MATE CHOICE (Sexual Selection)
             // Organisms now discriminate based on Energy & Body Size! They refuse to mate with starving/tiny runts.
             float mateThresholdI = 100.0 * creatures[i].gene_size;
             float mateThresholdJ = 100.0 * creatures[j].gene_size;
             
             if (creatures[i].energy > mateThresholdI && creatures[j].energy > mateThresholdJ &&
                 abs(creatures[i].gene_size - creatures[j].gene_size) < 0.5) { // Must be similar size
                 
                 int emptySlot = -1;
                 for(int s=0; s<MAX_CREATURES; s++) {
                     if (!creatures[s].alive) { emptySlot = s; break; }
                 }
                 if (emptySlot != -1) {
                     // Mating is significantly cheaper (costs 40) than Asexual Mitosis (costs 120).
                     creatures[i].energy -= 40.0;
                     creatures[j].energy -= 40.0;
                     creatures[emptySlot].energy = 80.0;
                     creatures[emptySlot].x = creatures[i].x;
                     creatures[emptySlot].y = creatures[i].y;
                     creatures[emptySlot].angle = randomFloat(0, 2*PI);
                     creatures[emptySlot].age = 0;
                     creatures[emptySlot].alive = true;
                     aliveCount++;
                     totalBirths++;
                     
                     // Crossover DNA & Morphology
                     for (int w = 0; w < 100; w++) {
                         creatures[emptySlot].w[w] = (random(100) < 50) ? creatures[i].w[w] : creatures[j].w[w];
                         if (random(100) < 5) creatures[emptySlot].w[w] += randomFloat(-0.5, 0.5); // Micro-mutation
                     }
                     creatures[emptySlot].hue = (creatures[i].hue + creatures[j].hue) / 2.0 + randomFloat(-10, 10);
                     creatures[emptySlot].gene_speed = (creatures[i].gene_speed + creatures[j].gene_speed) / 2.0 + randomFloat(-0.1, 0.1);
                     creatures[emptySlot].gene_vision = (creatures[i].gene_vision + creatures[j].gene_vision) / 2.0 + randomFloat(-5.0, 5.0);
                     creatures[emptySlot].gene_size = (creatures[i].gene_size + creatures[j].gene_size) / 2.0 + randomFloat(-0.1, 0.1);
                 }
             } else {
                 // Mutualism: If not mating (rejected or low energy), they pool and share energy
                 float totalEn = creatures[i].energy + creatures[j].energy;
                 creatures[i].energy = totalEn / 2.0;
                 creatures[j].energy = totalEn / 2.0;
             }
         } else {
             // PREDATION (Different Species)
             // Predation is now asymmetric based on Morphology (Speed * Size)! Bigger, faster organism wins.
             float powerI = creatures[i].energy * creatures[i].gene_speed * creatures[i].gene_size;
             float powerJ = creatures[j].energy * creatures[j].gene_speed * creatures[j].gene_size;
             
             if (powerI > powerJ) {
                 creatures[i].energy += 15.0;  
                 creatures[j].energy -= 15.0;  
             } else {
                 creatures[j].energy += 15.0;
                 creatures[i].energy -= 15.0;
             }
         }
      }
    }
    
    // Arena Bounds (Bounce slightly so they don't get stuck)
    if (creatures[i].x < 0) { creatures[i].x = 0; creatures[i].angle += PI; }
    if (creatures[i].x > ARENA_SIZE) { creatures[i].x = ARENA_SIZE; creatures[i].angle += PI; }
    if (creatures[i].y < 0) { creatures[i].y = 0; creatures[i].angle += PI; }
    if (creatures[i].y > ARENA_SIZE) { creatures[i].y = ARENA_SIZE; creatures[i].angle += PI; }
    
    // Continuous Metabolism, Morphology Tax, and Senescence (Aging)
    float baseline = 0.10 * creatures[i].gene_size; // Larger bodies burn more resting energy
    float movementTax = abs(speed) * 0.03 * creatures[i].gene_size; // Larger bodies take more energy to move
    float visionTax = creatures[i].gene_vision * 0.0005; // Having huge vision burns energy
    float ageTax = creatures[i].age * 0.0002; // Getting older burns more energy (Forces R/K selection!)
    
    float metabolism = (baseline + movementTax + visionTax + ageTax) * (1.0 + (envRadiation * 0.03)); 
    creatures[i].energy -= metabolism;
    
    // STOCHASTIC MORTALITY (Random Death)
    // 0.05% chance per tick to die from disease, parasite, or random accident
    if (random(10000) < 5) {
        creatures[i].energy = -1.0;
    }
    
    if (creatures[i].energy <= 0) {
      creatures[i].alive = false;
      aliveCount--;
      
      // TRUE EXTINCTION / GENESIS RESTART
      // Without the Alpha Vault, total extinction triggers a hard reset of the ecosystem
      if (aliveCount == 0) {
         initEcosystem();
         return; // Break out of physics loop to let init take over
      }
      
      // BACTERIAL TOXICITY: Dead organisms lyse and release toxic waste.
      for (int f = 0; f < NUM_ITEMS; f++) {
         if (!items[f].active) {
            items[f].x = creatures[i].x;
            items[f].y = creatures[i].y;
            items[f].type = -1; // -1 = Poison
            items[f].active = true;
            break;
         }
      }
      continue;
    }
    
    // Mitosis (Asexual Reproduction / Cloning)
    // Asexual reproduction barrier scales with Body Size! Large organisms must hoard massive energy.
    float mitosis_barrier = 160.0 * creatures[i].gene_size; 
    
    if (creatures[i].energy > mitosis_barrier) {
       // Find an empty grave slot to spawn the child
       int emptySlot = -1;
       for(int j=0; j<MAX_CREATURES; j++) {
           if (!creatures[j].alive) { emptySlot = j; break; }
       }
       if (emptySlot != -1) {
          creatures[emptySlot].x = creatures[i].x + randomFloat(-30, 30);
          creatures[emptySlot].y = creatures[i].y + randomFloat(-30, 30);
          creatures[emptySlot].angle = randomFloat(0, 2*PI);
          creatures[emptySlot].energy = 80.0;
          creatures[emptySlot].age = 0; // Child starts at age 0
          
          // Mitosis is brutally expensive (cost: 120 energy) compared to sex (cost: 40 energy)
          creatures[i].energy -= 120.0; 
          creatures[emptySlot].alive = true;
          aliveCount++;
          totalBirths++;
          
          // WiFi Radiation (Signal Strength) drives mutation rate!
          int saltationChance = 5 + envRadiation; // Base 5% + Radiation Score
          if (saltationChance > 100) saltationChance = 100; // Cap at 100% mutation
          float mutSeverity = 0.1 + (envRadiation * 0.01); // Severity scales with proximity
          
          // Genetic Inheritance & Color Speciation
          if (random(100) < saltationChance) { 
              creatures[emptySlot].hue = random(0, 360); // Radical mutation = completely new species color
          } else {
              creatures[emptySlot].hue = creatures[i].hue + randomFloat(-10, 10); // Slight drift
          }
          if (creatures[emptySlot].hue < 0) creatures[emptySlot].hue += 360;
          if (creatures[emptySlot].hue > 360) creatures[emptySlot].hue -= 360;
          
          // Morphological drift
          creatures[emptySlot].gene_speed = creatures[i].gene_speed + randomFloat(-0.1, 0.1);
          creatures[emptySlot].gene_vision = creatures[i].gene_vision + randomFloat(-5.0, 5.0);
          if (creatures[emptySlot].gene_speed < 0.5) creatures[emptySlot].gene_speed = 0.5;
          if (creatures[emptySlot].gene_speed > 4.0) creatures[emptySlot].gene_speed = 4.0;
          if (creatures[emptySlot].gene_vision < 20.0) creatures[emptySlot].gene_vision = 20.0;
          if (creatures[emptySlot].gene_vision > 200.0) creatures[emptySlot].gene_vision = 200.0;

          for (int w = 0; w < 100; w++) {
            creatures[emptySlot].w[w] = creatures[i].w[w];
            if (random(100) < saltationChance) { 
              creatures[emptySlot].w[w] = randomFloat(-1.0, 1.0); // Saltation (scrambled)
            } else {
              creatures[emptySlot].w[w] += randomFloat(-mutSeverity, mutSeverity); // Micro-mutation
              if (creatures[emptySlot].w[w] > 2.0) creatures[emptySlot].w[w] = 2.0;
              if (creatures[emptySlot].w[w] < -2.0) creatures[emptySlot].w[w] = -2.0;
            }
          }
       } else {
           creatures[i].energy = 160.0; // Cap energy if world is overpopulated
       }
    }
  }
}

// --- WEB DASHBOARD ---

const char index_html[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Silicon Petri Dish</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
    body { background-color: #0b0c10; color: #c5c6c7; font-family: 'Share Tech Mono', monospace; padding: 10px; text-align: center; margin: 0; }
    h1 { color: #66fcf1; font-size: 1.6rem; text-shadow: 0 0 10px rgba(102,252,241,0.5); margin: 15px 0 5px 0;}
    h3 { color: #ff007f; margin-top: 0; font-size: 1rem; font-weight: normal; margin-bottom: 20px; }
    .stats { display: flex; flex-wrap: wrap; justify-content: center; gap: 20px; font-size: 1.1rem; margin-bottom: 15px; max-width: 800px; margin: 0 auto 15px auto; }
    .val { color: #fff; font-weight: bold; }
    .dom-tracker { width: 100%; font-size: 1.3rem; background: rgba(31,40,51,0.8); padding: 10px; border-radius: 8px; border: 1px solid #45a29e; }
    
    canvas { 
        background: #1f2833; 
        border: 2px solid #45a29e; 
        border-radius: 8px; 
        width: 100%; 
        max-width: 800px; 
        display: block;
        margin: 0 auto;
    }
    #arena { aspect-ratio: 1 / 1; box-shadow: 0 0 15px rgba(69,162,158,0.2); }
    #graph { aspect-ratio: 800 / 150; margin-top: 10px; background: #0b0c10; border-color: #333; }
    
    .explainer { max-width: 800px; margin: 20px auto; color: #a0a4a8; text-align: left; line-height: 1.6; font-size: 0.95rem; background: rgba(31,40,51,0.5); padding: 20px; border-radius: 8px; box-sizing: border-box; }
    .explainer h2 { color: #45a29e; font-size: 1.3rem; border-bottom: 1px solid #45a29e; padding-bottom: 5px; margin-top: 0;}
    .explainer h3 { color: #66fcf1; margin-top: 20px; font-size: 1.1rem; margin-bottom: 5px; }
    ul { padding-left: 20px; margin-top: 5px; }
    li { margin-bottom: 8px; }
    .tag-food { color: #66fcf1; font-weight: bold; }
    .tag-poison { color: #ff0033; font-weight: bold; }
    .btn { padding: 10px 20px; font-family: 'Share Tech Mono'; background: #1f2833; color: #66fcf1; border: 1px solid #45a29e; border-radius: 4px; cursor: pointer; transition: 0.2s; }
    .btn:hover { background: #45a29e; color: #0b0c10; }
    .btn-red { color: #ff0033; border-color: #ff0033; }
    .btn-red:hover { background: #ff0033; color: #0b0c10; }
    .spore-vault { padding: 10px 20px; background: rgba(31,40,51,0.8); border: 1px solid #a0a4a8; border-radius: 4px; display: inline-block; }
  </style>
</head>
<body>
  <h1>// THE SILICON PETRI DISH</h1>
  <h3>Native ESP32 Evolutionary Simulation</h3>
  
  <div class="stats">
    <div>Pop: <span id="alive" class="val">0</span> / 50</div>
    <div>Generation: <span id="exts" class="val">0</span></div>
    <div>Epoch Age: <span id="age" class="val">0s</span></div>
    <div>Radiation: <span id="rad" class="val" style="color: #00ffcc;">0</span></div>
    <div class="dom-tracker">Dominant Species: <span id="dominant" class="val">Analyzing...</span> <span id="trend" style="font-size: 0.8em; color: #a0a4a8;"></span></div>
  </div>
  
  <canvas id="arena" width="800" height="800"></canvas>
  <canvas id="graph" width="800" height="150"></canvas>
  
  <div class="explainer">
    <h2>What am I looking at?</h2>
    <p>This is a live ecosystem running mathematically on the microcontroller. These organisms possess tiny neural networks that dictate their movement based on their vision. They must learn to hunt <span class="tag-food">Cyan Food</span> and avoid <span class="tag-poison">Red Poison</span> to survive. This is a continuous, unbounded ecosystem with no safe respawns—only raw survival.</p>
    
    <div style="margin: 15px 0; display: flex; justify-content: center; gap: 15px; flex-wrap: wrap;">
      <button id="audioBtn" class="btn">[ Enable Geiger Audio ]</button>
      <button onclick="fetch('/api/asteroid')" class="btn btn-red">[ TRIGGER ASTEROID ]</button>
      <div class="spore-vault">Spore Vault: <span id="spore-color" style="font-weight: bold; text-shadow: 0 0 5px rgba(255,255,255,0.5);">Empty</span></div>
    </div>
    <p style="font-size: 0.8em; color: #a0a4a8; text-align: center; margin-top: -5px;">(Tap the arena above to trigger "God Mode" and drop resources)</p>

    <h3>What to Observe (Biological Phenomena):</h3>
    <ul>
      <li><strong>Evolutionary Timeline (Graph):</strong> The chart above tracks live population data. You can watch as one genetic species overtakes the others, or watch mass extinctions wipe the slate clean.</li>
      <li><strong>Circadian Rhythms (Day/Night):</strong> The environment cycles between Day and Night every 60 seconds. At night, organisms' vision is severely reduced, forcing them to adapt their hunting strategies.</li>
      <li><strong>Speciation (Colors):</strong> An organism's color represents its genetic code. Children inherit their parent's color. If a specific color takes over the screen, that species has successfully evolved to dominate the ecosystem!</li>
      <li><strong>Interaction Beams (Visualizing Math):</strong> When organisms physically bump, they interact mathematically. You will see a <span style="color:#00ffcc;">Green Beam</span> if they are sharing energy (Mutualism/Kin Selection), or a <span style="color:#ff0033;">Red Lightning Bolt</span> if the stronger species is attacking and stealing energy (Predation).</li>
      <li><strong>Classification (Poison):</strong> The organisms' neural networks process sensory input to tell them the "Type" of the nearest dot. They must mathematically evolve the ability to classify the colors—chasing the cyan while fleeing the red.</li>
      <li><strong>Mitosis (Continuous Reproduction):</strong> If an agent successfully eats enough food to reach 160% energy, it instantly splits in half (Mitosis), dropping a genetically mutated child next to it.</li>
      <li><strong>Bacterial Toxicity (Death Phase):</strong> In closed cultures, dead organisms lyse and release toxic metabolic waste. When an organism dies here, its corpse releases a Red Poison dot. A high death rate will rapidly pollute the arena!</li>
      <li><strong>Horizontal Gene Transfer (Conjugation):</strong> If organisms bump into each other, they occasionally undergo Conjugation, randomly swapping a piece of their neural DNA.</li>
      <li><strong>Endospore Germination (The Last Survivor):</strong> If a mass extinction occurs (or you trigger an Asteroid), the exact DNA and Color of the absolute last organism to starve is encoded into the Spore Vault. When the arena stabilizes, the new population inherits the ultimate champion's traits.</li>
    </ul>

    <h3>Interactive Radiation Demo:</h3>
    <p>Turn on your phone's <strong>WiFi Hotspot</strong> and hold it against the glass! The ESP32 calculates Environmental Radiation based on the <em>Signal Strength (RSSI)</em> of nearby WiFi networks.</p>
    <ul>
      <li>High proximity radiation causes a <strong>Red Radar Pulse</strong>.</li>
      <li>Organisms become irradiated (glowing aura) and the Electromagnetic Field physically pushes them around.</li>
      <li><strong>Radical Speciation:</strong> Radiation severely damages their DNA. If they reproduce while irradiated, they will spawn drastically mutated children with completely new colors—creating an entirely new species on the spot!</li>
    </ul>
  </div>
  
  <script>
    const canvas = document.getElementById('arena');
    const ctx = canvas.getContext('2d');
    const gCtx = document.getElementById('graph').getContext('2d');
    
    let targetCreatures = [];
    let currentCreatures = [];
    let items = [];
    let currentRad = 0;
    let alphaIndex = -1;
    let ripples = [];
    let currentDay = 1.0;
    
    // Audio Context for Geiger Counter
    let audioCtx = null;
    document.getElementById('audioBtn').addEventListener('click', () => {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            document.getElementById('audioBtn').innerText = "[ Audio Enabled ]";
            document.getElementById('audioBtn').style.color = "#ff007f";
            document.getElementById('audioBtn').style.borderColor = "#ff007f";
        }
    });

    function playClick() {
        if (!audioCtx) return;
        let osc = audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = 400 + Math.random()*400; // Random pitch click
        let gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.03);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.03);
    }
    
    // Geiger Counter loop
    setInterval(() => {
        if (currentRad > 2) {
            // High rad = more frequent clicks
            let clicks = Math.floor(Math.random() * (currentRad / 2));
            for(let i=0; i<clicks; i++) {
                setTimeout(playClick, Math.random() * 100);
            }
        }
    }, 100);

    // God Mode Touch Interaction
    canvas.addEventListener('mousedown', handleTouch);
    canvas.addEventListener('touchstart', handleTouch, {passive: false});

    function handleTouch(e) {
        if(e.cancelable) e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        let clientX = e.clientX || (e.touches && e.touches[0].clientX);
        let clientY = e.clientY || (e.touches && e.touches[0].clientY);
        
        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;
        
        fetch(`/api/touch?x=${x}&y=${y}`);
        ripples.push({x: x, y: y, r: 0, alpha: 1}); // Add visual ripple
    }
    
    let popHistory = [];
    const maxHistory = 100;
    
    function getSpeciesName(hue) {
       if (hue < 15 || hue >= 345) return "Red Strain";
       if (hue < 45) return "Orange Strain";
       if (hue < 75) return "Yellow Strain";
       if (hue < 105) return "Lime Strain";
       if (hue < 135) return "Green Strain";
       if (hue < 165) return "Teal Strain";
       if (hue < 195) return "Cyan Strain";
       if (hue < 225) return "Blue Strain";
       if (hue < 255) return "Indigo Strain";
       if (hue < 285) return "Purple Strain";
       if (hue < 315) return "Magenta Strain";
       return "Pink Strain";
    }

    function updateGraphData() {
        let bins = new Array(12).fill(0);
        let total = 0;
        for(let i=0; i<50; i++) {
            if(currentCreatures[i] && currentCreatures[i].alive) {
                let binIndex = Math.floor(((currentCreatures[i].hue + 15) % 360) / 30);
                bins[binIndex]++;
                total++;
            }
        }
        popHistory.push(bins);
        if(popHistory.length > maxHistory) popHistory.shift();

        let maxCount = 0;
        let dominantBin = -1;
        for(let i=0; i<12; i++) {
           if(bins[i] > maxCount) { maxCount = bins[i]; dominantBin = i; }
        }
        
        let domEl = document.getElementById('dominant');
        let trendEl = document.getElementById('trend');
        
        if(dominantBin !== -1 && total > 0) {
           domEl.innerText = `${getSpeciesName(dominantBin * 30)} (${Math.round(maxCount/total*100)}%)`;
           domEl.style.color = `hsl(${dominantBin * 30}, 100%, 60%)`;
           
           if (popHistory.length > 10) {
               let pastBins = popHistory[popHistory.length - 10];
               let growth = bins[dominantBin] - pastBins[dominantBin];
               if (growth > 0) {
                   trendEl.innerText = `[Projected: Dominance (+${growth}/5s)]`;
                   trendEl.style.color = "#00ffcc";
               } else if (growth < 0) {
                   trendEl.innerText = `[Projected: Collapse (${growth}/5s)]`;
                   trendEl.style.color = "#ff0033";
               } else {
                   trendEl.innerText = `[Projected: Stable]`;
                   trendEl.style.color = "#a0a4a8";
               }
           }
        } else {
           domEl.innerText = "Extinct (Germinating...)";
           domEl.style.color = "#888";
           trendEl.innerText = "";
        }
    }
    
    function drawGraph() {
        gCtx.clearRect(0, 0, 800, 150);
        if(popHistory.length < 2) return;
        let w = 800 / (maxHistory - 1);
        
        for(let bin=0; bin<12; bin++) {
            gCtx.fillStyle = `hsla(${bin*30}, 100%, 50%, 0.8)`;
            gCtx.beginPath();
            
            for(let t=0; t<popHistory.length; t++) {
                let sum = 0;
                for(let b=0; b<=bin; b++) sum += popHistory[t][b];
                gCtx.lineTo(t * w, 150 - (sum * 3));
            }
            for(let t=popHistory.length-1; t>=0; t--) {
                let sum = 0;
                for(let b=0; b<bin; b++) sum += popHistory[t][b];
                gCtx.lineTo(t * w, 150 - (sum * 3));
            }
            gCtx.closePath();
            gCtx.fill();
        }
        
        gCtx.fillStyle = 'rgba(255,255,255,0.7)';
        gCtx.font = '12px "Share Tech Mono"';
        gCtx.fillText("Species Population History (Live)", 10, 20);
    }
    
    function fetchState() {
      fetch('/api/state')
        .then(r => r.json())
        .then(data => {
          document.getElementById('alive').innerText = data.a;
          document.getElementById('exts').innerText = data.e;
          document.getElementById('rad').innerText = data.rad;
          document.getElementById('age').innerText = data.age + "s";
          
          currentRad = data.rad;
          alphaIndex = data.alpha;
          currentDay = data.day;
          
          let sporeEl = document.getElementById('spore-color');
          if (data.shas) {
              sporeEl.innerText = getSpeciesName(data.shue) + " DNA";
              sporeEl.style.color = `hsl(${data.shue}, 100%, 60%)`;
          } else {
              sporeEl.innerText = "Empty";
              sporeEl.style.color = "#a0a4a8";
          }
          
          let radEl = document.getElementById('rad');
          if (data.rad > 15) {
              radEl.style.color = "#ff0055";
              radEl.style.textShadow = "0 0 15px #ff0055";
          } else {
              radEl.style.color = "#00ffcc";
              radEl.style.textShadow = "none";
          }
          
          items = data.f;
          data.c.forEach((c, i) => {
             targetCreatures[i] = {x: c[0], y: c[1], angle: c[2], alive: c[3], hue: c[4]};
             if (!currentCreatures[i]) currentCreatures[i] = {...targetCreatures[i]};
             else currentCreatures[i].hue = targetCreatures[i].hue;
          });
        }).catch(()=>{});
    }
    
    function draw() {
        // Interpolate Day/Night Background Color
        let r = Math.floor(5 + (26 * currentDay));
        let g = Math.floor(6 + (34 * currentDay));
        let b = Math.floor(8 + (43 * currentDay));
        canvas.style.backgroundColor = `rgb(${r},${g},${b})`;
        
        ctx.clearRect(0, 0, 800, 800);
        
        if (currentRad > 5) {
            ctx.fillStyle = `rgba(0, 255, 100, ${Math.min(currentRad * 0.01, 0.2)})`;
            ctx.fillRect(0, 0, 800, 800);
            
            let pulse = (Date.now() / 30) % 100;
            ctx.beginPath();
            ctx.arc(400, 400, 50 + pulse*5, 0, Math.PI*2);
            ctx.strokeStyle = `rgba(255, 0, 85, ${(1.0 - pulse/100.0) * 0.8})`;
            ctx.lineWidth = 4;
            ctx.stroke();
        }
        
        // Draw Interaction Beams (Client-Side Prediction of Math)
        for(let i=0; i<50; i++) {
            if(!currentCreatures[i] || !currentCreatures[i].alive) continue;
            for(let j=i+1; j<50; j++) {
                if(!currentCreatures[j] || !currentCreatures[j].alive) continue;
                let dx = currentCreatures[i].x - currentCreatures[j].x;
                let dy = currentCreatures[i].y - currentCreatures[j].y;
                let distSq = dx*dx + dy*dy;
                if(distSq < 1500) { // Near enough to visually interact
                    let hueDiff = Math.abs(currentCreatures[i].hue - currentCreatures[j].hue);
                    if(hueDiff > 180) hueDiff = 360 - hueDiff;
                    
                    ctx.beginPath();
                    ctx.moveTo(currentCreatures[i].x, currentCreatures[i].y);
                    if (hueDiff < 20) {
                        // Kin Selection (Green Sharing Beam)
                        ctx.lineTo(currentCreatures[j].x, currentCreatures[j].y);
                        ctx.strokeStyle = 'rgba(0, 255, 150, 0.6)';
                    } else {
                        // Predation (Red Lightning Strike)
                        ctx.lineTo(currentCreatures[j].x + (Math.random()-0.5)*15, currentCreatures[j].y + (Math.random()-0.5)*15);
                        ctx.strokeStyle = 'rgba(255, 0, 50, 0.8)';
                    }
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                }
            }
        }
        
        // Draw Ripples (God Mode)
        for (let i = ripples.length - 1; i >= 0; i--) {
            let r = ripples[i];
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.r, 0, Math.PI*2);
            ctx.strokeStyle = `rgba(102, 252, 241, ${r.alpha})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            r.r += 2;
            r.alpha -= 0.02;
            if (r.alpha <= 0) ripples.splice(i, 1);
        }
        
        items.forEach(f => {
            ctx.fillStyle = (f[2] === 1) ? '#66fcf1' : '#ff0033';
            ctx.beginPath();
            ctx.arc(f[0], f[1], 4, 0, Math.PI*2);
            ctx.fill();
        });
        
        for(let i=0; i<50; i++) {
            if(!targetCreatures[i]) continue;
            let t = targetCreatures[i];
            let c = currentCreatures[i];
            
            if(t.alive === 0) {
                c.alive = 0;
                c.x = t.x; c.y = t.y; c.angle = t.angle;
            } else {
                if(c.alive === 0 || Math.abs(c.x - t.x) > 50) {
                    c.x = t.x; c.y = t.y; c.angle = t.angle;
                } else {
                    c.x += (t.x - c.x) * 0.1;
                    c.y += (t.y - c.y) * 0.1;
                    let da = t.angle - c.angle;
                    while(da > Math.PI) da -= 2*Math.PI;
                    while(da < -Math.PI) da += 2*Math.PI;
                    c.angle += da * 0.1;
                }
                c.alive = 1;
            }
            
            ctx.save();
            ctx.translate(c.x, c.y);
            
            if(c.alive !== 0) {
                // Draw Vision Radius at night (faintly)
                if (currentDay < 0.5) {
                    ctx.beginPath();
                    ctx.arc(0, 0, 50 + (100 * currentDay), 0, Math.PI*2);
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                } else {
                    ctx.beginPath();
                    ctx.arc(0, 0, 150, 0, Math.PI*2);
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
                
                if (currentRad > 10) {
                    ctx.beginPath();
                    ctx.arc(0, 0, 25, 0, Math.PI*2);
                    ctx.fillStyle = `hsla(${c.hue}, 100%, 50%, 0.25)`;
                    ctx.fill();
                }
                
                // Highlight the Alpha (Highest Energy Organism)
                if (i === alphaIndex) {
                    ctx.beginPath();
                    ctx.arc(0, 0, 20 + Math.sin(Date.now()/150)*5, 0, Math.PI*2);
                    ctx.strokeStyle = 'gold';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = 'gold';
                }
            }
            
            ctx.rotate(c.angle);
            ctx.fillStyle = (c.alive === 0) ? 'rgba(100, 100, 100, 0.3)' : `hsl(${c.hue}, 100%, 50%)`;
            
            ctx.beginPath();
            ctx.moveTo(10, 0);
            ctx.lineTo(-6, -6);
            ctx.lineTo(-4, 0);
            ctx.lineTo(-6, 6);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        
        drawGraph();
        requestAnimationFrame(draw);
    }
    
    setInterval(fetchState, 100); 
    setInterval(updateGraphData, 500);
    requestAnimationFrame(draw); 
  </script>
</body>
</html>
)rawliteral";

void handleTouch() {
  if (server.hasArg("x") && server.hasArg("y")) {
    float tx = server.arg("x").toFloat();
    float ty = server.arg("y").toFloat();
    // Spawn 3 food items and 1 poison around the tap
    for(int i=0; i<4; i++) {
       int emptySlot = -1;
       for(int j=0; j<NUM_ITEMS; j++) {
         if(!items[j].active) { emptySlot = j; break; }
       }
       if(emptySlot != -1) {
         items[emptySlot].x = tx + randomFloat(-20, 20);
         items[emptySlot].y = ty + randomFloat(-20, 20);
         items[emptySlot].type = (i == 3) ? -1 : 1; // 3 food, 1 poison
         items[emptySlot].active = true;
       }
    }
    server.send(200, "text/plain", "ok");
  } else {
    server.send(400, "text/plain", "err");
  }
}

void handleAsteroid() {
  for(int i=0; i<MAX_CREATURES; i++) {
     if(creatures[i].alive && random(100) < 95) {
         creatures[i].energy = 0; // Trigger death and spore check next tick
     }
  }
  server.send(200, "text/plain", "boom");
}

void handleRoot() {
  server.send(200, "text/html", index_html);
}

void handleState() {
  int alphaIndex = -1;
  float maxEnergy = -1.0;
  for(int i = 0; i < MAX_CREATURES; i++) {
     if(creatures[i].alive && creatures[i].energy > maxEnergy) {
        maxEnergy = creatures[i].energy;
        alphaIndex = i;
     }
  }

  float dayCycle = (sin(millis() * 2.0 * PI / 60000.0) + 1.0) / 2.0;
  unsigned long epochAge = (millis() - epochStartMillis) / 1000;

  String json = "{\"e\":" + String(extinctions) + ",\"a\":" + String(aliveCount) + ",\"b\":" + String(totalBirths) + ",\"rad\":" + String(envRadiation) + ",\"alpha\":" + String(alphaIndex) + ",\"day\":" + String(dayCycle, 2) + ",\"shas\":0,\"shue\":0,\"age\":" + String(epochAge) + ",\"c\":[";
  for(int i = 0; i < MAX_CREATURES; i++) {
    json += "[" + String(creatures[i].x, 1) + "," + String(creatures[i].y, 1) + "," + String(creatures[i].angle, 2) + "," + String(creatures[i].alive ? 1 : 0) + "," + String(creatures[i].hue, 0) + "]";
    if(i < MAX_CREATURES - 1) json += ",";
  }
  json += "],\"f\":[";
  bool firstItem = true;
  for(int i = 0; i < NUM_ITEMS; i++) {
    if (items[i].active) {
      if (!firstItem) json += ",";
      json += "[" + String(items[i].x, 1) + "," + String(items[i].y, 1) + "," + String(items[i].type) + "]";
      firstItem = false;
    }
  }
  json += "]}";
  
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Cache-Control", "no-cache");
  server.send(200, "application/json", json);
}

void setup() {
  Serial.begin(115200);
  
  randomSeed(esp_random());
  
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) delay(500);

  Serial.println();
  Serial.print("Server running at: http://");
  Serial.print(WiFi.localIP());
  Serial.println(":80");

  server.on("/", HTTP_GET, handleRoot);
  server.on("/api/state", HTTP_GET, handleState);
  server.on("/api/touch", HTTP_GET, handleTouch);
  server.on("/api/asteroid", HTTP_GET, handleAsteroid);
  server.begin();
  
  initEcosystem();
}

void loop() {
  server.handleClient();
  
  // Handle async WiFi scanning (Environmental Radiation by RSSI / Signal Strength)
  int n = WiFi.scanComplete();
  if (n == WIFI_SCAN_FAILED) {
    WiFi.scanNetworks(true); // Restart scan
  } else if (n >= 0) {
    int totalRad = 0;
    for (int i = 0; i < n; i++) {
      int rssi = WiFi.RSSI(i);
      // Filter out background noise! Only count signals that are physically close.
      // Normal room WiFi is -70 to -90. A phone near the chip is -30 to -50.
      if (rssi > -60) {
        // Map close proximity (-60 to -30) to a massive radiation spike (1 to 15)
        int score = map(rssi, -60, -30, 1, 15);
        if (score < 0) score = 0;
        if (score > 15) score = 15;
        totalRad += score;
      }
    }
    envRadiation = totalRad;
    WiFi.scanDelete(); // Clear memory
    WiFi.scanNetworks(true); // Start next scan
  }
  
  unsigned long currentMillis = millis();
  if (currentMillis - lastTick > 50) {
    tickPhysics();
    lastTick = millis();
  }
}
