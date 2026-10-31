# New environment: Supabase + Render

**Status (2026-10-31, evening):** Baseline applied and verified; fixtures seeded and checked; app live on Render (`https://tip-tally-pro.onrender.com`) with the smoke test passed; logo storage applied and verified. Chad revoked the access token and confirmed an uploaded logo shows on the payroll report and its print view. Next: the data migration waits for Chad's answers and written approval (`docs/DATA-MIGRATION-PLAN.md`). Scope and rules are in `CLAUDE.md` ("New environment rules").

## Hosted project baseline (done 2026-10-31)

- Chad confirmed `mmutdqklchnftziikqpq` is the new project. `SUPABASE_PROJECT_REF` holds the project URL; the scripts accept that form.
- `check`: name `Tip-Tally-Pro`, `us-east-1`, `ACTIVE_HEALTHY`, PostgreSQL 17.11, 0 tables in `public`.
- `apply`: `docs/handoff/schema.sql` applied in one transaction; 17 tables in `public`, including `tip_override_audit`.
- `verify`: "catalog matches the production snapshot". No differences, including grants.
- After apply: 0 users in `auth.users`, 0 locations.

## Hosted fixture seed (done 2026-10-31)

- Owner login: the one user Chad created (confirmed, app admin via `handle_new_user_admin`).
- `remote-seed.sh seed`: 1 location (owner membership), 24 staff, 210 shifts (2026-06-30 to 2026-10-30), 370 server entries, 202 bartender entries, 146 support rows. Audit tables: 0 rows.
- `remote-seed.sh check`: 210 of 210 shifts equal `expected_v1.json`; 240 of 240 period-total values match to the cent; credit tips $66,220.83, take-home $65,883.01.
- Fix found on the first run: the seed SQL was too large for a curl argument, so `mgmt-api.sh` now sends the request body from a file. Nothing was written by the failed attempt.

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

## Logo storage

The schema snapshot covers `public` only, so production's logo storage is added separately with `harness/db/remote-storage.sh`. It creates the private `logos` bucket (no MIME or size limit) and production's 8 storage policies, copied verbatim from `docs/handoff/DATABASE.md`. Without it, uploading a logo in Admin or Onboarding fails.

| Command | What it does |
| --- | --- |
| `apply` | Runs `harness/db/storage-logos.sql` in one transaction. Refuses if the bucket already exists. |
| `verify` | Compares the bucket and every `storage.objects` policy with `harness/db/expected-storage.json`. |

- **Tested locally** (PG17 + snapshot): `apply` then `verify` match; a second `apply` is refused. The local image lacks `storage.buckets.public`, so the local-only shim adds it.
- **Applied to the hosted project (2026-10-31):**
  - Re-checks first: `remote-baseline.sh check` gave `Tip-Tally-Pro`, `us-east-1`, `ACTIVE_HEALTHY`, PostgreSQL 17.11, 17 tables in `public`; `remote-baseline.sh verify` still "catalog matches the production snapshot"; `remote-seed.sh check` still 210 of 210 shifts, 240 of 240 period-total values, credit tips $66,220.83, take-home $65,883.01.
  - `verify` before `apply`: no buckets and no `storage.objects` policies (a clean project).
  - `apply`: succeeded. `verify`: "logo storage matches production", no differences. A second `apply` is refused ("storage bucket logos already exists"), and `remote-baseline.sh verify` still matches afterwards.
  - Checked in the app (Chad, 2026-10-31): a logo uploaded in Admin shows on the payroll report and its print view. The app stores the file at `<location id>/…` and shows it through a signed URL, so the bucket stays private as in production.

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

## Google sign-in (Supabase's own Google login)

**On hold (Chad, 2026-10-31): the Google button is hidden.** It shows only when Render has `VITE_ENABLE_GOOGLE_SIGNIN=true` at build time. Supabase's Google provider is not enabled. Email and password is the only sign-in.

The app now signs in with Google through Supabase (`supabase.auth.signInWithOAuth`) instead of Lovable's login service. `@lovable.dev/cloud-auth-js` and `src/integrations/lovable/` are gone. Google sends the browser back to `/auth`, which finishes sign-in and routes as before (`/admin` with a location, else `/onboarding`).

Setup (Chad, once):
1. **Google Cloud Console → APIs & Services → OAuth consent screen:** External, app name "Tip Share", your support email. While it is in "Testing", add the Google accounts that may sign in as test users, or publish it.
2. **Credentials → Create credentials → OAuth client ID → Web application.**
   - Authorized JavaScript origins: `https://tip-tally-pro.onrender.com`
   - Authorized redirect URIs: `https://mmutdqklchnftziikqpq.supabase.co/auth/v1/callback`
3. **Supabase → Authentication → Sign In / Providers → Google:** enable, paste the client ID and client secret, save.
4. **Supabase → Authentication → URL Configuration → Redirect URLs:** add `https://tip-tally-pro.onrender.com/auth`.

The setup needs no Render change; the code change deploys when the PR merges.

Behavior to know: a Google account with the same verified email as an existing user (e.g. `chadhowell11@gmail.com`) signs in as that same user and keeps its location. Any other Google account becomes a new user with no location and lands on onboarding.

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

Deploy only after the baseline is applied. Google sign-in works once the setup in "Google sign-in" is done.

## Handoff: next steps, in order

0. ~~Chad confirms the project ref.~~ Done.
1. ~~`harness/db/remote-baseline.sh check`: confirm the ref, PG17, and 0 tables in `public`. Stop and report if any of that is wrong.~~ Done.
2. ~~`harness/db/remote-baseline.sh apply`, then `verify`. Report any catalog diff before going further.~~ Done, no diff.
3. ~~Chad adds a test login (Authentication → Users → Add user). Then `harness/db/remote-seed.sh seed <that email>` and `harness/db/remote-seed.sh check`.~~ Done, all match.
4. ~~Tell Chad to deploy on Render, then smoke-test sign-in and the payroll screen.~~ Done, smoke test passed.
5. ~~Logo storage: `harness/db/remote-storage.sh apply`, then `verify`.~~ Done, matches production. Chad revoked the access token and confirmed the logo on the payroll report and print.
6. Production data migration: `docs/DATA-MIGRATION-PLAN.md` (draft, waiting for Chad's approval).
7. Then replace the Lovable-only pieces, one PR each: ~~Google sign-in (Supabase OAuth)~~ (done in code; setup in "Google sign-in"), Twilio direct, error reporting.
