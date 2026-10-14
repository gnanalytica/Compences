#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Boots the built web app and checks that the public surface answers correctly.
#
# This is deliberately about wiring, not data: it runs against placeholder
# Supabase credentials, so it asserts the things that must hold regardless —
# health is up, the API rejects anonymous callers, the MCP endpoint speaks
# JSON-RPC and refuses unauthenticated calls, and the WhatsApp webhook rejects
# an unsigned body.
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-3111}"
BASE="http://127.0.0.1:$PORT"
LOG="${TMPDIR:-/tmp}/compences-smoke.log"

pass=0
fail=0

check() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    printf '  \033[32m✓\033[0m %s\n' "$label"
    pass=$((pass + 1))
  else
    printf '  \033[31m✗\033[0m %s — expected %s, got %s\n' "$label" "$expected" "$actual"
    fail=$((fail + 1))
  fi
}

contains() {
  local label="$1" needle="$2" haystack="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    printf '  \033[32m✓\033[0m %s\n' "$label"
    pass=$((pass + 1))
  else
    printf '  \033[31m✗\033[0m %s — %q not found in %q\n' "$label" "$needle" "${haystack:0:200}"
    fail=$((fail + 1))
  fi
}

status() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

cd "$ROOT/apps/web"

# A server left behind by an earlier run would answer on this port and the
# whole suite would silently test a stale build. Refuse to start rather than
# report green against yesterday's code.
if curl -sf -o /dev/null --max-time 2 "$BASE/api/health" 2>/dev/null; then
  echo "✗ something is already serving $BASE — stop it first, or run with PORT=<free port>."
  exit 1
fi

echo "▸ starting the server on :$PORT"
# `npx` spawns the real server as a child and exits-by-exec unpredictably, so
# signalling only the job leaves next-server holding the port — which is exactly
# how one run poisons the next. setsid puts it in its own process group so the
# whole tree goes down together.
setsid env PORT="$PORT" npx next start -p "$PORT" > "$LOG" 2>&1 &
SERVER_PID=$!
cleanup() {
  kill -- "-$SERVER_PID" 2>/dev/null || kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

for _ in $(seq 1 60); do
  if curl -sf "$BASE/api/health" > /dev/null 2>&1; then break; fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "server exited early:"; tail -20 "$LOG"; exit 1
  fi
  sleep 1
done

echo "▸ health"
check "GET /api/health is 200" 200 "$(status "$BASE/api/health")"
contains "health reports the service name" '"compences"' "$(curl -s "$BASE/api/health")"

echo "▸ public pages"
check "GET / renders the landing page" 200 "$(status "$BASE/")"
check "GET /login renders" 200 "$(status "$BASE/login")"
check "GET /app redirects a signed-out visitor" 307 \
  "$(status -o /dev/null "$BASE/app")"
check "GET /privacy renders" 200 "$(status "$BASE/privacy")"
check "GET /terms renders" 200 "$(status "$BASE/terms")"
# This one is filed with Google Play as the app's account-deletion URL, and
# has to answer for somebody who has uninstalled the app and cannot sign in.
# A 404 here is not a broken page, it is a broken compliance commitment.
check "GET /delete-account renders for a signed-out visitor" 200 \
  "$(status "$BASE/delete-account")"
contains "and tells them how to delete their account" "Delete your account" \
  "$(curl -s "$BASE/delete-account")"

echo "▸ REST API refuses anonymous callers"
for path in /api/v1/me /api/v1/events /api/v1/announcements /api/v1/polls /api/v1/members; do
  check "GET $path is 401" 401 "$(status "$BASE$path")"
done
contains "401 carries a machine-readable code" '"unauthorized"' \
  "$(curl -s "$BASE/api/v1/me")"
contains "401 advertises the auth scheme" 'Bearer' \
  "$(curl -s -D - -o /dev/null "$BASE/api/v1/me")"

echo "▸ API keys"
check "a bogus API key is rejected" 401 \
  "$(status -H 'Authorization: Bearer sam_live_0000000000000000000000000000000000' "$BASE/api/v1/me")"

echo "▸ routes that no longer exist are gone, not quietly serving"
for path in /api/v1/requests /api/v1/visitors /api/v1/invoices /api/v1/amenities; do
  check "GET $path is 404" 404 "$(status "$BASE$path")"
done

echo "▸ MCP"
check "GET /api/mcp is 405 (POST-only transport)" 405 "$(status "$BASE/api/mcp")"
check "unauthenticated initialize is 401" 401 \
  "$(status -X POST -H 'Content-Type: application/json' \
      -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}' "$BASE/api/mcp")"
contains "MCP errors are JSON-RPC shaped" '"jsonrpc":"2.0"' \
  "$(curl -s -X POST -H 'Content-Type: application/json' \
      -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}' "$BASE/api/mcp")"

echo "▸ WhatsApp webhook"
# Unconfigured in this environment, so 503 is correct; with credentials set it
# must be 403 for an unsigned body. Either proves it never accepts one.
WA_POST=$(status -X POST -H 'Content-Type: application/json' -d '{"object":"x"}' "$BASE/api/webhooks/whatsapp")
if [ "$WA_POST" = "503" ] || [ "$WA_POST" = "403" ]; then
  printf '  \033[32m✓\033[0m unsigned webhook body is never accepted (%s)\n' "$WA_POST"
  pass=$((pass + 1))
else
  printf '  \033[31m✗\033[0m unsigned webhook body returned %s\n' "$WA_POST"
  fail=$((fail + 1))
fi

echo "▸ Push dispatch"
# Same rule: 503 without a configured secret, 401 with one but a missing or
# wrong header. It must never send pushes for an anonymous caller.
PUSH_POST=$(status -X POST -H 'Content-Type: application/json' -H 'x-dispatch-secret: wrong' -d '{}' "$BASE/api/webhooks/push-dispatch")
if [ "$PUSH_POST" = "503" ] || [ "$PUSH_POST" = "401" ]; then
  printf '  \033[32m✓\033[0m push dispatch refuses a caller without the secret (%s)\n' "$PUSH_POST"
  pass=$((pass + 1))
else
  printf '  \033[31m✗\033[0m push dispatch without the secret returned %s\n' "$PUSH_POST"
  fail=$((fail + 1))
fi

echo "▸ Android App Links"
check "GET /.well-known/assetlinks.json is 200" 200 "$(status "$BASE/.well-known/assetlinks.json")"

echo
if [ "$fail" -gt 0 ]; then
  echo "✗ smoke test: $pass passed, $fail failed"
  echo "--- server log ---"; tail -30 "$LOG"
  exit 1
fi
echo "✓ smoke test: all $pass checks passed"
