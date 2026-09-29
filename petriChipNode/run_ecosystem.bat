@echo off
echo ===================================================
echo  Silicon Petri Dish - AI Ecosystem Launcher
echo ===================================================
echo.
echo [1/4] Checking Python dependencies (this may take a moment if first time)...
pip install -q -r pytorch_requirements.txt

echo.
echo [2/4] Starting Node.js Simulation Server...
start cmd /k "title Node.js Ecosystem Server && node server_v4.js"

echo.
echo [3/4] Waiting for server to initialize...
timeout /t 3 /nobreak >nul

echo.
echo [4/4] Opening Research Terminal in browser...
start http://localhost:3004

echo.
echo ===================================================
echo  Starting PyTorch Reinforcement Learning Agent!
echo  (Keep this window open to run the AI observer)
echo  (Close the Node.js window manually when done)
echo ===================================================
python pytorch_observer.py
