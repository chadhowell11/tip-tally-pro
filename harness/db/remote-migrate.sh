#!/usr/bin/env bash
# PRODUCTION DATA MIGRATION into the NEW Supabase project (docs/DATA-MIGRATION-PLAN.md).
# Runs only with Chad's written approval. Same Management API path and SUPABASE_PROJECT_REF rules as
# remote-baseline.sh; never points at Lovable.
#
#   harness/db/remote-migrate.sh inspect <backup>                                locations, logins, row counts
#   harness/db/remote-migrate.sh load    <backup> <location-id> <operator-email> one transaction; refuses if any
#                                                                                location or export login exists
#   harness/db/remote-migrate.sh check   <backup> <location-id> <operator-email> counts + checksums vs the export,
#                                                                                payroll engine vs expected_v1.json
#   harness/db/remote-migrate.sh wipe    <backup> <location-id>                  removes the migrated location
#                                                                                and logins (no-go / redo)
#
# <backup> is Lovable's pg_dump custom-format file (PostgreSQL 17 pg_restore needed). It is unpacked into
# a private temp folder that is deleted on exit; never copy it or its contents into the repo.
# Local rehearsal: TTP_LOCAL_PG_PORT=<port> (harness/db/local-db.sh with docs/handoff/schema.sql).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=harness/db/mgmt-api.sh
source "$ROOT/harness/db/mgmt-api.sh"
echo "target: $TTP_TARGET" >&2
PG_RESTORE="${PG_RESTORE:-/usr/lib/postgresql/17/bin/pg_restore}"
gen() { node --experimental-strip-types --no-warnings "$ROOT/harness/db/migrate-export.ts" "$@"; }
seedgen() { node --experimental-strip-types --no-warnings "$ROOT/harness/db/seed-fixtures.ts" "$@"; }

cmd="${1:-}"; backup="${2:-}"; loc="${3:-}"; op="${4:-}"
[[ -n "$cmd" && -f "$backup" ]] || { sed -n '2,17p' "$0"; exit 2; }
work="$(mktemp -d)"; chmod 700 "$work"; trap 'rm -rf "$work"' EXIT
"$PG_RESTORE" --data-only -n public -f "$work/public.sql" "$backup"
"$PG_RESTORE" --data-only -n auth -t users -t identities -f "$work/auth.sql" "$backup"
P="$work/public.sql"; A="$work/auth.sql"

case "$cmd" in
  inspect) gen inspect "$P" "$A" ;;
  load)
    [[ -n "$loc" && -n "$op" ]] || { echo "usage: $0 load <backup> <location-id> <operator-email>" >&2; exit 2; }
    gen load-sql "$P" "$A" "$loc" "$op" > "$work/load.sql"
    query "$(cat "$work/load.sql")" > /dev/null
    echo "loaded location $loc and the export's logins"
    ;;
  check)
    [[ -n "$loc" && -n "$op" ]] || { echo "usage: $0 check <backup> <location-id> <operator-email>" >&2; exit 2; }
    query_json "$(gen sums-sql "$P" "$A" "$loc" "$op")" > "$work/sums.json"
    gen sums-cmp "$P" "$A" "$loc" "$work/sums.json"
    query_json "$(seedgen readback-sql "$loc")" > "$work/readback.json"
    seedgen check "$work/readback.json" by-sorted-staff-id
    ;;
  wipe)
    [[ -n "$loc" ]] || { echo "usage: $0 wipe <backup> <location-id>" >&2; exit 2; }
    query "$(gen wipe-sql "$P" "$A" "$loc")" > /dev/null
    echo "removed location $loc and the export's logins"
    ;;
  *) sed -n '2,17p' "$0"; exit 2 ;;
esac
