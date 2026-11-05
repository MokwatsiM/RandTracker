#!/usr/bin/env bash
# Sets up CI deploys: installs randtracker-deploy on the server, creates a key limited
# to it and stores what the workflow needs on GitHub. Safe to run again, which also
# replaces the key. Needs gh logged in, and run from inside the repo.
#
#   scripts/install-deploy-key.sh root@your-server
set -euo pipefail

REMOTE="${1:?usage: install-deploy-key.sh user@host}"
HOST="${REMOTE#*@}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

ssh-keygen -q -t ed25519 -N '' -C "randtracker-github-actions" -f "$TMP/key"
LINE="restrict,command=\"/usr/local/bin/randtracker-deploy\" $(cat "$TMP/key.pub")"

scp -q "$ROOT/deploy/randtracker-deploy.sh" "$REMOTE:/usr/local/bin/randtracker-deploy"
ssh "$REMOTE" "chmod 755 /usr/local/bin/randtracker-deploy
  sed -i '/randtracker-github-actions/d' ~/.ssh/authorized_keys
  echo '$LINE' >> ~/.ssh/authorized_keys"

gh secret set VPS_HOST --body "$HOST"
gh secret set VPS_KNOWN_HOSTS --body "$(ssh-keyscan -q -t ed25519 "$HOST")"
gh secret set VPS_SSH_KEY < "$TMP/key"

# Both end up in the browser bundle, so they aren't secret.
gh variable set SUPABASE_URL --body "$(ssh "$REMOTE" "sed -n 's/^API_URL=//p' /opt/randtracker/deploy/.env")"
gh variable set SUPABASE_ANON_KEY --body "$(ssh "$REMOTE" "sed -n 's/^ANON_KEY=//p' /opt/randtracker/deploy/.env")"
echo "Done. CI can now deploy to $HOST."
