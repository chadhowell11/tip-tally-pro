# New environment: Supabase + Render

**Status (2026-10-31):** local migration test done; hosted Supabase project and Render service not yet created. Scope and rules are in `CLAUDE.md` ("New environment rules").

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

### Recommendation for the hosted project (Chad to choose)

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
