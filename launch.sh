#!/bin/bash
set -e

echo "🚀 xCSG Value Tracker — Starting..."

# Detect pip command
PIP_CMD=""
if command -v pip3 &>/dev/null; then PIP_CMD="pip3"
elif command -v pip &>/dev/null; then PIP_CMD="pip"
else PIP_CMD="python3 -m pip"; fi

echo "📦 Installing dependencies with $PIP_CMD..."
$PIP_CMD install -q -r requirements.txt

echo "✅ Starting server on http://localhost:8765"
python3 -m uvicorn backend.app:app --host 0.0.0.0 --port 8765 --reload
