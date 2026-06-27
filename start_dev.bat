@echo off
echo Starting AI Hiring Copilot development servers...
echo.

REM Start FastAPI backend in new terminal
start "AI Hiring Copilot - Backend" cmd /k "cd /d "%~dp0" && python -m uvicorn api.server:app --reload --port 8080"

REM Wait for backend to start
timeout /t 4 /nobreak > nul

REM Start Vite frontend in new terminal
start "AI Hiring Copilot - Frontend" cmd /k "cd /d "%~dp0frontend" && set PATH=C:\Program Files\nodejs;%PATH% && npm run dev"

echo.
echo Backend: http://localhost:8080/api/docs
echo Frontend: http://localhost:5173
echo.
