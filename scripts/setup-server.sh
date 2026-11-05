#!/usr/bin/env bash
# First-time server setup: copies the stack to /opt/randtracker, generates its secrets
# (once, on the server, never printed), starts Supabase and applies the migrations.
# Safe to run again; it won't replace existing secrets.
#
#   scripts/setup-server.sh root@your-server
set -euo pipefail

REMOTE="${1:?usage: setup-server.sh user@host}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner | tr '[:upper:]' '[:lower:]')

ssh "$REMOTE" 'mkdir -p /opt/randtracker/deploy'
COPYFILE_DISABLE=1 tar -czf - -C "$ROOT/deploy" docker-compose.yml gateway db -C "$ROOT" supabase/migrations \
  | ssh "$REMOTE" 'tar -xzf - --no-same-owner -C /opt/randtracker/deploy'
scp -q "$ROOT/deploy/randtracker-deploy.sh" "$REMOTE:/usr/local/bin/randtracker-deploy"

ssh "$REMOTE" "REPO=$REPO bash -s" <<'REMOTE_SCRIPT'
set -euo pipefail
DIR=/opt/randtracker/deploy
chmod 755 /usr/local/bin/randtracker-deploy
echo "ghcr.io/$REPO" > "$DIR/image-prefix"
touch "$DIR/images.env"

if [ ! -f "$DIR/.env" ]; then
  b64() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
  JWT_SECRET=$(openssl rand -hex 32)
  jwt() {
    local now header payload sig
    now=$(date +%s)
    header=$(printf '{"alg":"HS256","typ":"JWT"}' | b64)
    payload=$(printf '{"role":"%s","iss":"supabase","iat":%d,"exp":%d}' "$1" "$now" "$((now + 315360000))" | b64)
    sig=$(printf '%s.%s' "$header" "$payload" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | b64)
    printf '%s.%s.%s' "$header" "$payload" "$sig"
  }
  (umask 077; cat > "$DIR/.env" <<ENV
SITE_URL=https://randtracker.mokwatsi.tech
API_URL=https://randtracker-api.mokwatsi.tech
POSTGRES_PASSWORD=$(openssl rand -hex 32)
JWT_SECRET=$JWT_SECRET
ANON_KEY=$(jwt anon)
SERVICE_ROLE_KEY=$(jwt service_role)
PG_META_CRYPTO_KEY=$(openssl rand -hex 32)
ENABLE_EMAIL_AUTOCONFIRM=true
TUNNEL_TOKEN=
ENV
  )
  echo "Secrets generated in $DIR/.env"
fi

cd "$DIR"
docker compose --env-file .env --env-file images.env -f docker-compose.yml up -d db auth rest
# Recreated because a bind-mounted file replaced by tar stays stale in a running container.
docker compose --env-file .env --env-file images.env -f docker-compose.yml up -d --wait --force-recreate --no-deps gateway
SSH_ORIGINAL_COMMAND=migrate /usr/local/bin/randtracker-deploy
REMOTE_SCRIPT
echo "Server ready."
