#!/bin/bash

# Lorapok LocalSync - Unix Installation Script

echo "=========================================="
echo "   Lorapok LocalSync - One Click Install"
echo "=========================================="
echo ""

# Check for Node.js
if ! command -v node &> /dev/null
then
    echo "[ERROR] Node.js is not installed! Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "[1/4] Installing Root Dependencies..."
npm install --silent

echo "[2/4] Installing Frontend Dependencies..."
cd frontend
npm install --silent
cd ..

echo "[3/4] Installing Backend Dependencies..."
cd backend
npm install --silent
echo ""

echo "[4/4] Generating Offline Anime Avatars..."
node generateAvatars.mjs
cd ..

echo ""
echo "=========================================="
echo "   INSTALLATION COMPLETE!"
echo "=========================================="
echo ""
read -p "Do you want to start Lorapok LocalSync now? (y/n): " choice
if [[ "$choice" == "y" || "$choice" == "Y" ]]; then
    echo "Starting the app..."
    npm run dev
else
    echo ""
    echo "To start later, run: npm run dev"
    echo ""
    echo "Then open: http://localhost:5173"
fi
echo "=========================================="
