@echo off
start "Crane API" cmd /k "cd /d %~dp0 && python -m uvicorn main:app --reload --port 8000"
start "Crane UI" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 3 /nobreak >nul
start http://localhost:5173
