# Tip Tally Pro — Phase 1–2 Brief: Golden Baseline and Engine Consolidation

**Owner:** Chad Howell · **Prepared:** 2026-10-31 · **Repo:** the Lovable-synced GitHub repo (tip-tally-pro)

## Context

Tip Tally Pro is a tip-share and payroll calculator built in Lovable (TanStack Start, React 19, Supabase). It is in live use at Carson's Table: 210 shifts from 2026-06-30 to 2026-10-30, and $66,220.80 in credit tips. Reports recompute every historical shift from raw inputs. **Any change to calculation behavior silently rewrites past payroll.**

These two phases make the math safe to work on. **They change no financial behavior.** Rule changes (integer cents, conservation, the no-support-staff rule) are Phase 4. Phase 4 is blocked until the owner answers the open business-rule questions; do not start it.

## Non-negotiables (put these in CLAUDE.md)

1. Never change a calculation output without a fixture that fails first and passes after, plus Chad's written sign-off on the dollar impact.
2. Behavior-preserving commits and behavior-changing commits are never mixed.
3. Do not edit `fixtures/expected_v1.json`. If parity fails, the code is wrong, not the fixture. The one exception is a variance Chad has approved, which goes in `fixtures/approved_variances.json` with the dollar impact.
4. `harness/reference-pipeline-v1.ts` is a frozen copy of today's behavior. Never "fix" it.
5. No production data in the repo beyond the scrubbed fixtures supplied. No names, emails, phones, or real staff UUIDs.
6. The repo syncs back to Lovable: no force-push, rebase, or amend of pushed commits on the connected branch, and keep the branch deployable.
7. Do not touch the Supabase schema, RLS, or the save path in these phases. That work is Phase 3.

## What's in this package

| Path | Purpose |
| --- | --- |
| `fixtures/inputs.json` | All 210 shifts with full inputs, Carson's live settings, and the staff role map. Staff are pseudonymized as S01–S24. |
| `fixtures/expected_v1.json` | Per shift: every entry's calc, split shares, support pool and payouts, per-person totals, a conservation observation, and whole-period totals by staff. |
| `fixtures/lovable_examples.json` | Lovable's 19 worked examples; 17 are directly executable. |
| `harness/reference-pipeline-v1.ts` | A 1:1 copy of the per-shift pipeline in `reports.tsx`. |
| `harness/golden.test.ts` | Parity test: 212 assertions, all passing against the current code. |

Run it from the repo root after copying `fixtures/` and `harness/` in:

```bash
node --experimental-strip-types --test harness/golden.test.ts
```

(Node 22 or later. You may move this to Vitest; keep the assertions identical.)

## Phase 1 — Golden baseline

1. Commit `fixtures/` and `harness/`. Wire `golden.test.ts` into `npm test` and run it in CI if CI exists. **Gate: 212 of 212 pass on unchanged code.**
2. **Add synthetic edge fixtures** (`fixtures/synthetic_v1.json`) for paths the real data does not exercise. Generate the expected values by running the CURRENT code, never by hand calculation:
   - each `rounding_mode`: `none`, `up`, `down` (production uses only `nearest`)
   - `use_net_sales` with a tax rate; `cc_fee_enabled` with a fee rate
   - `rb_basis = "sales"`, with and without `total_sales`
   - the cap binding without overrides (only 1 real shift covers it today), and overrides that exceed the cap
   - zero credit tips with positive sales, which produces a negative take-home
   - hostess and bar_back support roles, and weighted pools where all hours are zero (no production rows exist)
   - split entries: equal and hours modes, hours mode with zero total hours, and uneven cents
   - a shift with servers and no support staff (support tip-out paid to no one)
   - a shift with servers and no bartenders (bar tip-out paid to no one)
   - duplicate staff IDs in support rows (`payouts.find` takes the first match)
3. **Characterize every other copy of the pipeline.** For each consumer, write a test that captures its current output on the same inputs and record every place it differs from `reports.tsx`. Known differences, from Lovable's FINANCIAL_AUDIT.md (confirm them; don't assume):

| Consumer | Location | Known difference from payroll |
| --- | --- | --- |
| Daily totals | `daily.tsx` `totals()` ~357–388 | Cash and credit from raw entries; take-home from whole-entry amounts, not member shares; uses only the first AM/PM shift found |
| Daily person rows | `daily.tsx` ~162–222 | Same as payroll, but can diverge when the query returns more than one record |
| Individual | `individual.tsx` ~137–214 | Omits bartender cash; hours counted differently |
| Trends | `trends.tsx` | Ignores the saved `shift_support.role` and weights by the staff member's current role |
| SMS | `shift-messages.ts` | Omits the support role; one message per share row, not per person |
| Shift form (live) | `shift.new.tsx` | Divides the bar pool unrounded by all UI entries, including entries with no recipient |
| All report queries | payroll, daily, individual, trends, SMS | `total_sales` is not selected, so `rb_basis="sales"` computes from $0 |

**Gate:** a characterization test exists for each row above, and `docs/VARIANCES.md` lists each difference with an example shift key and its dollar effect on the fixture data.

## Phase 2 — One engine, still v1

1. Create `src/engine/`: pure TypeScript with no React, Supabase, or DOM imports. It exports one entry point:

   ```ts
   computeShift(input: ShiftInput, settings: Settings, ctx: { staffRole: Map<string,string> }, rules: "v1"): ShiftResult
   ```

   `ShiftResult` carries the entry calcs, shares, support pool, payouts, and per-person totals, in exactly the shape of `expected_v1.json` → `shifts[].expected`. Move `calculations.ts` inside it unchanged; keep a re-export at the old path until callers have moved.
2. Point `golden.test.ts` at `computeShift(..., "v1")`. **Gate: 212 of 212 plus all synthetic fixtures pass.**
3. Move each consumer onto `computeShift`, one per commit: payroll first, then daily, individual, trends, SMS, and the live shift form. Each consumer then only formats and sums engine output.
4. Moving a consumer will change its numbers wherever it differed in Phase 1. **Stop at each one.** Write the before and after, with dollar impact on the fixture data, into `docs/VARIANCES.md`, and get Chad's approval before merging. The expected outcome is that every screen agrees with payroll.
5. Add a guard test that fails if any file outside `src/engine/` imports `round2`, `roundCents`, or the calc functions.
6. Fix the `total_sales` select omission in every report query. On Carson's data this is zero-impact (tips basis, no `total_sales` rows), but prove that with the fixtures.

**Gate:** every screen, CSV, print, and SMS path goes through the engine; golden and synthetic fixtures pass; `docs/VARIANCES.md` is approved by Chad; and the app is manually smoke-tested on one recent pay period, with payroll totals matching the pre-change CSV export.

## Out of scope (do not do)

- Changing rounding, cap, conservation, or pool rules (Phase 4, after owner decisions)
- Schema, RLS, constraints, the transactional save RPC, audit changes, settings snapshots (Phase 3)
- Leaving Lovable: auth, the Twilio gateway, hosting (Phase 5)
- UI redesign or new features

## Facts the session should know

- Live settings: bar 10% of LBW sales; support 10% of (credit tips − bar); bartender 10%; cap 30%; tips basis; `nearest` rounding; net-sales and card-fee adjustments off; weights runner 1.0, busser 1.0, bar back 0.5, hostess 0.5.
- `roundCents` in `nearest`, `up`, and `down` modes rounds to **whole dollars**. The name is misleading, and that behavior is v1 and must be preserved.
- Overrides are heavily used: 361 support overrides and 39 bar overrides, out of 572 entries. They are real payroll data.
- The fixtures intentionally contain 55 shifts where allocated take-home ≠ tips in. That is current behavior. Do not "fix" it in Phases 1–2.
