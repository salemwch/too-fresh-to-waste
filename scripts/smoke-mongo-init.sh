#!/usr/bin/env bash
#
# Regression check for the mongo-init readiness race.
#
# The mongodb healthcheck used to ping `localhost` unauthenticated, which the
# temporary mongod inside docker-entrypoint-initdb.d answers. `service_healthy`
# therefore fired mid-initialisation, mongod restarted underneath mongo-init,
# and mongo-init exited 1 with ECONNREFUSED - intermittently, roughly half the
# time, which is the worst kind of CI failure.
#
# This drives a COLD volume N times and asserts mongo-init exits 0 every time.
# A cold volume is the point: a warm one skips initdb entirely and cannot
# reproduce the race.
#
# Runs against throwaway volumes under an isolated project name, so it never
# touches foodwaste-mongodb-data.
#
#   ./scripts/smoke-mongo-init.sh [runs]      # default 3
set -euo pipefail

RUNS="${1:-3}"
PROJECT="mongoinit-smoke"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OVERRIDE="$(mktemp -t mongoinit-smoke-XXXXXX.yml)"
trap 'rm -f "$OVERRIDE"' EXIT

cat > "$OVERRIDE" <<'YAML'
services:
  mongodb:
    container_name: mongoinit-smoke-mongodb
    ports: !override
      - "127.0.0.1:27117:27017"
  mongo-init:
    container_name: mongoinit-smoke-init
volumes:
  mongodb_data:
    name: mongoinit-smoke-data
  mongodb_config:
    name: mongoinit-smoke-config
YAML

export MONGO_ROOT_USERNAME="smoke_root"
export MONGO_ROOT_PASSWORD="$(node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))")"
export MONGO_APP_USERNAME="smoke_app"
export MONGO_APP_PASSWORD="$(node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))")"
export JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")"
export JWT_REFRESH_SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")"

dc() { docker compose -f "$ROOT/docker-compose.yml" -f "$OVERRIDE" -p "$PROJECT" "$@"; }
cleanup_stack() {
  dc down --remove-orphans >/dev/null 2>&1 || true
  docker volume rm mongoinit-smoke-data mongoinit-smoke-config >/dev/null 2>&1 || true
}

failures=0
for i in $(seq 1 "$RUNS"); do
  printf 'run %s/%s: ' "$i" "$RUNS"
  cleanup_stack
  dc up -d mongodb mongo-init >/dev/null 2>&1

  code="$(docker wait mongoinit-smoke-init 2>/dev/null | head -1)"
  if [ "$code" != "0" ]; then
    printf 'FAIL (mongo-init exit %s)\n' "$code"
    docker logs mongoinit-smoke-init 2>&1 | tail -5
    failures=$((failures + 1))
    continue
  fi

  # mongo-init exiting 0 must mean a writable PRIMARY, not just "no crash".
  if ! docker exec mongoinit-smoke-mongodb mongosh \
      "mongodb://${MONGO_ROOT_USERNAME}:${MONGO_ROOT_PASSWORD}@localhost:27017/admin?directConnection=true" \
      --quiet --eval 'quit(db.hello().isWritablePrimary ? 0 : 1)' >/dev/null 2>&1; then
    printf 'FAIL (exited 0 but node is not a writable PRIMARY)\n'
    failures=$((failures + 1))
    continue
  fi

  # and the app account the init script creates must exist
  users="$(docker exec mongoinit-smoke-mongodb mongosh \
      "mongodb://${MONGO_ROOT_USERNAME}:${MONGO_ROOT_PASSWORD}@localhost:27017/admin?directConnection=true" \
      --quiet --eval 'print(db.getSiblingDB("foodwaste").getUsers().users.map(u=>u.user).join(","))' 2>/dev/null | tail -1)"
  if [ "$users" != "$MONGO_APP_USERNAME" ]; then
    printf 'FAIL (expected app user %s, got "%s")\n' "$MONGO_APP_USERNAME" "$users"
    failures=$((failures + 1))
    continue
  fi

  printf 'ok (exit 0, writable PRIMARY, app user present)\n'
done

cleanup_stack
if [ "$failures" -ne 0 ]; then
  echo "FAILED: $failures/$RUNS runs"
  exit 1
fi
echo "PASSED: $RUNS/$RUNS cold-start runs"
