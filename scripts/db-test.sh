#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Applies every migration to a throwaway PostgreSQL database and runs the SQL
# test suite against it.
#
# Uses a plain PostgreSQL server plus the shim in supabase/tests/00_harness.sql
# rather than the Supabase CLI, so it runs in CI without Docker.
#
#   PGHOST/PGPORT/PGUSER point at an existing server if you have one;
#   otherwise this script starts a private instance under $PGROOT.
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PGROOT="${PGROOT:-/var/tmp/compences-pg}"
PGPORT="${PGPORT:-55432}"
DB="${DB:-compences_test}"
OWN_SERVER=0

log() { printf '\033[36m%s\033[0m\n' "$*"; }

start_server() {
  log "▸ starting a private PostgreSQL instance in $PGROOT"
  rm -rf "$PGROOT"
  mkdir -p "$PGROOT/data" "$PGROOT/run"
  # initdb refuses to run as root, so hand the cluster to an unprivileged user.
  local RUNAS=""
  if [ "$(id -u)" = "0" ]; then
    chown -R nobody:nogroup "$PGROOT"
    chmod 755 "$PGROOT"
    RUNAS="su nobody -s /bin/bash -c"
  fi
  if [ -n "$RUNAS" ]; then
    $RUNAS "$PGBIN/initdb -D $PGROOT/data -U postgres --auth=trust -E UTF8" >/dev/null
    $RUNAS "$PGBIN/pg_ctl -D $PGROOT/data \
      -o '-p $PGPORT -k $PGROOT/run -c listen_addresses=' \
      -l $PGROOT/pg.log start -w -t 60" >/dev/null
  else
    "$PGBIN/initdb" -D "$PGROOT/data" -U postgres --auth=trust -E UTF8 >/dev/null
    "$PGBIN/pg_ctl" -D "$PGROOT/data" \
      -o "-p $PGPORT -k $PGROOT/run -c listen_addresses=" \
      -l "$PGROOT/pg.log" start -w -t 60 >/dev/null
  fi
  OWN_SERVER=1
  PGHOST="$PGROOT/run"
}

if [ -z "${PGHOST:-}" ]; then
  if [ -S "$PGROOT/run/.s.PGSQL.$PGPORT" ]; then
    PGHOST="$PGROOT/run"
    log "▸ reusing the instance already running in $PGROOT"
  else
    start_server
  fi
fi

export PGHOST PGPORT
PGUSER="${PGUSER:-postgres}"
export PGUSER

psql_q() { psql -v ON_ERROR_STOP=1 -q "$@"; }

log "▸ recreating database $DB"
psql_q -d postgres -c "drop database if exists $DB;" -c "create database $DB;"

log "▸ installing the Supabase shim"
psql_q -d "$DB" -f "$ROOT/supabase/tests/00_harness.sql" >/dev/null

log "▸ applying migrations"
for f in "$ROOT"/supabase/migrations/*.sql; do
  printf '   %s\n' "$(basename "$f")"
  psql_q -d "$DB" -f "$f" >/dev/null
done

log "▸ loading assertions"
psql_q -d "$DB" -f "$ROOT/supabase/tests/01_assertions.sql" >/dev/null

log "▸ running tests"
# Not -v ON_ERROR_STOP: the suite deliberately provokes errors via test.raises,
# and psql reports those on stderr even though they are expected.
psql -q -d "$DB" -f "$ROOT/supabase/tests/02_rls_test.sql" \
  > "$PGROOT/test.out" 2> "$PGROOT/test.err" || true

# Any error NOT produced inside test.raises means the suite itself broke.
UNEXPECTED=$(grep -c '^psql:.*ERROR' "$PGROOT/test.err" || true)

echo
psql -q -d "$DB" -c "select label, coalesce(detail,'') as detail from test.results where not passed;"
read -r TOTAL PASSED FAILED <<<"$(psql -tAF' ' -d "$DB" -c 'select * from test.report();')"

echo
if [ "$UNEXPECTED" != "0" ]; then
  echo "✗ $UNEXPECTED statement(s) errored outside of an expected-failure assertion:"
  grep '^psql:.*ERROR' "$PGROOT/test.err" | head -20
fi

if [ "${FAILED:-1}" != "0" ] || [ "$UNEXPECTED" != "0" ]; then
  echo "✗ FAILED — $PASSED/$TOTAL assertions passed"
  exit 1
fi

echo "✓ all $PASSED assertions passed"
