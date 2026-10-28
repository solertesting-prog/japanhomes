#!/usr/bin/env bash
# CI check of the DEMO server stack exactly as install.sh runs it, with
# SITE_HOST=localhost (Caddy then uses its internal CA instead of Let's Encrypt).
set -euo pipefail
cd "$(dirname "$0")"
cat > .env <<ENV
POSTGRES_PASSWORD=$(openssl rand -hex 24)
IP_HASH_SECRET=$(openssl rand -hex 32)
PII_ENCRYPTION_KEY=$(openssl rand -hex 32)
KYC_WEBHOOK_SECRET=$(openssl rand -hex 32)
PAYMENT_WEBHOOK_SECRET=$(openssl rand -hex 32)
CUSTOM_DOMAIN=
SITE_HOST=localhost
ENV
c() { docker compose --env-file .env "$@"; }
cleanup() {
  local status=$?
  if [ "$status" -ne 0 ]; then c logs --tail 60 api web caddy || true; fi
  c down -v >/dev/null 2>&1 || true
  rm -f .env
  exit "$status"
}
trap cleanup EXIT

c --profile tools build
c up -d db
c run --rm migrate
c run --rm seed
c up -d

BASE=https://localhost
CURL=(curl -fsS -k --max-time 15)
for _ in $(seq 1 90); do "${CURL[@]}" "$BASE/" >/dev/null 2>&1 && break; sleep 2; done

echo "== home over HTTPS"
home=$("${CURL[@]}" "$BASE/")
grep -q 'Japan Property Token' <<<"$home"
echo "== security headers through Caddy"
headers=$("${CURL[@]}" -o /dev/null -D - "$BASE/")
grep -qi '^content-security-policy:' <<<"$headers"
grep -qi '^strict-transport-security:' <<<"$headers"
if grep -qi '^server:' <<<"$headers"; then echo "Server header leaked"; exit 1; fi
echo "== seeded catalogue through the web proxy"
total=$("${CURL[@]}" "$BASE/api/v1/properties?pageSize=1" | python3 -c 'import json,sys; print(json.load(sys.stdin)["total"])')
test "$total" -ge 6 || { echo "expected DEMO properties, got $total"; exit 1; }

echo "== public-demo restrictions"
email="ci.$(date +%s)@example.test"
jar=$(mktemp)
code=$(curl -s -k -o /dev/null -w '%{http_code}' -c "$jar" -H 'content-type: application/json' \
  -d "{\"email\":\"$email\",\"password\":\"a long enough passphrase\",\"acceptTerms\":true,\"acceptPrivacy\":true}" "$BASE/api/v1/auth/register")
test "$code" = "202" || { echo "register answered $code"; exit 1; }
outbox=$("${CURL[@]}" "$BASE/api/v1/dev/outbox?email=$email")
echo "$outbox" | grep -q 'auth.verify_email' || { echo "verification email not visible: $outbox"; exit 1; }
token=$(echo "$outbox" | python3 -c 'import json,sys; print(json.load(sys.stdin)["items"][0]["data"]["token"])')
"${CURL[@]}" -H 'content-type: application/json' -d "{\"token\":\"$token\"}" "$BASE/api/v1/auth/verify-email" >/dev/null
# Once confirmed, the outbox shows nothing for that address (no reset links for others to read).
test "$("${CURL[@]}" "$BASE/api/v1/dev/outbox?email=$email")" = '{"items":[]}'
curl -s -k -c "$jar" -b "$jar" -o /dev/null -H 'content-type: application/json' \
  -d "{\"email\":\"$email\",\"password\":\"a long enough passphrase\"}" "$BASE/api/v1/auth/login"
csrf=$(awk '$6=="jpt_csrf"{print $7}' "$jar")
code=$(curl -s -k -o /dev/null -w '%{http_code}' -b "$jar" -H "x-csrf-token: $csrf" -H 'content-type: application/json' \
  -d '{"role":"SUPER_ADMINISTRATOR"}' "$BASE/api/v1/dev/roles/grant")
test "$code" = "404" || { echo "self-service admin role answered $code on a public demo"; exit 1; }

echo "== back-office account from the server"
staff=$(c run --rm staff --email "ops.$(date +%s)@example.test" --role SUPER_ADMINISTRATOR)
grep -q 'One-time password' <<<"$staff"
echo "DEMO stack OK"
