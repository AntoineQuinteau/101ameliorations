#!/bin/bash
# Background half of session-start.sh: the slow setup steps. Records the
# outcome in $1/status ("done" or "failed") for wait-for-setup.sh.
set -euo pipefail

state_dir="$1"
trap 'echo failed > "$state_dir/status"' ERR

cd "$CLAUDE_PROJECT_DIR"

npm install --no-audit --no-fund

# Docker: the daemon is installed but not running. Detach it so it outlives
# this worker.
if ! docker info > /dev/null 2>&1; then
  setsid nohup dockerd > /tmp/dockerd.log 2>&1 < /dev/null &
  for _ in $(seq 1 30); do
    docker info > /dev/null 2>&1 && break
    sleep 1
  done
  docker info > /dev/null
fi

echo done > "$state_dir/status"
