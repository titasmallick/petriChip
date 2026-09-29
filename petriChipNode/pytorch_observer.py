import socketio
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
        self.network = nn.Sequential(
            nn.Linear(input_size, hidden_size),
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
model = EnvironmentGodNet(STATE_SIZE, 64, ACTION_SIZE).to(device)
optimizer = optim.Adam(model.parameters(), lr=0.001)
loss_fn = nn.MSELoss()

# Memory and Hyperparameters
memory = deque(maxlen=2000)
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
    global last_max_lineage, last_population, last_extinctions

    # Only process states every 1 in 10 broadcasts to prevent flooding
    if random.random() > 0.1: return 

    current_state = extract_state(data)
    current_lineage = data.get('mL', 0)
    current_pop = data.get('a', 0)
    current_extinctions = data.get('e', 0)

    # 1. Calculate Reward
    reward = 0
    if previous_state_tensor is not None:
        # Reward for evolutionary progress (lineage depth)
        if current_lineage > last_max_lineage:
            reward += (current_lineage - last_max_lineage) * 2.0
        
        # Reward for keeping ecosystem alive
        if current_pop > 50:
            reward += 0.1
        elif current_pop == 0 or current_extinctions > last_extinctions:
            reward -= 50.0 # Extinction penalty

        # Store in Replay Memory
        memory.append((previous_state_tensor, previous_action, reward, current_state))
        
        # Train Network (Experience Replay)
        if len(memory) > 32:
            batch = random.sample(memory, 32)
            states = torch.cat([b[0] for b in batch])
            actions = torch.LongTensor([b[1] for b in batch]).to(device)
            rewards = torch.FloatTensor([b[2] for b in batch]).to(device)
            next_states = torch.cat([b[3] for b in batch])

            # Q-Learning update
            current_q = model(states).gather(1, actions.unsqueeze(1)).squeeze(1)
            next_q = model(next_states).max(1)[0].detach()
            target_q = rewards + (gamma * next_q)

            loss = loss_fn(current_q, target_q)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

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

    if epsilon > epsilon_min:
        epsilon *= epsilon_decay

def execute_action(action, state_data):
    arena_size = state_data.get('arenaSize', 3000)
    pop = state_data.get('a', 0)
    
    # SAFETY LOCK: Do not allow Smite or Meteor if population is already critically low
    if pop < 150 and action in [3, 5]:
        print(f"[{time.strftime('%X')}] 🛡️ AI attempted to Smite/Meteor, but was vetoed by Safety Lock (Pop: {pop} < 150)")
        return

    
    if action == 0:
        pass # Observe silently
    elif action == 1:
        # Food Drop in the center
        reason = "Population is hungry or energy is low. Distributing manna (food)."
        print(f"[{time.strftime('%X')}] ⚡ AI Intervention: {reason}")
        sio.emit('ai_god_log', f"<span style='color:#73f4df'>[AI GOD] ACTION: Food Drop</span> - {reason}")
        sio.emit('paint_brush', {'type': 'food', 'x': arena_size/2, 'y': arena_size/2, 'radius': 500})
    elif action == 2:
        reason = "Evolution has stagnated. Triggering global radiation burst to force genetic mutations."
        print(f"[{time.strftime('%X')}] ⚡ AI Intervention: {reason}")
        sio.emit('ai_god_log', f"<span style='color:#f7c873'>[AI GOD] ACTION: Radiation Burst</span> - {reason}")
        sio.emit('trigger_radiation')
    elif action == 3:
        # Smite a random quadrant to create a population bottleneck
        reason = "Creating a population bottleneck (Smite) to weed out weak lineages and enforce survival of the fittest."
        print(f"[{time.strftime('%X')}] ⚡ AI Intervention: {reason}")
        sio.emit('ai_god_log', f"<span style='color:#e9a7ff'>[AI GOD] ACTION: Smite</span> - {reason}")
        rx = random.uniform(0, arena_size)
        ry = random.uniform(0, arena_size)
        sio.emit('paint_brush', {'type': 'smite', 'x': rx, 'y': ry, 'radius': 600})
    elif action == 4:
        reason = "Targeted mutation field deployed to encourage local speciation."
        print(f"[{time.strftime('%X')}] ⚡ AI Intervention: {reason}")
        sio.emit('ai_god_log', f"<span style='color:#c7ff56'>[AI GOD] ACTION: Mutate Area</span> - {reason}")
        rx = random.uniform(0, arena_size)
        ry = random.uniform(0, arena_size)
        sio.emit('paint_brush', {'type': 'mutate', 'x': rx, 'y': ry, 'radius': 600})
    elif action == 5:
        reason = "Ecosystem has hit a dead-end. Triggering Meteor Strike for a mass reset."
        print(f"[{time.strftime('%X')}] ⚡ AI Intervention: {reason}")
        sio.emit('ai_god_log', f"<span style='color:#e9a7ff; font-weight:bold;'>[AI GOD] ACTION: METEOR STRIKE</span> - {reason}")
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
