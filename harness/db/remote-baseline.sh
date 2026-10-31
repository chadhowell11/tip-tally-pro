#!/usr/bin/env bash
# Sets up the NEW hosted Supabase project from the production schema snapshot (Chad's decision,
# 2026-10-31: baseline = docs/handoff/schema.sql, not a replay of supabase/migrations/).
# Runs SQL through the Supabase Management API over HTTPS. The session's network secret adds
# the access token to requests to api.supabase.com; no token is read or printed here.
#
#   harness/db/remote-baseline.sh check    project info, Postgres version, table count in public
#   harness/db/remote-baseline.sh apply    applies the snapshot in one transaction; refuses unless public is empty
#   harness/db/remote-baseline.sh verify   compares the project's catalog with harness/db/expected-catalog.json
#
# Needs SUPABASE_PROJECT_REF (environment variable). Never point this at Lovable's production project.
set -euo pipefail
: "${SUPABASE_PROJECT_REF:?set SUPABASE_PROJECT_REF in the environment settings}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
API="https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF"

query() { # $1 = SQL text; prints the JSON rows
  local body out code
  body="$(jq -Rs '{query: .}' <<<"$1")"
  out="$(mktemp)"
  code="$(curl -sS -o "$out" -w '%{http_code}' -X POST "$API/database/query" -H 'Content-Type: application/json' --data-binary "$body")"
  if [[ "$code" != 2* ]]; then echo "query failed: HTTP $code: $(head -c 500 "$out")" >&2; rm -f "$out"; exit 1; fi
  cat "$out"; rm -f "$out"
}
public_tables() { query "select count(*)::int as n from information_schema.tables where table_schema='public'" | jq -r '.[0].n'; }

case "${1:-}" in
  check)
    code="$(curl -sS -o /tmp/ttp-project.json -w '%{http_code}' "$API")"
    [[ "$code" == 200 ]] || { echo "project lookup failed: HTTP $code: $(head -c 300 /tmp/ttp-project.json)" >&2; exit 1; }
    jq '{name, region, status, postgres: .database.version}' /tmp/ttp-project.json
    query "select version() as version" | jq -r '.[0].version'
    echo "tables in public: $(public_tables)"
    ;;
  apply)
    n="$(public_tables)"
    [[ "$n" == 0 ]] || { echo "refusing: public already has $n tables; this is not an empty project" >&2; exit 1; }
    query "begin;
$(cat "$ROOT/docs/handoff/schema.sql")
commit;" > /dev/null
    echo "applied docs/handoff/schema.sql; tables in public: $(public_tables)"
    ;;
  verify)
    got="$(mktemp)"
    query "$(cat "$ROOT/harness/db/catalog-fingerprint.sql")" | jq -r '.[0].fingerprint' | jq -S . > "$got"
    if diff -u "$ROOT/harness/db/expected-catalog.json" "$got"; then echo "catalog matches the production snapshot"; else echo "catalog DIFFERS from the production snapshot (diff above)" >&2; exit 1; fi
    ;;
  *) sed -n '2,12p' "$0"; exit 2 ;;
esac
