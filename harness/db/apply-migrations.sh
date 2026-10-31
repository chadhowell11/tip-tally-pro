#!/usr/bin/env bash
# Applies supabase/migrations/*.sql, in filename order, to a LOCAL Postgres only.
# Usage: PGPASSWORD=... harness/db/apply-migrations.sh <host> <port>
# Refuses anything but localhost so it can never touch a hosted database.
set -euo pipefail
HOST="${1:-127.0.0.1}"; PORT="${2:-54322}"
case "$HOST" in 127.0.0.1|localhost) ;; *) echo "refusing non-local host $HOST" >&2; exit 2;; esac
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PSQL=(psql -h "$HOST" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$ROOT/harness/db/local-supabase-shims.sql"
n=0
for f in "$ROOT"/supabase/migrations/*.sql; do
  pre="$ROOT/harness/db/pre/$(basename "$f")"
  if [ -f "$pre" ]; then "${PSQL[@]}" -f "$pre"; echo "pre-hook: $(basename "$pre")"; fi
  "${PSQL[@]}" --single-transaction -f "$f" || { echo "FAILED: $(basename "$f")" >&2; exit 1; }
  n=$((n+1))
done
echo "applied $n migrations"
