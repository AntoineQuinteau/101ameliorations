#!/usr/bin/env bash
# Dumps a Supabase database into a directory that restore.sh can replay on a
# brand-new project: roles, schema, migration history, data, plus the policies
# and triggers our migrations attach to the platform-managed auth and storage
# schemas. Photos are not in here: see sync-photos.sh.
#
# Usage: scripts/backup/dump.sh <db-url> <out-dir>
# Optional: BACKUP_PROJECT_URL and BACKUP_PROJECT_KEY, the project's API URL and
# publishable key, to record its Auth and Storage versions (see below).
# Needs the pinned Supabase CLI on PATH (it runs pg_dump in Docker, at the
# server's Postgres version), psql, curl and jq, and the repo root as working
# directory.
set -euo pipefail

db_url=$1
out=$2
here=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=SCRIPTDIR/lib.sh
source "$here/lib.sh"

mkdir -p "$out"

# Supabase's vector-bucket tables: a paid-plan feature, always empty here, and
# not writable by the postgres role on a fresh project, so the restore would
# fail on them. Tables a newer hosted Storage adds need no entry here: the
# restore check runs production's Storage version (see below).
exclude=storage.buckets_vectors,storage.vector_indexes

supabase db dump --remote="$db_url" --role-only -f "$out/roles.sql"
supabase db dump --remote="$db_url" -f "$out/schema.sql"
supabase db dump --remote="$db_url" --data-only --use-copy -x "$exclude" -f "$out/data.sql"
# The migration history lives in a schema the default dumps skip. Without it,
# `supabase db push` on the restored project would replay every migration.
supabase db dump --remote="$db_url" -s supabase_migrations -f "$out/history-schema.sql"
supabase db dump --remote="$db_url" -s supabase_migrations --data-only --use-copy \
  -f "$out/history-data.sql"

psql_at() { psql -X -q -At -v ON_ERROR_STOP=1 -d "$db_url" "$@"; }
psql_at -f "$here/platform-hooks.sql" > "$out/platform-hooks.sql"
psql_at -f "$here/fingerprint.sql" > "$out/fingerprint.txt"
row_counts "$out/data.sql" "$out/history-data.sql" > "$out/row-counts.txt"

# The Auth and Storage versions the project runs, in the files `supabase link`
# writes to supabase/.temp. Their migrations create the auth and storage tables
# data.sql loads into, and the hosted platform upgrades them ahead of the CLI's
# local images: restore-check.sh starts its stack at these versions, so a
# column production gained doesn't fail the restore. Best effort, one service
# at a time: a service whose version can't be read runs on the CLI's own
# image, and a failure here must not cost the backup.
record_version() { # <service> <api-path> <jq-args>...
  local service=$1 path=$2 version
  shift 2
  if version=$(curl -fsS -m 10 --retry 3 -H "apikey: $BACKUP_PROJECT_KEY" \
    "$BACKUP_PROJECT_URL$path" | jq "$@" | grep -xE 'v?[0-9]+\.[0-9]+\.[0-9]+' | sed 's/^v*/v/'); then
    echo "$version" > "$out/versions/$service-version"
  else
    echo "::warning::could not read the project's $service version; the restore check will use the CLI's"
  fi
}
if [ -n "${BACKUP_PROJECT_URL:-}" ] && [ -n "${BACKUP_PROJECT_KEY:-}" ]; then
  mkdir -p "$out/versions"
  # Auth answers JSON ({"version": "v2.198.0", ...}), Storage a bare "1.94.2".
  record_version gotrue /auth/v1/health -r .version
  record_version storage /storage/v1/version -Rr .
  rmdir "$out/versions" 2> /dev/null || true # nothing recorded
fi

{
  echo "created_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "latest_migration: $(psql_at -c 'select max(version) from supabase_migrations.schema_migrations')"
  echo "server_version: $(psql_at -c 'show server_version')"
  echo "supabase_cli: $(supabase --version 2> /dev/null)"
  echo "git_commit: $(git rev-parse HEAD 2> /dev/null || echo unknown)"
  for f in "$out"/versions/*-version; do
    if [ -e "$f" ]; then echo "$(basename "$f" -version): $(cat "$f")"; fi
  done
} > "$out/manifest.txt"

echo "Dump written to $out:"
cat "$out/manifest.txt"
