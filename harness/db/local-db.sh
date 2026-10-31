#!/usr/bin/env bash
# Fresh LOCAL Supabase-shaped Postgres for migration tests. Never touches a hosted database.
#   1. supabase/postgres container (roles, extensions, storage schema)
#   2. GoTrue run once, so the auth schema is the real one hosted Supabase has
#   3. every file in supabase/migrations/ applied unchanged, in order
# Usage: harness/db/local-db.sh [name] [port] [schema.sql]
#   default: container ttp-pg on 127.0.0.1:54322, built from supabase/migrations/
#   with a schema file: built from that file instead (e.g. docs/handoff/schema.sql), for comparison
set -euo pipefail
NAME="${1:-ttp-pg}"; PORT="${2:-54322}"; SCHEMA_FILE="${3:-}"
PG_IMAGE="${PG_IMAGE:-supabase/postgres:17.4.1.020}"  # production and new Supabase projects run PG17
AUTH_IMAGE=supabase/gotrue:v2.170.0
PW=localtest
docker rm -f "$NAME" "$NAME-auth" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=$PW -p "$PORT":5432 $PG_IMAGE >/dev/null
export PGPASSWORD=$PW
for _ in $(seq 1 60); do psql -h 127.0.0.1 -p "$PORT" -U postgres -Atqc "select 1" >/dev/null 2>&1 && break; sleep 1; done
psql -h 127.0.0.1 -p "$PORT" -U supabase_admin -d postgres -qc "alter role supabase_auth_admin with login password '$PW'"
docker run -d --name "$NAME-auth" --network "container:$NAME" \
  -e GOTRUE_DB_DRIVER=postgres \
  -e "GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin:$PW@127.0.0.1:5432/postgres?search_path=auth" \
  -e GOTRUE_JWT_SECRET=local-test-secret-at-least-32-characters-long \
  -e GOTRUE_SITE_URL=http://localhost:3000 -e API_EXTERNAL_URL=http://localhost:9999 \
  -e GOTRUE_API_HOST=0.0.0.0 -e PORT=9999 $AUTH_IMAGE >/dev/null
for _ in $(seq 1 90); do
  psql -h 127.0.0.1 -p "$PORT" -U postgres -Atqc "select 1 from information_schema.columns where table_schema='auth' and table_name='users' and column_name='email_confirmed_at'" 2>/dev/null | grep -q 1 && break
  sleep 1
done
sleep 3  # let GoTrue finish its remaining migrations
docker logs "$NAME-auth" 2>&1 | grep -iE "migrat|error|fatal" | tail -3
docker rm -f "$NAME-auth" >/dev/null
if [ -n "$SCHEMA_FILE" ]; then
  psql -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f "$(dirname "$0")/local-supabase-shims.sql"
  psql -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f "$SCHEMA_FILE"
  echo "applied $SCHEMA_FILE"
else
  "$(dirname "$0")/apply-migrations.sh" 127.0.0.1 "$PORT"
fi
