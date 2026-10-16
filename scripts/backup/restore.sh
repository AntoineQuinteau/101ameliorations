#!/usr/bin/env bash
# Replays a dump made by dump.sh onto a brand-new, empty Supabase project
# (hosted, or the local one restore-check.sh starts). This is the disaster
# recovery procedure itself: the nightly restore check runs exactly this.
#
# Usage: scripts/backup/restore.sh <dump-dir> <db-url>
# <db-url> is the new project's connection string, as the postgres role.
set -euo pipefail

dir=$1
db_url=$2

# Roles first, best effort: a fresh project already has the roles this file
# alters, with the same settings, and the postgres role may not replay some
# platform grants in it (GRANT SET ON PARAMETER). psql reports those errors
# without stopping.
echo "Restoring roles (permission errors on platform settings are expected)..."
psql -X -q -d "$db_url" -f "$dir/roles.sql" > /dev/null

# Everything else in a single transaction: the project ends up either a
# complete copy or untouched. session_replication_role = replica disables
# triggers and foreign-key checks while the data loads (pg_dump cannot order
# klashes' circular foreign keys), and keeps triggers such as
# on_auth_user_created from firing on restored rows.
psql -X -q -v ON_ERROR_STOP=1 --single-transaction -d "$db_url" \
  -f "$dir/schema.sql" \
  -f "$dir/history-schema.sql" \
  -c 'set session_replication_role = replica' \
  -f "$dir/data.sql" \
  -f "$dir/history-data.sql" \
  -f "$dir/platform-hooks.sql" \
  > /dev/null

echo "Restored $dir"
