#!/usr/bin/env bash
# Smoke test of the production images: migrate a fresh PostgreSQL with the
# migrate image, start API and web as they run on ECS (NODE_ENV=production,
# DB_* variables instead of a URL), then check health, the home page and the
# API through the web proxy.
#   smoke.sh <api-image> <migrate-image> <web-image>
set -euo pipefail
API_IMAGE="$1"; MIGRATE_IMAGE="$2"; WEB_IMAGE="$3"
NET=jpt-smoke

cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then
    for c in api web; do echo "----- docker logs $c -----"; docker logs --tail 60 "$c" 2>&1 || true; done
  fi
  docker rm -f db api web >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  exit "$status"
}
trap cleanup EXIT

docker network create "$NET" >/dev/null
docker run -d --name db --network "$NET" -e POSTGRES_USER=jpt -e POSTGRES_PASSWORD='p@ss w/ord' -e POSTGRES_DB=jpt postgres:16-alpine >/dev/null
for _ in $(seq 1 30); do docker exec db pg_isready -U jpt >/dev/null 2>&1 && break; sleep 1; done

DB=(-e DB_HOST=db -e DB_USER=jpt -e 'DB_PASSWORD=p@ss w/ord' -e DB_NAME=jpt -e DB_SSLMODE=disable)
echo "== migrate"
docker run --rm --network "$NET" "${DB[@]}" "$MIGRATE_IMAGE"

echo "== api"
docker run -d --name api --network "$NET" -p 4000:4000 "${DB[@]}" \
  -e NODE_ENV=production -e LOG_LEVEL=warn \
  -e IP_HASH_SECRET=smoke-ip-hash-secret-smoke-ip-hash-secret \
  -e PII_ENCRYPTION_KEY=2222222222222222222222222222222222222222222222222222222222222222 \
  -e KYC_WEBHOOK_SECRET=smoke-kyc-webhook-secret-0123456789abcd \
  -e PAYMENT_WEBHOOK_SECRET=smoke-payment-webhook-secret-01234567 \
  -e CORS_ORIGINS=http://localhost:3000 -e APP_URL=http://localhost:3000 -e TRUST_PROXY_HOPS=2 \
  "$API_IMAGE" >/dev/null
for _ in $(seq 1 60); do curl -fsS http://127.0.0.1:4000/health/ready >/dev/null 2>&1 && break; sleep 1; done
curl -fsS http://127.0.0.1:4000/health/ready; echo
test "$(docker exec api id -u)" != "0" || { echo "API runs as root"; exit 1; }
# Dev helpers must not exist in production.
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://127.0.0.1:4000/v1/dev/chain/advance -H 'content-type: application/json' -d '{"blocks":1}')
test "$code" = "404" || { echo "dev endpoint answered $code in production"; exit 1; }

echo "== web"
docker run -d --name web --network "$NET" -p 3000:3000 "$WEB_IMAGE" >/dev/null
for _ in $(seq 1 60); do curl -fsS http://127.0.0.1:3000/ >/dev/null 2>&1 && break; sleep 1; done
curl -fsS http://127.0.0.1:3000/ | grep -q 'Japan Property Token'
curl -fsS 'http://127.0.0.1:3000/api/v1/properties?pageSize=1' | grep -q '"items"'
curl -fsS http://127.0.0.1:3000/api/v1/regulatory/modules | grep -q 'SECONDARY_MARKET'
test "$(docker exec web id -u)" != "0" || { echo "web runs as root"; exit 1; }
docker image ls --format '{{.Repository}}:{{.Tag}} {{.Size}}' | grep -E "jpt-(api|web|migrate)"
echo "smoke OK"
