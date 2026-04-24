@echo off
SETLOCAL EnableDelayedExpansion
set "AUTO_START="
if /i "%~1"=="/start" set "AUTO_START=y"
if /i "%~1"=="--start" set "AUTO_START=y"

echo ==========================================
echo    Lorapok Communicator - One Click Install
echo ==========================================
echo.

:: Check for Node.js
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed! Please install Node.js from https://nodejs.org/
    pause
    exit /b
)

echo [1/4] Installing Root Dependencies...
call npm install --silent

echo [2/4] Installing Frontend Dependencies...
cd frontend
call npm install --silent
cd ..

echo [3/4] Installing Backend Dependencies...
cd backend
call npm install --silent
echo.
echo [4/4] Generating Offline Anime Avatars...
node generateAvatars.mjs
cd ..

echo.
echo ==========================================
echo    INSTALLATION COMPLETE!
echo ==========================================
echo.
if defined AUTO_START (
    set "START_APP=%AUTO_START%"
) else (
    set /p START_APP="Do you want to start Lorapok Communicator now? (y/n): "
)
if /i "%START_APP%"=="y" (
    echo Starting frontend and backend...
    npm run dev
) else (
    echo.
    echo To start later, run: npm run dev
    echo Then open: http://localhost:5173
    pause
)
