#!/usr/bin/env bash
# Restores a dump into a throwaway local Supabase stack that stands in for a
# brand-new hosted project, then verifies it. Runs in CI after every backup,
# and locally for a restore drill.
#
# Usage: scripts/backup/restore-check.sh <dump-dir>
# KEEP_STACK=1 leaves the stack running afterwards (database on port 55322),
# to explore the restored data; stop it with the command printed at the end.
# Needs the pinned Supabase CLI on PATH, Docker, psql, and the repo root as
# working directory.
set -euo pipefail

dir=$(cd "$1" && pwd)
here=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d)

# The project's own config (same Postgres major version and auth settings) but
# no migrations and no seed, like a new hosted project. Its own project id and
# ports (543xx -> 553xx) let it run next to the dev stack.
mkdir -p "$work/supabase"
sed -E \
  -e 's/^project_id = .*/project_id = "backup-restore-check"/' \
  -e 's/= 543([0-9]{2})$/= 553\1/' \
  supabase/config.toml > "$work/supabase/config.toml"
cp -r supabase/templates "$work/supabase/"
db_url='postgresql://postgres:postgres@127.0.0.1:55322/postgres?sslmode=disable'


stop_stack() {
  supabase stop --workdir "$work" --no-backup > /dev/null
  rm -rf "$work"
}
if [ "${KEEP_STACK:-}" = 1 ]; then
  trap 'echo "Stack kept. Stop it with: supabase stop --workdir $work --no-backup"' EXIT
else
  trap stop_stack EXIT
fi

# Auth and Storage at the versions the dumped project ran (see dump.sh), where
# the CLI picks them up for `supabase start`, as after a `supabase link`.
# Without them (a dump from before they were recorded, or a local one), the
# CLI's own images.
if compgen -G "$dir/versions/*-version" > /dev/null; then
  mkdir -p "$work/supabase/.temp"
  cp "$dir"/versions/*-version "$work/supabase/.temp/"
  echo "Service versions from the dump: $(grep -E '^(gotrue|storage): ' "$dir/manifest.txt" | tr '\n' ' ')"
fi

# Only what a restore needs: Postgres, plus Auth and Storage, whose own
# migrations create the auth and storage schemas the dump's data goes into.
start_stack() {
  supabase start --workdir "$work" \
    -x realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor,postgrest \
    > /dev/null
}
# A pinned version that can't start (its image not published yet, or needing
# a setting the CLI doesn't provide) falls back to the CLI's images: the check
# still runs, as it did before versions were pinned, and says so.
if ! start_stack; then
  [ -d "$work/supabase/.temp" ] || exit 1
  echo "::warning::the stack did not start at the dumped service versions; retrying with the CLI's images"
  supabase stop --workdir "$work" --no-backup > /dev/null || true
  rm -rf "$work/supabase/.temp"
  start_stack
fi

"$here/restore.sh" "$dir" "$db_url"
"$here/verify.sh" "$dir" "$db_url"
