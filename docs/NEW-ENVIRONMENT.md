# New environment: Supabase + Render

**Status (2026-10-31):** Supabase project and Render service created by Chad. Schema baseline decided: production snapshot. Node build for Render ready and tested. Next: apply the baseline to the hosted project (see "Handoff"). Scope and rules are in `CLAUDE.md` ("New environment rules").

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

`expected-catalog.json` is the fingerprint (`harness/db/catalog-fingerprint.sql`) of the snapshot applied to local Supabase Postgres 17: 17 tables, 161 columns, 5 enums, 14 functions, 38 policies, 45 indexes, 13 triggers, 357 grants. A hosted project may differ from local in default grants. Investigate any diff; don't edit the expected file to match.

Session setup (done by Chad in the CH-HUB environment):
- **Network secret:** Bearer token, allowed website `api.supabase.com`, path prefix `/v1/projects/`, header `Authorization: Bearer <Supabase personal access token>`. The token is added to requests automatically and is never visible in the session.
- **Environment variable:** `SUPABASE_PROJECT_REF=<project ref>`

After the baseline is in: revoke the access token (supabase.com → Account → Access Tokens).

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

1. `harness/db/remote-baseline.sh check`: confirm the ref, PG17, and 0 tables in `public`. Stop and report if any of that is wrong.
2. `harness/db/remote-baseline.sh apply`, then `verify`. Report any catalog diff before going further.
3. Write a seed script that loads ONLY the scrubbed fixtures (`fixtures/inputs.json`) into the new project through the same API: one test location, its settings, S01–S24 staff, the 210 shifts. No production rows. Then check that the payroll report's math on that data equals `fixtures/expected_v1.json`.
4. Tell Chad to deploy on Render, then smoke-test sign-in and the payroll screen.
5. Then replace the Lovable-only pieces, one PR each: Google sign-in (Supabase OAuth), Twilio direct, error reporting.
