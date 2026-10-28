#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 server (e.g. AWS Lightsail launch
# script). Installs Docker, adds swap for the image builds, clones the
# repository and starts the DEMO stack.
#
#   curl -fsSL https://raw.githubusercontent.com/solertesting-prog/japanhomes/main/infra/lightsail/install.sh | sudo bash
set -euo pipefail
REPO="${JPT_REPO:-https://github.com/solertesting-prog/japanhomes.git}"
DIR=/opt/jpt
exec > >(tee -a /var/log/jpt-install.log) 2>&1
echo "== $(date -u +%FT%TZ) installing Japan Property Token DEMO"

# 4 GB swap: building the web image needs more memory than a 2 GB server has.
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

if ! command -v docker >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y ca-certificates curl git openssl
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

if [ ! -d "$DIR/.git" ]; then
  git clone --depth 1 "$REPO" "$DIR"
fi
install -m 755 "$DIR/infra/lightsail/jpt" /usr/local/bin/jpt

# Daily database dump at 03:30 UTC (kept 14 days).
echo '30 3 * * * root /usr/local/bin/jpt backup >/var/log/jpt-backup.log 2>&1' > /etc/cron.d/jpt-backup

jpt update
