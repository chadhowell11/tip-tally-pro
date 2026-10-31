# Math findings register

Every calculation issue or discrepancy found in Tip Tally Pro, with its effect on Carson's Table data and Kevin's decision.

**Rule:** no fix for any item below is merged until Kevin's decision is recorded in this file, and Chad has signed off on the dollar impact (see CLAUDE.md). New findings get the next ID and a row here in the same PR that finds them.

**Data:** 210 real shifts, 2026-06-30 to 2026-10-30, from `fixtures/inputs.json` (staff pseudonymized S01–S24). Numbers come from `fixtures/characterization_v1.json` and `fixtures/expected_v1.json`. Detail per screen is in `docs/VARIANCES.md`.

**Kevin's summary doc:** "Tip Tally Pro — Math Findings for Kevin" (Claude Docs, shared by Chad).

Status values: `Awaiting Kevin` · `Approved` · `Change requested` · `Fixed` (with the PR that fixed it).

## F: screens that disagree with payroll

Proposed fix for all of them: the screen shows exactly what payroll (`reports.tsx`) pays. Phase 2, one screen per PR.

| ID | Where | What happens today | Effect on the 210 shifts | Example | Status | Decision / date |
| --- | --- | --- | --- | --- | --- | --- |
| F-01 | Individual (`individual.tsx`) | Bartender `cash_owed` is never added | −$14,658.59 cash across 166 person-shifts. Take-home is unaffected. | `2026-06-30-PM` S02: $265 → $0 | Awaiting Kevin | |
| F-02 | Individual | Adds bartender split hours; payroll counts support hours only | +32.0 h across 6 person-shifts | `2026-08-06-PM` S11 +6.5 h | Awaiting Kevin | |
| F-03 | Trends (`trends.tsx`) | Ignores `shift_support.role` and casts the primary role; a non-support primary role falls to the bar_back weight | $401 abs, +$1 net, 35 person-shifts across 13 shifts | `2026-07-04-PM`: $18/$18/$18 → $11/$21/$21 | Awaiting Kevin | |
| F-04 | SMS (`sms.functions.ts` select) | `shift_support.role` not selected, so it resolves from the primary role | $297 abs, +$1 net, 24 person-shifts across 9 shifts | `2026-07-17-PM` S05: $64 → texted $43 | Awaiting Kevin | |
| F-05 | SMS (`shift-messages.ts`) | One message per share row, not per person | 5 people get two texts for one shift | `2026-10-30-PM` S05 | Awaiting Kevin | |
| F-06 | Daily totals (`daily.tsx`) | Sums raw entries and whole-entry take-home instead of member shares; counts entries paid to no one | 4 shifts at 1¢ each | `2026-08-17-PM`: $1,115.00 vs $1,115.01 | Awaiting Kevin | |
| F-07 | Daily totals | Uses only the first AM and first PM record (`shifts.find`) | $0 (one record per date and period) | Scenario: $1,212 vs $2,424 | Awaiting Kevin | |
| F-08 | Shift form (`shift.new.tsx`) | Empty, unsaved cards count in the bar split and pool | On screen only; saved values correct | `2026-10-30-PM`: $358 shown as $311 with a blank card | Awaiting Kevin | |
| F-09 | Shift form | Bar collection per bartender not passed through `round2` | $0 (needs 3+ bartenders) | `SYN-three-bartenders`: 13.333… vs 13.33 | Awaiting Kevin | |
| F-10 | All report and SMS queries | `total_sales` not selected | $0 (tips basis, no `total_sales` values) | `SYN-rb-sales`: pool $281 → $0 | Awaiting Kevin | |

## P: payroll rules (Phase 4, business decisions)

These are v1 payroll behavior, locked by `fixtures/expected_v1.json`. Changing any of them changes what people are paid, so each needs Kevin's decision first.

| ID | Rule today | Effect on the 210 shifts | Example | Status | Decision / date |
| --- | --- | --- | --- | --- | --- |
| P-01 | Support tip-out is taken even when no support staff worked; nobody receives it | $318 across 18 shifts | `SYN-no-support` | Awaiting Kevin | |
| P-02 | `roundCents` rounds each line to whole dollars on its own, so a shift's payouts need not equal its tips | 55 of 210 shifts unbalanced, −$337.79 net in total; −$19.79 of that is rounding, the rest is P-01 | `SYN-round-up` +$2.63 | Awaiting Kevin | |
| P-03 | Take-home can be negative when overrides exceed card tips | 1 person-shift | `2026-10-06-PM` S03: $0 card tips, $11 + $5 overrides → −$16 | Awaiting Kevin | |
| P-04 | Overrides are applied after the cap, so they can exceed 30% | 5 server entries | `2026-07-08-PM` S03: $15 card tips, $12 tipped out | Awaiting Kevin | |
| P-05 | Every report recomputes past shifts with current settings; no settings history | Any settings change rewrites all past reports | n/a | Awaiting Kevin | |
| P-06 | Duplicate support staff ID on one shift: `payouts.find` repeats the first payout and drops the second | $0 (no duplicates) | `SYN-dup-support`: pool $56, $47 paid | Awaiting Kevin | |

## Log

| Date | Change |
| --- | --- |
| 2026-10-31 | Register created from Phase 1 characterization: F-01–F-10, P-01–P-06. Summary sent to Kevin for decisions. |
