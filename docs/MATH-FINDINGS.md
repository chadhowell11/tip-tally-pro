# Math findings register

Every calculation issue or discrepancy found in Tip Tally Pro, with its effect on Carson's Table data and Kevin's decision.

**Rule:** every finding gets an ID and a severity here, in the same PR that finds it. Chad signs off on the dollar impact of every fix. Only **Major** findings go to Kevin: bugs that rewrite or misstate pay, cash or history at scale. Minor items (cent-level rounding, behavior that may be an intentional manual override, $0-today edge cases) are tracked here and not escalated.

**Data:** 210 real shifts, 2026-06-30 to 2026-10-30, from `fixtures/inputs.json` (staff pseudonymized S01–S24). Numbers come from `fixtures/characterization_v1.json` and `fixtures/expected_v1.json`. Detail per screen is in `docs/VARIANCES.md`.

**Kevin's doc:** "Tip Tally Pro — Major Issues Found" (Claude Docs, shared by Chad). It lists the five Major items, numbered 1–5:

| Kevin's # | Register IDs | Issue | Needs Kevin's input? |
| --- | --- | --- | --- |
| 1 | P-05, P-07 | Changing a setting rewrites past payroll; it already happened once on Aug 18 | Yes |
| 2 | P-01 | Support tip-out taken with no one to receive it ($318) | Yes |
| 3 | F-04, F-03 | Texts and Trends split support by usual role ($297 texted wrong) | No; fix to match payroll |
| 4 | F-01 | Individual report omits bartender cash ($14,658.59) | No; fix to match payroll |
| 5 | F-10 | `total_sales` never loaded; sales basis would zero the pool | No; fix to match payroll |

## Chad's direction (2026-10-31, pending Kevin's sign-off)

Chad's direction for the Major items, sent to Kevin for review. It is not a decision until Kevin's sign-off is recorded in the "Decision / date" column of each row.

1. **Fix all five Major items** (Kevin's #1–5: P-05/P-07, P-01, F-04/F-03, F-01, F-10) once the new system is running.
2. **Forward only.** Past payroll is booked; no calculation change may alter past numbers. So P-05 (lock booked history, or version settings and math by date) comes first. Until it exists, every calculation change would still rewrite past reports and cannot ship.
3. **Tip-out goes only to staff who were on the shift** (P-01). The exact rule for a shift with no support staff (no tip-out taken, or another rule) is part of Kevin's sign-off.
4. **Every change is documented** with its dollar impact, a fixture that fails before and passes after, and Kevin's review and sign-off before it goes live (CLAUDE.md rule 1).

Status values: `Awaiting Kevin` · `To fix` · `Tracked` (minor, not escalated) · `Fixed` (with the PR that fixed it).

## F: screens that disagree with payroll

Proposed fix for all of them: the screen shows exactly what payroll (`reports.tsx`) pays. Phase 2, one screen per PR.

| ID | Severity | Where | What happens today | Effect on the 210 shifts | Example | Status | Decision / date |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F-01 | Major | Individual (`individual.tsx`) | Bartender `cash_owed` is never added | −$14,658.59 cash across 166 person-shifts. Take-home is unaffected. | `2026-06-30-PM` S02: $265 → $0 | To fix | |
| F-02 | Minor | Individual | Adds bartender split hours; payroll counts support hours only | +32.0 h across 6 person-shifts | `2026-08-06-PM` S11 +6.5 h | Tracked | |
| F-03 | Major | Trends (`trends.tsx`) | Ignores `shift_support.role` and casts the primary role; a non-support primary role falls to the bar_back weight | $401 abs, +$1 net, 35 person-shifts across 13 shifts | `2026-07-04-PM`: $18/$18/$18 → $11/$21/$21 | To fix | |
| F-04 | Major | SMS (`sms.functions.ts` select) | `shift_support.role` not selected, so it resolves from the primary role | $297 abs, +$1 net, 24 person-shifts across 9 shifts | `2026-07-17-PM` S05: $64 → texted $43 | To fix | |
| F-05 | Minor | SMS (`shift-messages.ts`) | One message per share row, not per person | 5 people get two texts for one shift | `2026-10-30-PM` S05 | Tracked | |
| F-06 | Minor | Daily totals (`daily.tsx`) | Sums raw entries and whole-entry take-home instead of member shares; counts entries paid to no one | 4 shifts at 1¢ each | `2026-08-17-PM`: $1,115.00 vs $1,115.01 | Tracked | |
| F-07 | Minor | Daily totals | Uses only the first AM and first PM record (`shifts.find`) | $0 (one record per date and period) | Scenario: $1,212 vs $2,424 | Tracked | |
| F-08 | Minor | Shift form (`shift.new.tsx`) | Empty, unsaved cards count in the bar split and pool | On screen only; saved values correct | `2026-10-30-PM`: $358 shown as $311 with a blank card | Tracked | |
| F-09 | Minor | Shift form | Bar collection per bartender not passed through `round2` | $0 (needs 3+ bartenders) | `SYN-three-bartenders`: 13.333… vs 13.33 | Tracked | |
| F-10 | Major | All report and SMS queries | `total_sales` not selected | $0 (tips basis, no `total_sales` values) | `SYN-rb-sales`: pool $281 → $0 | To fix | |

## P: payroll rules (Phase 4, business decisions)

These are v1 payroll behavior, locked by `fixtures/expected_v1.json`. Changing any of them changes what people are paid. Major ones need Kevin's decision; all need Chad's sign-off.

| ID | Severity | Rule today | Effect on the 210 shifts | Example | Status | Decision / date |
| --- | --- | --- | --- | --- | --- | --- |
| P-01 | Major | Support tip-out is taken even when no support staff worked; nobody receives it | $318 across 18 shifts | `SYN-no-support` | Awaiting Kevin | |
| P-02 | Minor | `roundCents` rounds each line to whole dollars on its own, so a shift's payouts need not equal its tips | 55 of 210 shifts unbalanced, −$337.79 net in total; −$19.79 of that is rounding, the rest is P-01 | `SYN-round-up` +$2.63 | Tracked | |
| P-03 | Minor | Take-home can be negative when overrides exceed card tips | 1 person-shift | `2026-10-06-PM` S03: $0 card tips, $11 + $5 overrides → −$16 | Tracked | |
| P-04 | Minor | Overrides are applied after the cap, so they can exceed 30% | 5 server entries | `2026-07-08-PM` S03: $15 card tips, $12 tipped out | Tracked | |
| P-05 | Major | Every report recomputes past shifts with current settings; no settings history | Any settings change rewrites all past reports | n/a | Awaiting Kevin | |
| P-06 | Minor | Duplicate support staff ID on one shift: `payouts.find` repeats the first payout and drops the second | $0 (no duplicates) | `SYN-dup-support`: pool $56, $47 paid | Tracked | |
| P-07 | Major | On 2026-08-18 migrations `20260818042409` + `20260818042505` added `shift_support.role` and backfilled every existing row from the person's first support position (else runner). Roles for shifts before that date were inferred, not recorded, and today's reports weight those shifts by the backfilled role | Estimated $252 of take-home moved among 4 people across 7 of the 83 pre-Aug-18 shifts, IF the pre-Aug-18 code weighted by primary role (that code is not in the export). Confirm with a pre-Aug-18 payroll export. | `2026-07-17-PM` S05: $64 today, $43 by primary role (same as F-04's texted amount) | Awaiting Kevin | |

## Log

| Date | Change |
| --- | --- |
| 2026-10-31 | Chad's direction recorded: fix all five Major items, forward only (P-05 first), tip-out only to staff on the shift, each change documented for Kevin's sign-off. Pending Kevin. |
| 2026-10-31 | P-07 added from the local migration test (Aug 18 role backfill rewrote pre-Aug-18 history). |
| 2026-10-31 | Severity added. Only Major items go to Kevin (Chad's direction); the five Major items are summarized in Kevin's doc. |
| 2026-10-31 | Register created from Phase 1 characterization: F-01–F-10, P-01–P-06. |
