#!/usr/bin/env bash
# Dumps a Supabase database into a directory that restore.sh can replay on a
# brand-new project: roles, schema, migration history, data, plus the policies
# and triggers our migrations attach to the platform-managed auth and storage
# schemas. Photos are not in here: see sync-photos.sh.
#
# Usage: scripts/backup/dump.sh <db-url> <out-dir>
# Needs the pinned Supabase CLI on PATH (it runs pg_dump in Docker, at the
# server's Postgres version), psql, and the repo root as working directory.
set -euo pipefail

db_url=$1
out=$2
here=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=lib.sh
source "$here/lib.sh"

mkdir -p "$out"

# Supabase's vector-bucket tables: a paid-plan feature, always empty here, and
# not writable by the postgres role on a fresh project, so the restore would
# fail on them.
exclude=storage.buckets_vectors,storage.vector_indexes

supabase db dump --db-url "$db_url" --role-only -f "$out/roles.sql"
supabase db dump --db-url "$db_url" -f "$out/schema.sql"
supabase db dump --db-url "$db_url" --data-only --use-copy -x "$exclude" -f "$out/data.sql"
# The migration history lives in a schema the default dumps skip. Without it,
# `supabase db push` on the restored project would replay every migration.
supabase db dump --db-url "$db_url" -s supabase_migrations -f "$out/history-schema.sql"
supabase db dump --db-url "$db_url" -s supabase_migrations --data-only --use-copy \
  -f "$out/history-data.sql"

psql_at() { psql -X -q -At -v ON_ERROR_STOP=1 -d "$db_url" "$@"; }
psql_at -f "$here/platform-hooks.sql" > "$out/platform-hooks.sql"
psql_at -f "$here/fingerprint.sql" > "$out/fingerprint.txt"
row_counts "$out/data.sql" "$out/history-data.sql" > "$out/row-counts.txt"

{
  echo "created_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "latest_migration: $(psql_at -c 'select max(version) from supabase_migrations.schema_migrations')"
  echo "server_version: $(psql_at -c 'show server_version')"
  echo "supabase_cli: $(supabase --version 2> /dev/null)"
  echo "git_commit: $(git rev-parse HEAD 2> /dev/null || echo unknown)"
} > "$out/manifest.txt"

echo "Dump written to $out:"
cat "$out/manifest.txt"
