#!/usr/bin/env bash
# Checks that a database restored by restore.sh matches the dump it came from:
# the dump holds the tables a restore cannot do without, every table has the
# same number of rows as the dump, and the schema fingerprint is identical to
# the source's at dump time.
#
# Usage: scripts/backup/verify.sh <dump-dir> <db-url>
set -euo pipefail

dir=$1
db_url=$2
here=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=SCRIPTDIR/lib.sh
source "$here/lib.sh"

failed=0
fail() {
  echo "FAIL: $*" >&2
  failed=1
}

expected=$(row_counts "$dir/data.sql" "$dir/history-data.sql")
diff <(cat "$dir/row-counts.txt") <(echo "$expected") > /dev/null \
  || fail "row-counts.txt does not match the dump files"

for table in auth.users public.klashes public.profiles storage.buckets storage.objects \
  supabase_migrations.schema_migrations; do
  grep -q "^$table " <<< "$expected" || fail "$table is missing from the dump"
done
grep -q '^supabase_migrations.schema_migrations [1-9]' <<< "$expected" \
  || fail "the migration history is empty"

restored=$(while read -r table _; do
  echo "$table $(psql -X -q -At -v ON_ERROR_STOP=1 -d "$db_url" -c "select count(*) from $table")"
done <<< "$expected")
diff -u <(echo "$expected") <(echo "$restored") \
  --label dump --label restored || fail "row counts differ"

diff -u "$dir/fingerprint.txt" \
  <(psql -X -q -At -v ON_ERROR_STOP=1 -d "$db_url" -f "$here/fingerprint.sql") \
  --label source --label restored || fail "schema fingerprints differ"

if [ "$failed" -ne 0 ]; then
  exit 1
fi
echo "Restore verified: $(wc -l <<< "$expected") tables," \
  "$(awk '{ rows += $2 } END { print rows }' <<< "$expected") rows," \
  "$(wc -l < "$dir/fingerprint.txt") schema objects."
