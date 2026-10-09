#!/bin/bash
# SessionStart hook for Claude Code cloud sessions: provides the toolchain
# README.md lists as prerequisites (Node from .nvmrc, npm deps, Docker for
# `npx supabase start`, a browser for `npm run e2e`). Local sessions are
# left untouched.
#
# Only the fast, environment-shaping part runs before the session starts;
# `npm ci` and the Docker daemon are handed to a background worker so the
# session is usable right away. wait-for-setup.sh (PreToolUse) holds back
# commands that need them until the worker reports each step's outcome.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

state_dir=/tmp/claude-session-setup
mkdir -p "$state_dir"

# Written via rename so the guard never reads a half-written (empty) file.
set_status() {
  echo "$2" > "$state_dir/$1.tmp"
  mv "$state_dir/$1.tmp" "$state_dir/$1"
}

# SessionStart also fires on resume, /clear and compaction; don't stack
# duplicate lines in the env file.
add_env() {
  grep -qxF "$1" "$CLAUDE_ENV_FILE" 2> /dev/null || echo "$1" >> "$CLAUDE_ENV_FILE"
}

# Node: the image ships an older default, CI and package.json "engines" want
# the .nvmrc major. Use the preinstalled nvm and put that version first on
# PATH for every later shell of the session.
export NVM_DIR=/opt/nvm
node_major="$(tr -d '[:space:]' < .nvmrc)"
set +eu # nvm.sh is not strict-mode safe
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
nvm install "$node_major" > /dev/null
node_path="$(nvm which "$node_major")"
set -eu
if [ ! -x "$node_path" ]; then
  echo "session-start: Node $node_major could not be installed with nvm ($NVM_DIR)." \
    | tee "$state_dir/log" >&2
  set_status node failed
  exit 1
fi
node_bin="$(dirname "$node_path")"
add_env "export PATH=\"$node_bin:\$PATH\""

# The Supabase CLI pulls from public.ecr.aws by default, whose image layers
# the cloud egress policy blocks; the same images are mirrored on Docker Hub.
add_env 'export SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io'

# Playwright: no egress to its CDN, so `npx playwright install` cannot run.
# Outside CI, playwright.config.ts already drives a system Chromium at
# /usr/bin/chromium-browser when one exists; point that path at the
# Chromium the image preinstalls for Playwright.
if [ ! -e /usr/bin/chromium-browser ]; then
  for chrome in /opt/pw-browsers/chromium-*/chrome-linux/chrome; do
    if [ -x "$chrome" ]; then
      ln -s "$chrome" /usr/bin/chromium-browser
      break
    fi
  done
fi

# Re-fired in the same container: leave a running worker alone, and skip the
# worker when its work is verifiably still in place, so node_modules is never
# reinstalled under a live command. A fresh container (or a failed step)
# gets a new run.
pid_file="$state_dir/worker.pid"
old_pid="$(cat "$pid_file" 2> /dev/null || true)"
# The PID file can outlive its worker (e.g. a restored /tmp): only trust a
# PID that still names the worker.
if [ -n "$old_pid" ] && tr '\0' ' ' 2> /dev/null < "/proc/$old_pid/cmdline" | grep -q session-setup-worker \
  && grep -qx running "$state_dir/node" "$state_dir/docker" 2> /dev/null; then
  exit 0
fi
node_ready=false
if [ "$(cat "$state_dir/node" 2> /dev/null)" = done ] && [ -d node_modules ]; then
  node_ready=true
fi
docker_ready=false
if docker info > /dev/null 2>&1; then
  docker_ready=true
fi
if $node_ready && $docker_ready; then
  set_status docker done
  exit 0
fi

# A worker killed earlier can leave its npm ci behind; stop that process
# group (setsid made the worker its leader) so the retry doesn't race it.
# Done before resetting the statuses, which the old worker's exit trap
# would otherwise overwrite.
if [ -n "$old_pid" ] && pgrep -g "$old_pid" -f 'session-setup-worker|npm ci' > /dev/null; then
  kill -TERM -- "-$old_pid" 2> /dev/null || true
  for _ in $(seq 1 15); do
    kill -0 -- "-$old_pid" 2> /dev/null || break
    sleep 0.2
  done
  kill -KILL -- "-$old_pid" 2> /dev/null || true
fi

$node_ready || set_status node running
if $docker_ready; then set_status docker done; else set_status docker running; fi
rm -f "$state_dir"/*.reported
PATH="$node_bin:$PATH" setsid nohup "$CLAUDE_PROJECT_DIR/.claude/hooks/session-setup-worker.sh" \
  "$state_dir" > "$state_dir/log" 2>&1 < /dev/null &
echo $! > "$pid_file"
