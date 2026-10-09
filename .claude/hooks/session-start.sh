#!/bin/bash
# SessionStart hook for Claude Code cloud sessions: provides the toolchain
# README.md lists as prerequisites (Node from .nvmrc, npm deps, Docker for
# `npx supabase start`). Local sessions are left untouched.
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
export PATH="$node_bin:$PATH"
echo "export PATH=\"$node_bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"

npm install --no-audit --no-fund

# Docker: the daemon is installed but not running. Detach it so it outlives
# this hook.
if ! docker info > /dev/null 2>&1; then
  setsid nohup dockerd > /tmp/dockerd.log 2>&1 < /dev/null &
  for _ in $(seq 1 30); do
    docker info > /dev/null 2>&1 && break
    sleep 1
  done
fi

# The Supabase CLI pulls from public.ecr.aws by default, whose image layers
# the cloud egress policy blocks; the same images are mirrored on Docker Hub.
echo 'export SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io' >> "$CLAUDE_ENV_FILE"
