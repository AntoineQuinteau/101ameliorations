#!/bin/bash
# SessionStart hook for Claude Code cloud sessions: provides the toolchain
# README.md lists as prerequisites (Node from .nvmrc, npm deps, Docker for
# `npx supabase start`, a browser for `npm run e2e`). Local sessions are
# left untouched.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Node: the image ships an older default; use the preinstalled nvm for the
# .nvmrc major and put it first on PATH for the session.
export NVM_DIR=/opt/nvm
set +eu # nvm.sh is not strict-mode safe
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
nvm install "$(cat .nvmrc)" > /dev/null
node_path="$(nvm which "$(cat .nvmrc)")"
set -eu
[ -x "$node_path" ] || { echo "Node $(cat .nvmrc) could not be installed with nvm" >&2; exit 1; }
node_bin="$(dirname "$node_path")"
export PATH="$node_bin:$PATH"
echo "export PATH=\"$node_bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"

# The Supabase CLI pulls from public.ecr.aws, whose image layers the cloud
# egress policy blocks; the same images are mirrored on Docker Hub.
echo 'export SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io' >> "$CLAUDE_ENV_FILE"

# Also fires on resume/compaction: only install when missing.
[ -d node_modules ] || npm ci --no-audit --no-fund

# Docker is installed but not running.
if ! docker info > /dev/null 2>&1; then
  setsid nohup dockerd > /tmp/dockerd.log 2>&1 < /dev/null &
fi

# Playwright's CDN is blocked; playwright.config.ts uses this path outside CI.
if [ ! -e /usr/bin/chromium-browser ]; then
  ln -s /opt/pw-browsers/chromium-*/chrome-linux/chrome /usr/bin/chromium-browser
fi
