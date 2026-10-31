#!/usr/bin/env bash
# Adds production's logo storage (bucket + 8 policies) to the NEW Supabase project.
#
#   harness/db/remote-storage.sh apply    runs harness/db/storage-logos.sql in one transaction; refuses if the bucket exists
#   harness/db/remote-storage.sh verify   compares bucket + storage policies with harness/db/expected-storage.json
#
# Same Management API path and SUPABASE_PROJECT_REF rules as remote-baseline.sh.
# Local test: TTP_LOCAL_PG_PORT=54323 (local Postgres with the snapshot applied).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=harness/db/mgmt-api.sh
source "$ROOT/harness/db/mgmt-api.sh"
echo "target: $TTP_TARGET" >&2

case "${1:-}" in
  apply)
    query "begin;
$(cat "$ROOT/harness/db/storage-logos.sql")
commit;" > /dev/null
    echo "applied harness/db/storage-logos.sql"
    ;;
  verify)
    got="$(mktemp)"
    query_json "select fingerprint::json as j from ($(sed '/^--/d; s/;[[:space:]]*$//' "$ROOT/harness/db/storage-fingerprint.sql")) f" | jq -S . > "$got"
    if diff -u "$ROOT/harness/db/expected-storage.json" "$got"; then echo "logo storage matches production"; else echo "logo storage DIFFERS from production (diff above)" >&2; exit 1; fi
    ;;
  *) sed -n '2,9p' "$0"; exit 2 ;;
esac
