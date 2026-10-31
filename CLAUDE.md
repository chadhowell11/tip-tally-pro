# CLAUDE.md — Tip Tally Pro

Tip Tally Pro is a tip-share and payroll calculator for restaurants. It is in live use at Carson's Table: 210 shifts and about $66K in credit tips as of 2026-10-30.
Reports recompute every past shift from raw inputs, so **any change to calculation behavior silently rewrites past payroll**. Treat every line of money logic as production-critical.

## Current work
- Phases 1–2: the golden baseline and engine consolidation. The full brief is in `docs/PHASE1-2-BRIEF.md`; read it first.
- **New environment (opened by Chad, 2026-10-31):** stand up the system on a NEW Supabase project and Render, then migrate the system to that new database once it is ready. The Lovable app is frozen; Carson's Table keeps using it until go-live, so nothing here may touch it. See "New environment rules".
- Still out of scope until Chad opens them: schema changes, the save RPC, and payroll rule changes (Phase 3–4).

## New environment rules
- The new Supabase project and local Postgres are the ONLY databases the app or migrations may run against. Never connect to Lovable's production project.
- **Schema baseline (Chad's decision, 2026-10-31):** the new project is built from the production snapshot `docs/handoff/schema.sql` via `harness/db/remote-baseline.sh`, not by replaying `supabase/migrations/` (those stay as history). Changing the schema itself is Phase 3 work.
- Until the data migration, the new database holds only scrubbed fixture data (`fixtures/`), never production rows.
- The production data migration happens once the new environment is ready, as its own planned step: Chad approves the plan first, and the migrated data must reproduce the Lovable payroll CSV export for a recent pay period to the cent.
- Credentials for the new project live in the environment's secrets, never in the repo.

## Non-negotiables
1. Never change a calculation output without a fixture that fails first and passes after, plus Chad's written sign-off on the dollar impact. Never assume a business rule: a change to a Major finding (see `docs/MATH-FINDINGS.md`) also needs Kevin's recorded decision.
2. Never mix behavior-preserving and behavior-changing work in the same commit or PR.
3. Never edit `fixtures/expected_v1.json`. If parity fails, the code is wrong. An approved variance goes in `fixtures/approved_variances.json` with its dollar impact.
4. `harness/reference-pipeline-v1.ts` is a frozen copy of today's behavior. Never "fix" it.
5. No production data or secrets in the repo. Never create `.env` with production values. Run the app only against local Postgres or the new Supabase project (see New environment rules).
6. Work on branches and open PRs into `main`. Chad reviews and merges. No force-push to `main`.
7. Do not change the Supabase schema, RLS, migrations, or the save path in Phases 1–2. Applying the production snapshot unchanged to the new project is allowed.

## Math findings
Every calculation issue or discrepancy found, however small, gets an ID, a severity and a row in `docs/MATH-FINDINGS.md` in the same PR that finds it. Only Major findings (pay, cash or history wrong at scale) are escalated to Kevin; minor ones are tracked, not escalated.

## Commands
- `npm test` runs the golden parity test. It must report 212 of 212 passing before and after every change.
- `npm run lint`, `npm run build`

## Key facts
- The money logic lives in `src/lib/calculations.ts`. The report pipeline is duplicated in `routes/_authenticated/{reports,daily,individual,trends}.tsx`, `lib/shift-messages.ts`, and `routes/_authenticated/shift.new.tsx`.
- `roundCents` rounds to **whole dollars** in the nearest, up, and down modes. That is v1 behavior and must be preserved.
- Manual overrides are real payroll data: 361 support and 39 bar overrides out of 572 entries.
- 55 of 210 fixture shifts allocate a different total than the tips that came in. That is current behavior; do not fix it in Phases 1–2.
