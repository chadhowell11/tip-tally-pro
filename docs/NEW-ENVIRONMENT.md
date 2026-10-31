# New environment: Supabase + Render

**Status (2026-10-31, later):** Seed script and math check are ready and pass on a local PG17 copy of the snapshot. Nothing has been run against the hosted project yet: the first read-only `check` is waiting on Chad to confirm the project ref (see "Blocked: confirm the project ref"). Scope and rules are in `CLAUDE.md` ("New environment rules").

## Blocked: confirm the project ref

- `SUPABASE_PROJECT_REF` in the environment is the project **URL** (`https://mmutdqklchnftziikqpq.supabase.co`), not the bare ref. The scripts now accept either form (`harness/db/mgmt-api.sh`) and refuse anything that isn't a 20-letter ref.
- Nothing in the repo records Lovable's production ref, so the session cannot prove `mmutdqklchnftziikqpq` is the new project and not production. The session's permission check stopped the first `check` call for that reason, and no request was sent.
- To unblock: Chad confirms `mmutdqklchnftziikqpq` is the new project (Supabase dashboard → the new project → Settings → General → Reference ID) and allows the call. Setting the variable to the bare ref is tidier but not required. Scope and rules are in `CLAUDE.md` ("New environment rules").

## Local migration test

**Result: the 31 repo migrations rebuild production's schema exactly on PostgreSQL 17, with two exceptions, both handled below.**

Run it: `harness/db/local-db.sh` (Docker required; local only, it refuses any non-localhost host).

| Step | What it does |
| --- | --- |
| 1 | Starts `supabase/postgres:17.4.1.020` (production and new Supabase projects run PG17) |
| 2 | Runs Supabase's auth service (`supabase/gotrue:v2.170.0`) once, so `auth.*` is the real hosted schema (54 auth migrations) |
| 3 | Applies all 31 files in `supabase/migrations/` unchanged, in order |

To compare against production, `harness/db/local-db.sh ttp-snap 54323 docs/handoff/schema.sql` builds a second database from Lovable's production catalog snapshot. A `pg_dump --schema-only -n public` diff of the two:

| | Result |
| --- | --- |
| Tables, columns, types, enums, functions, policies, indexes, triggers, grants | Identical, except the row below |
| `tip_override_audit` table, `log_tip_override()` function, its 2 triggers, index, RLS policy and grants | **In production, missing from every migration file.** Lovable's `docs/handoff/MIGRATIONS.md` confirms the creation migration was never committed. The app's audit panel (`src/components/audit-panel.tsx`) reads this table. |

### Problems a fresh project will hit

1. **Migration `20260627204538` fails on any fresh database.** It sets `app_settings.location_id` to a hard-coded production location id (`86f88398-…`), which doesn't exist yet, so it violates the foreign key. The local test works around it with a test-only pre-hook (`harness/db/pre/`) that creates a placeholder owner and location first. The migration itself is unchanged.
2. **The override audit is missing** (above). Without it, override history stops being recorded in the new environment.
3. **Other data fixes are harmless on an empty database.** Six other migrations hold one-off production data fixes (deleting test locations, a test user, duplicate settings rows). On an empty database they do nothing.

### Decision: Option A, the production snapshot (Chad, 2026-10-31)

The hosted project is built from `docs/handoff/schema.sql`. The 31 Lovable migrations stay in the repo as history only. Options considered:

| Option | How | Pros | Cons |
| --- | --- | --- | --- |
| **A. Baseline from the production catalog (recommended)** | One baseline migration = `docs/handoff/schema.sql` (or a fresh `pg_dump --schema-only` of production at migration time), with the 31 Lovable files kept for history only | Matches production exactly, audit included; no production data fixes replayed | A new migration file; Chad approves it as the new starting point |
| B. Replay the 31 migrations | Same as the local test, plus a one-time setup step for the placeholder location and a new migration recreating the audit from the catalog | Keeps Lovable's history as the executable path | Replays production data fixes; needs two workarounds |

Either way, the production data migration later must reproduce the Lovable payroll CSV export for a recent pay period to the cent.

## What the app needs to run outside Lovable

| Piece | Today | Change for the new environment |
| --- | --- | --- |
| Build target | Nitro preset `cloudflare-module`, from `@lovable.dev/vite-tanstack-config` | Build with the `node-server` preset; Render runs `node .output/server/index.mjs` |
| Google sign-in | `@lovable.dev/cloud-auth-js` (Lovable's login service) | Supabase's built-in Google login (`supabase.auth.signInWithOAuth`). Email and password already go straight to Supabase. |
| Text messages | Twilio through Lovable's gateway (`connector-gateway.lovable.dev`), `LOVABLE_API_KEY` + `TWILIO_API_KEY` | Direct Twilio API with your own Twilio account SID and auth token |
| Error reporting | `src/lib/lovable-error-reporting.ts` | Remove, or replace with a service of your choice |
| Environment variables | `.env.example` | Set in Render and in this session's environment secrets, never in the repo |

## What Chad needs to create

1. **A Supabase project:** a new organization or project, PG17 (the default), in a region close to the restaurant. Turn on Google sign-in under Authentication → Providers when we get there.
2. **A Render account** connected to the `chadhowell11/tip-tally-pro` GitHub repo.
3. **A Twilio account**, only when texting is needed in the new environment.

Then add the new project's URL, publishable key and service-role key as secrets in this cloud environment, so I can apply the schema and deploy without anything entering the repo.

## Applying the baseline to the hosted project

Direct Postgres connections (ports 5432 and 6543) are blocked from Claude's cloud sessions; only HTTPS gets out. So the schema goes in through the Supabase Management API, with `harness/db/remote-baseline.sh`:

| Command | What it does |
| --- | --- |
| `check` | Shows the project's name, region, status and Postgres version, and counts tables in `public` |
| `apply` | Applies `docs/handoff/schema.sql` in one transaction. Refuses if `public` already has tables. |
| `verify` | Compares the project's catalog with `harness/db/expected-catalog.json` |

All three commands also run against a local Postgres with `TTP_LOCAL_PG_PORT=<port>` (except `check`, which needs the API). Locally on `supabase/postgres:17.4.1.020`, `apply` of the snapshot followed by `verify` gives "catalog matches the production snapshot".

`expected-catalog.json` is the fingerprint (`harness/db/catalog-fingerprint.sql`) of the snapshot applied to local Supabase Postgres 17: 17 tables, 161 columns, 5 enums, 14 functions, 38 policies, 45 indexes, 13 triggers, 357 grants. A hosted project may differ from local in default grants. Investigate any diff; don't edit the expected file to match.

Session setup (done by Chad in the CH-HUB environment):
- **Network secret:** Bearer token, allowed website `api.supabase.com`, path prefix `/v1/projects/`, header `Authorization: Bearer <Supabase personal access token>`. The token is added to requests automatically and is never visible in the session.
- **Environment variable:** `SUPABASE_PROJECT_REF=<project ref>`

After the baseline is in: revoke the access token (supabase.com → Account → Access Tokens).

## Seeding the fixtures

`harness/db/remote-seed.sh` (SQL from `harness/db/seed-fixtures.ts`), same Management API path:

| Command | What it does |
| --- | --- |
| `seed <owner-email>` | One transaction: one test location "TEST: scrubbed fixtures (not real payroll)", its settings from `fixtures/inputs.json`, staff S01–S24 (named "Staff S01" …), the 210 shifts with all entries, members and overrides. Refuses if any location already exists or if the owner email isn't a user yet. |
| `check` | Reads the rows back in the shape of the payroll screen's select (`reports.tsx`), runs the engine exactly as that screen does, and compares with `fixtures/expected_v1.json`: every shift deep-equal, and period totals per staff to the cent. |
| `reset` | Deletes the test location and everything under it. |

- **Owner:** the seed attaches the location to an existing login, so create one first: Supabase dashboard → Authentication → Users → Add user (email + password, auto-confirm). Use a test address, not a staff member's.
- **Row ids** are derived from fixture keys, so the seed is reproducible and `check` maps database ids back to S01–S24.
- **Audit rows:** the audit triggers log the seed itself (the settings update and every inserted override) with no user attached. The seed deletes those rows in the same transaction, so the audit panel shows only real edits.
- **Tested locally** (PG17 + snapshot): `seed` then `check` gives 210 of 210 shifts and 240 of 240 period-total values matching, credit tips $66,220.83. Negative control: changing one server's credit tips by $0.01 makes `check` fail on that shift and on S09's period credit tips. `reset` leaves 0 rows. `npm test`: 212 of 212.

## Render

Set these on the existing Render web service (Settings). No `render.yaml`, so no second service gets created.

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Build command | `npm install -g bun@1.4.4 && bun install --frozen-lockfile && npm run build:render` |
| Start command | `npm start` |
| Health check path | `/auth` |

- **Why bun:** `bun.lock` matches `package.json`. `package-lock.json` is stale, so `npm ci` fails.
- **What the scripts do:** `build:render` builds with Nitro's `node-server` preset; Lovable's default is Cloudflare. `start` runs `node .output/server/index.mjs`, which listens on Render's `PORT`.
- **Tested:** a clean checkout ran the exact build and start commands, and `/` and `/auth` returned 200.

Environment variables on Render: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (both are built into the app, so set them before the first build), `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (secret), `NODE_VERSION=22`.

Deploy only after the baseline is applied. Until Google sign-in is rewired, use email and password sign-in.

## Handoff: next steps, in order

0. Chad confirms the project ref (see "Blocked" above).
1. `harness/db/remote-baseline.sh check`: confirm the ref, PG17, and 0 tables in `public`. Stop and report if any of that is wrong.
2. `harness/db/remote-baseline.sh apply`, then `verify`. Report any catalog diff before going further.
3. Chad adds a test login (Authentication → Users → Add user). Then `harness/db/remote-seed.sh seed <that email>` and `harness/db/remote-seed.sh check`. *(Script written and tested locally.)*
4. Tell Chad to deploy on Render, then smoke-test sign-in and the payroll screen.
5. Then replace the Lovable-only pieces, one PR each: Google sign-in (Supabase OAuth), Twilio direct, error reporting.
