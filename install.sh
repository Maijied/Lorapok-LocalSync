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
echo "To start the system, run:"
echo "npm run dev"
echo ""
echo "Then open: http://localhost:5173"
echo "=========================================="
