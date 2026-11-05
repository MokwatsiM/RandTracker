#!/usr/bin/env bash
# Runs on the server as the forced command of the CI deploy key, so that key can do
# only this. Install it with scripts/install-deploy-key.sh.
#
#   config            reads a tar of the compose files and migrations on stdin
#   migrate           applies migrations that haven't run yet
#   deploy <sha>      reads "<registry user>\n<registry token>" on stdin
#
# A deploy that fails its health check goes back to the previous image.
set -euo pipefail

DIR=/opt/randtracker/deploy
IMAGES="$DIR/images.env"
PREFIX=$(cat "$DIR/image-prefix") # ghcr.io/<owner>/<repo>
COMPOSE=(docker compose --env-file "$DIR/.env" --env-file "$IMAGES"
  -f "$DIR/docker-compose.yml" --profile tunnel)
HEALTH_URL=http://localhost:13200/auth/login

exec 9>/run/randtracker-deploy.lock
flock 9
touch "$IMAGES"

healthy() {
  for _ in $(seq 1 60); do
    curl -sf -o /dev/null --max-time 5 "$HEALTH_URL" && return 0
    sleep 2
  done
  return 1
}

set_image() { # <image, or empty>
  sed -i "/^APP_IMAGE=/d" "$IMAGES"
  if [ -n "$1" ]; then echo "APP_IMAGE=$1" >> "$IMAGES"; fi
}

# supabase_admin: creating the signup trigger on auth.users needs more than postgres has.
psql_db() { "${COMPOSE[@]}" exec -T db psql -q -v ON_ERROR_STOP=1 -U supabase_admin -d postgres "$@"; }

migrate() {
  psql_db -c "CREATE SCHEMA IF NOT EXISTS app_migrations;
    CREATE TABLE IF NOT EXISTS app_migrations.applied (name text PRIMARY KEY, applied_at timestamptz DEFAULT now());"
  for file in "$DIR"/supabase/migrations/*.sql; do
    name=$(basename "$file")
    [ -z "$(psql_db -Atc "SELECT 1 FROM app_migrations.applied WHERE name = '$name'")" ] || continue
    echo "Applying $name"
    { cat "$file"; echo; echo "INSERT INTO app_migrations.applied (name) VALUES ('$name');"; } | psql_db --single-transaction
  done
}

read -r action sha extra <<< "${SSH_ORIGINAL_COMMAND:-}"

case "$action" in
  config)
    tar -xzf - --no-same-owner -C "$DIR" docker-compose.yml gateway db supabase/migrations
    echo "Config updated"
    ;;
  migrate)
    migrate
    ;;
  deploy)
    [ -z "${extra:-}" ] && [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "Bad arguments" >&2; exit 2; }
    image="$PREFIX-app:$sha"

    # The token lives only in this throwaway config, and only for the pull.
    read -r user
    read -r token
    conf=$(mktemp -d)
    trap 'rm -rf "$conf"' EXIT
    printf '%s' "$token" | docker --config "$conf" login ghcr.io -u "$user" --password-stdin >/dev/null
    docker --config "$conf" pull -q "$image"
    rm -rf "$conf"

    migrate

    previous=$(sed -n "s/^APP_IMAGE=//p" "$IMAGES")
    set_image "$image"
    "${COMPOSE[@]}" up -d --no-build --no-deps --pull never app

    if ! healthy; then
      echo "App failed its health check, going back to ${previous:-nothing}" >&2
      set_image "$previous"
      if [ -n "$previous" ]; then
        "${COMPOSE[@]}" up -d --no-build --no-deps --pull never app
        healthy || echo "The previous image isn't healthy either" >&2
      fi
      exit 1
    fi

    # Keep the last three images for rollbacks.
    docker images "$PREFIX-app" --format '{{.Repository}}:{{.Tag}}' | tail -n +4 | xargs -r docker rmi >/dev/null 2>&1 || true
    echo "Deployed $image"
    ;;
  *)
    echo "Usage: config | migrate | deploy <sha>" >&2
    exit 2
    ;;
esac
