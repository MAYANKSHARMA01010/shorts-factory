#!/usr/bin/env bash
# run_flow.sh — Wrapper to run flow_auto_generator.py with the project venv
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VENV="$PROJECT_ROOT/.venv-flow"

# Check if venv exists
if [ ! -d "$VENV" ]; then
  echo "[flow] Creating venv and installing playwright..."
  python3 -m venv "$VENV"
  source "$VENV/bin/activate"
  pip install playwright --quiet
  python -m playwright install chromium
else
  source "$VENV/bin/activate"
fi

# Forward all args to the Python script
python "$SCRIPT_DIR/flow_auto_generator.py" "$@"
