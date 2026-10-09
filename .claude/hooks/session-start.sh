#!/bin/bash
# SessionStart hook for Claude Code cloud sessions: provides the toolchain
# README.md lists as prerequisites (Node from .nvmrc, npm deps, Docker for
# `npx supabase start`). Local sessions are left untouched.
#
# Only the fast, environment-shaping part runs before the session starts;
# `npm install` and the Docker daemon are handed to a background worker so
# the session is usable right away. wait-for-setup.sh (PreToolUse) holds
# back commands that need them until the worker reports done.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Node: the image ships an older default, CI and package.json "engines" want
# the .nvmrc major. Use the preinstalled nvm and put that version first on
# PATH for every later shell of the session.
export NVM_DIR=/opt/nvm
node_major="$(tr -d '[:space:]' < .nvmrc)"
set +eu # nvm.sh is not strict-mode safe
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
nvm install "$node_major" > /dev/null
node_bin="$(dirname "$(nvm which "$node_major")")"
set -eu
echo "export PATH=\"$node_bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"

# The Supabase CLI pulls from public.ecr.aws by default, whose image layers
# the cloud egress policy blocks; the same images are mirrored on Docker Hub.
echo 'export SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io' >> "$CLAUDE_ENV_FILE"

# Status is written before the worker starts so the PreToolUse guard never
# sees a stale "done" from a previous run.
state_dir=/tmp/claude-session-setup
mkdir -p "$state_dir"
echo running > "$state_dir/status"
PATH="$node_bin:$PATH" setsid nohup "$CLAUDE_PROJECT_DIR/.claude/hooks/session-setup-worker.sh" \
  "$state_dir" > "$state_dir/log" 2>&1 < /dev/null &
