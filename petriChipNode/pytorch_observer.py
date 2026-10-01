import socketio
import threading

training_lock = threading.Lock()
import torch
import torch.nn as nn
import torch.optim as optim
import random
import time
import numpy as np
from collections import deque

# ---------------------------------------------------------
# PyTorch Deep Q-Network for Ecosystem Management
# ---------------------------------------------------------
class EnvironmentGodNet(nn.Module):
    def __init__(self, input_size, hidden_size, output_size):
        super(EnvironmentGodNet, self).__init__()
        # Upgraded to a deeper network with 128 neurons to actually process ecosystem complexity
        self.network = nn.Sequential(
            nn.Linear(input_size, hidden_size),
            nn.LayerNorm(hidden_size),
            nn.ReLU(),
            nn.Linear(hidden_size, hidden_size),
            nn.LayerNorm(hidden_size),
            nn.ReLU(),
            nn.Linear(hidden_size, hidden_size),
            nn.ReLU(),
            nn.Linear(hidden_size, output_size)
        )

    def forward(self, state):
        return self.network(state)

# ---------------------------------------------------------
# RL Agent Configuration
# ---------------------------------------------------------
STATE_SIZE = 9  # pop, avg_size, avg_speed, avg_conn, max_lineage, max_age, food, poison, fertilizer
ACTION_SIZE = 6 # 0: Nothing, 1: Food Drop, 2: Radiation, 3: Smite, 4: Mutate, 5: Meteor

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
# DOUBLE DQN ARCHITECTURE
model = EnvironmentGodNet(STATE_SIZE, 128, ACTION_SIZE).to(device)
target_model = EnvironmentGodNet(STATE_SIZE, 128, ACTION_SIZE).to(device)
target_model.load_state_dict(model.state_dict())
target_model.eval()

optimizer = optim.Adam(model.parameters(), lr=0.0005) # Lower LR for stability
loss_fn = nn.SmoothL1Loss() # Huber loss prevents exploding gradients

# Memory and Hyperparameters
memory = deque(maxlen=10000)
TAU = 0.005 # Polyak averaging rate
gamma = 0.95
epsilon = 0.1       # Exploration rate lowered
epsilon_min = 0.05
epsilon_decay = 0.995

# State Tracking
previous_state_tensor = None
previous_action = 0
last_max_lineage = 0
last_population = 0
last_extinctions = 0

# Socket.IO Client
sio = socketio.Client()

def extract_state(data):
    """ Converts the Node.js JSON payload into a PyTorch tensor """
    pop = data.get('a', 0)
    avg_size = data.get('asz', 0.0)
    avg_speed = data.get('asp', 0.0)
    avg_conn = data.get('aconn', 0.0)
    max_lineage = data.get('mL', 0)
    max_age = data.get('mA', 0)
    food = data.get('fC', 0)
    poison = data.get('pC', 0)
    fert = data.get('fert', 0.0)
    
    state = np.array([pop, avg_size, avg_speed, avg_conn, max_lineage, max_age, food, poison, fert], dtype=np.float32)
    # Normalize heavily skewed variables
    state[0] /= 600.0  # max pop
    state[6] /= 1500.0 # max items
    state[7] /= 1500.0
    state[8] /= 50000.0 
    return torch.FloatTensor(state).unsqueeze(0).to(device)

@sio.event
def connect():
    print("PyTorch God Agent Connected to Ecosystem!")

@sio.event
def disconnect():
    print("Disconnected from Ecosystem.")

@sio.on('state')
def on_state(data):
    global previous_state_tensor, previous_action, epsilon
    global last_max_lineage, last_population, last_extinctions, last_avg_conn

    # Only process states every 1 in 10 broadcasts to prevent flooding
    if random.random() > 0.1: return 

    current_state = extract_state(data)
    current_lineage = data.get('mL', 0)
    current_pop = data.get('a', 0)
    current_extinctions = data.get('e', 0)
    current_conn = data.get('aconn', 0.0)

    # 1. Calculate Reward
    reward = 0
    if previous_state_tensor is not None:
        # Reward for brain complexity (SMART and THRIVING)
        if current_conn > last_avg_conn:
            reward += (current_conn - last_avg_conn) * 15.0
            
        # Reward for evolutionary progress (lineage depth)
        if current_lineage > last_max_lineage:
            reward += (current_lineage - last_max_lineage) * 2.0
        
        # Reward for keeping ecosystem alive
        if current_pop > 50:
            reward += 0.5
        elif current_pop == 0 or current_extinctions > last_extinctions:
            reward -= 50.0 # Extinction penalty
            
        # Severe Penalty for using Meteor/Smite unnecessarily
        if previous_action in [3, 5]:
            reward -= 10.0 # Discourage boom-bust weapons

        # Store in Replay Memory
        memory.append((previous_state_tensor, previous_action, reward, current_state))
        
        # Train Network (Experience Replay)
        if len(memory) > 64:
            with training_lock:
                batch = random.sample(memory, 64)
                states = torch.cat([b[0] for b in batch])
                actions = torch.LongTensor([b[1] for b in batch]).to(device)
                rewards = torch.FloatTensor([b[2] for b in batch]).to(device)
                next_states = torch.cat([b[3] for b in batch])
    
                # Double DQN Update (Prevents overestimating destructive actions)
                current_q = model(states).gather(1, actions.unsqueeze(1)).squeeze(1)
                
                with torch.no_grad():
                    # Main model picks the action, target model evaluates it
                    next_actions = model(next_states).argmax(1, keepdim=True)
                    next_q = target_model(next_states).gather(1, next_actions).squeeze(1)
                    target_q = rewards + (gamma * next_q)
    
                loss = loss_fn(current_q, target_q)
                optimizer.zero_grad()
                loss.backward()
                # Gradient clipping to prevent learning spikes
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
                optimizer.step()
                
                # Polyak Soft Update for Target Network
                for target_param, model_param in zip(target_model.parameters(), model.parameters()):
                    target_param.data.copy_(TAU * model_param.data + (1.0 - TAU) * target_param.data)

    # 2. Choose Next Action
    if random.random() <= epsilon:
        action = random.randrange(ACTION_SIZE)
    else:
        with torch.no_grad():
            q_values = model(current_state)
            action = torch.argmax(q_values).item()

    # 3. Execute Action on Node.js Server
    execute_action(action, data)

    # Update trackers
    previous_state_tensor = current_state
    previous_action = action
    last_max_lineage = current_lineage
    last_population = current_pop
    last_extinctions = current_extinctions
    last_avg_conn = current_conn

    if epsilon > epsilon_min:
        epsilon *= epsilon_decay

def execute_action(action, state_data):
    arena_size = state_data.get('arenaSize', 3000)
    pop = state_data.get('a', 0)
    
    import random
    # SAFETY LOCK: Severely restrict destructive actions to encourage thriving
    if action in [3, 5]:
        if pop < 300:
            reason = f"Destructive intervention aborted. Planetary population ({pop}) is below critical threshold. Permitting current neural dynasties to mature."
            print(f"[{time.strftime('%X')}] 🛡️ {reason}")
            sio.emit('ai_god_log', f"<span style='color:#777'>[OBSERVER] VETO</span> - {reason}")
            return
        elif random.random() < 0.8:
            reason = "Destructive action blocked by overriding safety protocols. The ecosystem displays sufficient neuro-complexity to self-regulate."
            print(f"[{time.strftime('%X')}] 🛡️ {reason}")
            sio.emit('ai_god_log', f"<span style='color:#777'>[OBSERVER] VETO</span> - {reason}")
            return

    
    if action == 0:
        if random.random() < 0.15: # 15% chance to drop a profound observation
            obs = random.choice([
                "Analyzing Lamarckian neuro-plasticity drift. The network topology is self-optimizing.",
                "Trophic equilibrium achieved. Carbon-cycle metabolism is running at optimal efficiency.",
                "Observing lateral gene transfer in the lower trophic layers. Remarkable structural adaptations.",
                "The neural architecture of the apex lineage is displaying signs of rudimentary spatial awareness.",
                "Ecosystem stability holds. Interference is mathematically unnecessary at this epoch."
            ])
            print(f"[{time.strftime('%X')}] 👁️ {obs}")
            sio.emit('ai_god_log', f"<span style='color:#34d399'>[OBSERVER] TELEMETRY ANALYSIS</span> - {obs}")
        pass # Observe silently
    elif action == 1:
        # Food Drop in the center
        reason = "Metabolic collapse detected. Injecting synthetic lipid-hydrocarbon chains to stabilize the primary trophic layer and prevent systemic energy starvation."
        print(f"[{time.strftime('%X')}] ⚡ AI Intervention: {reason}")
        sio.emit('ai_god_log', f"<span style='color:#73f4df'>[OBSERVER] ACTION: RESOURCE INJECTION</span> - {reason}")
        sio.emit('paint_brush', {'type': 'food', 'x': arena_size/2, 'y': arena_size/2, 'radius': 500})
    elif action == 2:
        reason = "Genomic convergence detected. Initiating globally-saturating ionizing radiation pulse to destabilize DNA topologies and force rapid neuro-plastic divergence."
        print(f"[{time.strftime('%X')}] ⚡ AI Intervention: {reason}")
        sio.emit('ai_god_log', f"<span style='color:#f7c873'>[OBSERVER] ACTION: RADIATION BURST</span> - {reason}")
        sio.emit('trigger_radiation')
    elif action == 3:
        # Smite a random quadrant to create a population bottleneck
        reason = "Trophic stagnation identified. Executing localized kinetic culling to artificially induce a genetic bottleneck, pruning weak synaptic networks."
        print(f"[{time.strftime('%X')}] ⚡ AI Intervention: {reason}")
        sio.emit('ai_god_log', f"<span style='color:#e9a7ff'>[OBSERVER] ACTION: TARGETED CULLING</span> - {reason}")
        rx = random.uniform(0, arena_size)
        ry = random.uniform(0, arena_size)
        sio.emit('paint_brush', {'type': 'smite', 'x': rx, 'y': ry, 'radius': 600})
    elif action == 4:
        reason = "Isolating geographical quadrant. Deploying localized mutagenic catalyst to accelerate synaptic bridging and force deep speciation."
        print(f"[{time.strftime('%X')}] ⚡ AI Intervention: {reason}")
        sio.emit('ai_god_log', f"<span style='color:#c7ff56'>[OBSERVER] ACTION: MUTAGENIC FIELD</span> - {reason}")
        rx = random.uniform(0, arena_size)
        ry = random.uniform(0, arena_size)
        sio.emit('paint_brush', {'type': 'mutate', 'x': rx, 'y': ry, 'radius': 600})
    elif action == 5:
        reason = "Synaptic entropy has reached maximum density. Initiating planetary-scale kinetic sterilization to shatter the evolutionary dead-end."
        print(f"[{time.strftime('%X')}] ⚡ AI Intervention: {reason}")
        sio.emit('ai_god_log', f"<span style='color:#e9a7ff; font-weight:bold;'>[OBSERVER] ACTION: PLANETARY STERILIZATION</span> - {reason}")
        sio.emit('trigger_meteor')

if __name__ == '__main__':
    print("Starting PyTorch Ecosystem RL Agent...")
    print(f"Using device: {device}")
    
    try:
        sio.connect('http://localhost:3004')
        sio.wait()
    except Exception as e:
        print("Make sure server_v4.js is running on port 3004!")
        print(e)
