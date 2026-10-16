#!/usr/bin/env bash
# Installs the tools the backup scripts need on a GitHub-hosted Ubuntu runner:
# age from Ubuntu's archive, and rclone as a pinned upstream release checked
# against its published SHA-256.
#
# Not Ubuntu's rclone: 24.04 ships 1.60, which reads every object back after
# uploading it with the version id R2 returns, and R2, which has no object
# versioning, answers that request 501 Not Implemented. The upload itself
# succeeds, so a retry then finds the file present and hides the error.
#
# Usage: scripts/backup/install-tools.sh
set -euo pipefail

rclone_version=v1.75.1
rclone_sha256=982b5aa772841168f8e380f139e9e787b2a105403e32b94da8676a0e1c0a13ab

sudo apt-get update -qq
sudo apt-get install -y -qq age

work=$(mktemp -d)
zip="rclone-${rclone_version}-linux-amd64.zip"
curl -fsSL -o "$work/$zip" \
  "https://github.com/rclone/rclone/releases/download/${rclone_version}/${zip}"
echo "${rclone_sha256}  $work/$zip" | sha256sum -c --quiet -
unzip -q "$work/$zip" -d "$work"
sudo install -m 0755 "$work/rclone-${rclone_version}-linux-amd64/rclone" /usr/local/bin/rclone
rm -rf "$work"

rclone version | head -n 1
