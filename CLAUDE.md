# CLAUDE.md — Tip Tally Pro

Tip Tally Pro is a tip-share and payroll calculator for restaurants. It is in live use at Carson's Table: 210 shifts and about $66K in credit tips as of 2026-10-30.
Reports recompute every past shift from raw inputs, so **any change to calculation behavior silently rewrites past payroll**. Treat every line of money logic as production-critical.

## Current work
Phases 1–2 only: the golden baseline and engine consolidation. The full brief is in `docs/PHASE1-2-BRIEF.md`; read it first.
Phase 3 and later (schema, save RPC, rule changes, re-platforming) are out of scope until Chad opens them.

## Non-negotiables
1. Never change a calculation output without a fixture that fails first and passes after, plus Chad's written sign-off on the dollar impact. Never assume a business rule: a change to a Major finding (see `docs/MATH-FINDINGS.md`) also needs Kevin's recorded decision.
2. Never mix behavior-preserving and behavior-changing work in the same commit or PR.
3. Never edit `fixtures/expected_v1.json`. If parity fails, the code is wrong. An approved variance goes in `fixtures/approved_variances.json` with its dollar impact.
4. `harness/reference-pipeline-v1.ts` is a frozen copy of today's behavior. Never "fix" it.
5. No production data or secrets in the repo. Never create `.env` with production values. Local dev uses staging only, and no staging environment exists yet, so do not run the app against any database in Phases 1–2.
6. Work on branches and open PRs into `main`. Chad reviews and merges. No force-push to `main`.
7. Do not touch the Supabase schema, RLS, migrations, or the save path in Phases 1–2.

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
