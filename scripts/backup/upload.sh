#!/usr/bin/env bash
# Archives a dump made by dump.sh, encrypts it with age, and uploads it to the
# R2 backup bucket under each given prefix (db/daily, db/weekly, ...). The
# bucket's lifecycle rules expire each prefix on its own schedule.
#
# Usage: scripts/backup/upload.sh <dump-dir> <prefix>...
# Environment: BACKUP_AGE_RECIPIENT (one or more space-separated age public
# keys), BACKUP_R2_BUCKET, and the R2_* credentials (see lib.sh).
set -euo pipefail

dir=$1
shift
here=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=SCRIPTDIR/lib.sh
source "$here/lib.sh"
: "${BACKUP_AGE_RECIPIENT:?}" "${BACKUP_R2_BUCKET:?}"

recipients=()
for key in $BACKUP_AGE_RECIPIENT; do
  recipients+=(-r "$key")
done

name="101ameliorations-db-$(date -u +%Y-%m-%dT%H%MZ).tar.gz.age"
archive="$(mktemp -d)/$name"
# Only the encrypted archive ever touches disk outside the dump directory.
tar -C "$dir" -czf - . | age "${recipients[@]}" -o "$archive"

use_r2_remote
for prefix in "$@"; do
  rclone copyto "$archive" "r2:$BACKUP_R2_BUCKET/$prefix/$name"
  echo "Uploaded $prefix/$name ($(du -h "$archive" | cut -f1))"
done
