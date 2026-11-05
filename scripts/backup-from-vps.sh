#!/usr/bin/env bash
# Saves a compressed dump of the app and auth data to ./backups on this machine.
#
#   scripts/backup-from-vps.sh root@your-server
set -euo pipefail

REMOTE="${1:?usage: backup-from-vps.sh user@host}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/backups/randtracker-$(date +%Y%m%d-%H%M%S).dump"
mkdir -p "$ROOT/backups"
(umask 077; ssh "$REMOTE" "cd /opt/randtracker/deploy && docker compose --env-file .env --env-file images.env -f docker-compose.yml exec -T db pg_dump -U supabase_admin -d postgres -Fc -n public -n auth -n app_migrations" > "$OUT")
echo "Saved $OUT"
