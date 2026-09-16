@echo off
TITLE IBVAP - Intelligent Border Video Analytics Platform (Prototype Launcher)
COLOR 0B

echo ===============================================================================
echo     IBVAP - INTELLIGENT BORDER VIDEO ANALYTICS PLATFORM (AI DEFENSE PROTOTYPE)
echo ===============================================================================
echo.
echo [1/2] Launching FastAPI AI Video Analytics Backend (Port 8000)...
start "IBVAP-Backend" cmd /k "cd backend && python run.py"

timeout /t 3 >nul

echo [2/2] Launching Tactical Defense Frontend Dashboard (Port 5173)...
start "IBVAP-Frontend" cmd /k "cd frontend && npm run dev"

timeout /t 2 >nul

echo.
echo ===============================================================================
echo  IBVAP Prototype is now ONLINE!
echo  - Backend API: http://localhost:8000 (OpenAPI Docs: http://localhost:8000/docs)
echo  - Tactical Dashboard: http://localhost:5173
echo ===============================================================================
echo.
start http://localhost:5173
pause
