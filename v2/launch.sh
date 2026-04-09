#!/bin/bash
set -e
PIP_CMD=""
if command -v pip3 &>/dev/null; then PIP_CMD="pip3"
elif command -v pip &>/dev/null; then PIP_CMD="pip"
else PIP_CMD="python3 -m pip"; fi

$PIP_CMD install -r requirements.txt
python3 -m uvicorn backend.app:app --host 0.0.0.0 --port 8765 --reload
