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
# Needs SUPABASE_PROJECT_REF (bare ref or https://<ref>.supabase.co). Never point this at Lovable's production project.
# Local test: TTP_LOCAL_PG_PORT=54323 runs apply/verify against local Postgres (check needs the API).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=harness/db/mgmt-api.sh
source "$ROOT/harness/db/mgmt-api.sh"
echo "target: $TTP_TARGET" >&2

case "${1:-}" in
  check)
    [[ -z "${TTP_LOCAL_PG_PORT:-}" ]] || { echo "check needs the Management API; unset TTP_LOCAL_PG_PORT" >&2; exit 2; }
    code="$(curl -sS -o /tmp/ttp-project.json -w '%{http_code}' "$API")"
    [[ "$code" == 200 ]] || { echo "project lookup failed: HTTP $code: $(head -c 300 /tmp/ttp-project.json)" >&2; exit 1; }
    jq '{name, region, status, postgres: .database.version}' /tmp/ttp-project.json
    query_json "select to_json(version()) as j" | jq -r .
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
    query_json "select fingerprint::json as j from ($(sed '/^--/d; s/;[[:space:]]*$//' "$ROOT/harness/db/catalog-fingerprint.sql")) f" | jq -S . > "$got"
    if diff -u "$ROOT/harness/db/expected-catalog.json" "$got"; then echo "catalog matches the production snapshot"; else echo "catalog DIFFERS from the production snapshot (diff above)" >&2; exit 1; fi
    ;;
  *) sed -n '2,13p' "$0"; exit 2 ;;
esac
