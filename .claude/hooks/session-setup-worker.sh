#!/bin/bash
# Background half of session-start.sh: the slow setup steps. Records each
# step's outcome in $1/node and $1/docker ("done" or "failed") for
# wait-for-setup.sh; a step already marked done is skipped.
set -uo pipefail

state_dir="$1"

set_status() {
  echo "$2" > "$state_dir/$1.tmp"
  mv "$state_dir/$1.tmp" "$state_dir/$1"
}

# A step still "running" when the worker exits (error or catchable signal)
# is recorded as failed. The guard covers uncatchable ones (SIGKILL, OOM) by
# checking that the worker PID is still alive.
finish() {
  for step in node docker; do
    if [ "$(cat "$state_dir/$step" 2> /dev/null)" = running ]; then
      set_status "$step" failed
    fi
  done
}
trap finish EXIT
# Bash defers traps until a foreground child exits, so npm runs in the
# background and the handler stops it too.
child=""
on_signal() {
  [ -n "$child" ] && kill "$child" 2> /dev/null
  exit 1
}
trap on_signal HUP INT TERM

cd "$CLAUDE_PROJECT_DIR"

# Docker: the daemon is installed but not running. Start it first so it boots
# while npm ci runs, detached so it outlives this worker.
if [ "$(cat "$state_dir/docker")" != done ]; then
  setsid nohup dockerd > "$state_dir/dockerd.log" 2>&1 < /dev/null &
fi

# npm ci, like every CI job: never rewrites package-lock.json.
if [ "$(cat "$state_dir/node")" != done ]; then
  npm ci --no-audit --no-fund &
  child=$!
  if wait "$child"; then
    set_status node done
  else
    set_status node failed
  fi
fi

if [ "$(cat "$state_dir/docker")" != done ]; then
  for _ in $(seq 1 30); do
    docker info > /dev/null 2>&1 && break
    sleep 1
  done
  if docker info > /dev/null 2>&1; then
    set_status docker done
  else
    echo "dockerd did not come up. Last lines of $state_dir/dockerd.log:"
    tail -n 20 "$state_dir/dockerd.log"
    set_status docker failed
  fi
fi
