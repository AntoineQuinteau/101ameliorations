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
# server's Postgres version), psql, and the repo root as working directory.
set -euo pipefail

db_url=$1
out=$2
here=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=SCRIPTDIR/lib.sh
source "$here/lib.sh"

mkdir -p "$out"

# Storage tables the restore cannot replay, all unused and empty here:
# - the vector-bucket tables, a paid-plan feature, not writable by the postgres
#   role on a fresh project;
# - bucket_lifecycle_states, added to hosted projects in November 2026 (we set
#   no lifecycle rules), missing from the local stack's older Storage, so the
#   nightly restore check failed on it.
exclude=storage.buckets_vectors,storage.vector_indexes,storage.bucket_lifecycle_states

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
# column production gained doesn't fail the restore. Best effort: without
# them, the restore runs on the CLI's own images, and a failure here must not
# cost the backup.
service_version() { # <api-path> <jq-args>...
  local path=$1
  shift
  curl -fsS -m 10 --retry 3 -H "apikey: $BACKUP_PROJECT_KEY" "$BACKUP_PROJECT_URL$path" \
    | jq "$@" | grep -xE 'v?[0-9]+\.[0-9]+\.[0-9]+' | sed 's/^v*/v/'
}
if [ -n "${BACKUP_PROJECT_URL:-}" ] && [ -n "${BACKUP_PROJECT_KEY:-}" ]; then
  mkdir -p "$out/versions"
  # Auth answers JSON ({"version": "v2.198.0", ...}), Storage a bare "1.94.2".
  if ! { service_version /auth/v1/health -r .version > "$out/versions/gotrue-version" \
    && service_version /storage/v1/version -Rr . > "$out/versions/storage-version"; }; then
    echo "::warning::could not read the project's Auth/Storage versions; the restore check will use the CLI's"
    rm -rf "$out/versions"
  fi
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
