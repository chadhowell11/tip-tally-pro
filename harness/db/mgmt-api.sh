# Shared helpers for running SQL on the NEW hosted Supabase project through the Management API.
# Sourced by remote-baseline.sh and remote-seed.sh. The session's network secret adds the access
# token to requests to api.supabase.com; no token is read or printed here.
#
# SUPABASE_PROJECT_REF may be the bare ref or the project URL (https://<ref>.supabase.co);
# anything else is refused. Never point this at Lovable's production project.
#
# LOCAL TEST MODE: TTP_LOCAL_PG_PORT=<port> sends the same SQL to a local Postgres on 127.0.0.1
# (harness/db/local-db.sh) with psql instead of the API. Only 127.0.0.1 is ever used.

ttp_ref() {
  local raw="${SUPABASE_PROJECT_REF:-}" ref
  ref="${raw#https://}"; ref="${ref#http://}"; ref="${ref%%/*}"; ref="${ref%.supabase.co}"
  if [[ ! "$ref" =~ ^[a-z]{20}$ ]]; then
    echo "SUPABASE_PROJECT_REF must be a 20-letter project ref or https://<ref>.supabase.co (got '${raw}')" >&2
    return 1
  fi
  printf '%s' "$ref"
}

if [[ -n "${TTP_LOCAL_PG_PORT:-}" ]]; then
  TTP_TARGET="local Postgres 127.0.0.1:${TTP_LOCAL_PG_PORT}"
else
  TTP_REF="$(ttp_ref)" || exit 1
  API="https://api.supabase.com/v1/projects/$TTP_REF"
  TTP_TARGET="Supabase project $TTP_REF"
fi

# query SQL: runs SQL (one or more statements) and prints the JSON rows of the last statement.
query() {
  if [[ -n "${TTP_LOCAL_PG_PORT:-}" ]]; then
    # Local mode does not return rows; use query_json to read.
    local f rc=0; f="$(mktemp)"; printf '%s' "$1" > "$f"
    PGPASSWORD="${PGPASSWORD:-localtest}" psql -h 127.0.0.1 -p "$TTP_LOCAL_PG_PORT" -U postgres -d postgres \
      -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null || rc=$?
    rm -f "$f"; [[ $rc == 0 ]] || exit "$rc"; printf '[]'; return 0
  fi
  local body out code
  # Body goes through a file: the seed SQL is too large for a command-line argument.
  body="$(mktemp)"; out="$(mktemp)"
  printf '%s' "$1" | jq -Rs '{query: .}' > "$body"
  code="$(curl -sS -o "$out" -w '%{http_code}' -X POST "$API/database/query" -H 'Content-Type: application/json' --data-binary "@$body")"
  rm -f "$body"
  if [[ "$code" != 2* ]]; then echo "query failed: HTTP $code: $(head -c 500 "$out")" >&2; rm -f "$out"; exit 1; fi
  cat "$out"; rm -f "$out"
}

# query_json SQL: SQL must be a single SELECT returning one json column named j; prints that value.
# Works the same in API and local mode.
query_json() {
  if [[ -n "${TTP_LOCAL_PG_PORT:-}" ]]; then
    PGPASSWORD="${PGPASSWORD:-localtest}" psql -h 127.0.0.1 -p "$TTP_LOCAL_PG_PORT" -U postgres -d postgres \
      -v ON_ERROR_STOP=1 -qAt -c "$1"
  else
    query "$1" | jq -c '.[0].j'
  fi
}

public_tables() { query_json "select count(*)::int::text::json as j from information_schema.tables where table_schema='public'"; }
