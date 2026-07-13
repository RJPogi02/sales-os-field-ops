#!/bin/bash
set -e

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required to launch Sales OS."
  echo "Install Node.js LTS from https://nodejs.org and run this file again."
  read -r -p "Press Return to close..."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Installing Sales OS dependencies..."
  npm install
fi

(sleep 2; open "http://127.0.0.1:5173") &
echo "Sales OS v0.071 is starting at http://127.0.0.1:5173"
echo "Keep this window open while using the app."
npm run dev -- --host 127.0.0.1
