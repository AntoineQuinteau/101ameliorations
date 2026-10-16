# shellcheck shell=bash
# Shared helpers for the backup scripts. Source it, don't run it.

# Prints "schema.table rows" for every COPY block in the given pg_dump files,
# counting the lines between each COPY header and its "\." terminator. COPY's
# text format escapes newlines inside values, so one line is one row.
row_counts() {
  awk '
    /^COPY / { table = $2; rows = 0; in_copy = 1; next }
    in_copy && /^\\\.$/ { gsub(/"/, "", table); print table, rows; in_copy = 0; next }
    in_copy { rows++ }
  ' "$@" | sort
}

# rclone remotes are configured from the environment, never from a config
# file, so no credential is ever written to disk.

# r2: the backup bucket (Cloudflare R2, EU jurisdiction endpoint).
use_r2_remote() {
  : "${R2_ACCOUNT_ID:?}" "${R2_ACCESS_KEY_ID:?}" "${R2_SECRET_ACCESS_KEY:?}"
  export RCLONE_CONFIG_R2_TYPE=s3
  export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
  export RCLONE_CONFIG_R2_ENDPOINT="https://${R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com"
  export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
  export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
  # The token is scoped to objects in one bucket: it may not check for, let
  # alone create, the bucket itself.
  export RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true
}

# supabase: the project's Storage, through its S3 protocol endpoint.
use_supabase_remote() {
  : "${SUPABASE_S3_ENDPOINT:?}" "${SUPABASE_S3_REGION:?}"
  : "${SUPABASE_S3_ACCESS_KEY_ID:?}" "${SUPABASE_S3_SECRET_ACCESS_KEY:?}"
  export RCLONE_CONFIG_SUPABASE_TYPE=s3
  export RCLONE_CONFIG_SUPABASE_PROVIDER=Other
  export RCLONE_CONFIG_SUPABASE_ENDPOINT="$SUPABASE_S3_ENDPOINT"
  export RCLONE_CONFIG_SUPABASE_REGION="$SUPABASE_S3_REGION"
  export RCLONE_CONFIG_SUPABASE_ACCESS_KEY_ID="$SUPABASE_S3_ACCESS_KEY_ID"
  export RCLONE_CONFIG_SUPABASE_SECRET_ACCESS_KEY="$SUPABASE_S3_SECRET_ACCESS_KEY"
  export RCLONE_CONFIG_SUPABASE_FORCE_PATH_STYLE=true
}
