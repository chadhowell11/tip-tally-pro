#!/usr/bin/env bash
# Loads ONLY the scrubbed fixtures (fixtures/inputs.json) into the NEW Supabase project and checks
# the payroll math on what the database returns. Same Management API path as remote-baseline.sh.
#
#   harness/db/remote-seed.sh seed <owner-email>   one transaction: test location, settings, S01-S24,
#                                                  210 shifts; refuses if any location already exists
#   harness/db/remote-seed.sh check                reads the rows back the way the payroll screen
#                                                  selects them and compares engine output with
#                                                  fixtures/expected_v1.json (per shift and period totals)
#   harness/db/remote-seed.sh reset                deletes the test location and everything under it
#
# <owner-email> must already be a user in the project (Authentication > Users > Add user); it
# becomes the test location's owner, so that login sees the fixture data in the app.
# Local test: TTP_LOCAL_PG_PORT=54323 runs against local Postgres (harness/db/local-db.sh).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=harness/db/mgmt-api.sh
source "$ROOT/harness/db/mgmt-api.sh"
echo "target: $TTP_TARGET" >&2
gen() { node --experimental-strip-types --no-warnings "$ROOT/harness/db/seed-fixtures.ts" "$@"; }

case "${1:-}" in
  seed)
    [[ -n "${2:-}" ]] || { echo "usage: $0 seed <owner-email>" >&2; exit 2; }
    sql="$(gen seed-sql "$2")"
    query "$sql" > /dev/null
    echo "seeded fixtures/inputs.json"
    ;;
  check)
    out="$(mktemp)"
    query_json "$(gen readback-sql)" > "$out"
    gen check "$out"
    rm -f "$out"
    ;;
  reset)
    query "$(gen reset-sql)" > /dev/null
    echo "removed the test location"
    ;;
  *) sed -n '2,14p' "$0"; exit 2 ;;
esac
