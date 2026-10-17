#!/usr/bin/env bash
# Mirrors the klash-photos Storage bucket to photos/ in the R2 backup bucket.
# A file gone from Storage is moved to photos-deleted/<date>/ rather than
# deleted, and the bucket's lifecycle rule removes it 30 days later.
#
# Usage: scripts/backup/sync-photos.sh
# Environment: BACKUP_R2_BUCKET, the SUPABASE_S3_* and R2_* settings (see
# lib.sh), and optionally BACKUP_MAX_PHOTO_DELETIONS (default 100).
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=SCRIPTDIR/lib.sh
source "$here/lib.sh"
: "${BACKUP_R2_BUCKET:?}"

use_supabase_remote
use_r2_remote

max_deletions=${BACKUP_MAX_PHOTO_DELETIONS:-100}
mirror="r2:$BACKUP_R2_BUCKET/photos"

# Guard against a Storage bucket emptied by mistake: count the files the sync
# would move out of the mirror, and stop before touching anything past the
# threshold. The job then fails every night, leaving the mirror intact, until
# a human looks; if the deletions are legitimate, rerun the workflow by hand
# with a higher threshold. (rclone's own --max-delete, kept below as a second
# net, would first move files up to the threshold, then fail.)
# comm needs both lists sorted in its own collation: bytewise for both.
list() { rclone lsf -R --files-only --fast-list "$1" | LC_ALL=C sort; }
# Listed into variables first: a failed listing then stops the script, where
# inside <(...) it would silently read as an empty bucket.
in_storage=$(list supabase:klash-photos)
# Before the first sync the mirror does not exist yet, which rclone reports as
# "directory not found" (exit code 3): that one means empty.
in_mirror=$(list "$mirror") || [ $? -eq 3 ]
gone=$(LC_ALL=C comm -13 <(echo "$in_storage") <(echo "$in_mirror") | grep -c . || true)
if [ "$gone" -gt "$max_deletions" ]; then
  echo "Refusing to sync: $gone photos gone from Storage since the last run," \
    "over the threshold of $max_deletions. Nothing was changed." >&2
  exit 1
fi
echo "$gone photos gone from Storage since the last run."

# --size-only: photo paths are '{klash_id}/{uuid}.jpg' and never rewritten, so
# comparing sizes is enough and spares a metadata request per file.
rclone sync supabase:klash-photos "$mirror" \
  --backup-dir "r2:$BACKUP_R2_BUCKET/photos-deleted/$(date -u +%Y-%m-%d)" \
  --max-delete "$max_deletions" \
  --size-only \
  --fast-list \
  --stats-one-line \
  -v
