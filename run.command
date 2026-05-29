#!/bin/zsh
cd "$(dirname "$0")"

echo "Starting GERF Sonification app..."

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

npm run dev -- --open
