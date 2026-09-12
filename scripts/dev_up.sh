#!/usr/bin/env bash
# Start control plane + runner for local demo.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PYTHONPATH="$ROOT${PYTHONPATH:+:$PYTHONPATH}"
export AGENTOS_DATABASE_URL="${AGENTOS_DATABASE_URL:-sqlite:///./agentos.db}"
export AGENTOS_RUNNER_TOKEN="${AGENTOS_RUNNER_TOKEN:-dev-runner-token}"
export AGENTOS_API_URL="${AGENTOS_API_URL:-http://127.0.0.1:8080}"
export AGENTOS_WORKSPACE="$ROOT/examples/demo-repo"

# Ensure demo repo is git-initialized
if [[ ! -d "$AGENTOS_WORKSPACE/.git" ]]; then
  git -C "$AGENTOS_WORKSPACE" init
  git -C "$AGENTOS_WORKSPACE" config user.email "agentos@local"
  git -C "$AGENTOS_WORKSPACE" config user.name "AgentOS"
  git -C "$AGENTOS_WORKSPACE" add -A
  git -C "$AGENTOS_WORKSPACE" commit -m "demo baseline" || true
fi

echo "Starting control plane on :8080"
uvicorn controlplane.app:app --host 127.0.0.1 --port 8080 &
CP_PID=$!
trap 'kill $CP_PID $RUNNER_PID 2>/dev/null || true' EXIT

for i in {1..30}; do
  if curl -sf http://127.0.0.1:8080/health >/dev/null; then break; fi
  sleep 0.3
done

echo "Starting execution runner"
python -m runner.main &
RUNNER_PID=$!

echo "Control plane PID=$CP_PID runner PID=$RUNNER_PID"
echo "Run: python scripts/demo_mvp.py"
wait
