#!/usr/bin/env bash
# Copies the photo mirror from the R2 backup bucket back into a project's
# klash-photos Storage bucket. Run it after restore.sh: the restored database
# already holds the bucket and every photo's storage.objects row, this puts
# the files back behind them.
#
# Usage: scripts/backup/restore-photos.sh
# Environment: BACKUP_R2_BUCKET, the R2_* credentials, and the SUPABASE_S3_*
# settings of the project to restore into (see lib.sh).
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=lib.sh
source "$here/lib.sh"
: "${BACKUP_R2_BUCKET:?}"

use_r2_remote
use_supabase_remote

# --no-check-dest: Storage lists every photo whose storage.objects row was
# restored, with its size, even though the file behind it is missing; any
# comparison with the destination would conclude there is nothing to copy.
rclone copy "r2:$BACKUP_R2_BUCKET/photos" supabase:klash-photos \
  --no-check-dest \
  --fast-list \
  --stats-one-line \
  -v
