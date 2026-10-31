# Pipeline variances: every screen compared with payroll

**Status:** Phase 1 characterization, for Chad's review. Nothing in this document has been changed in the app.
**Baseline:** payroll (`reports.tsx`), frozen as `harness/reference-pipeline-v1.ts` and locked by `fixtures/expected_v1.json`.
**Data:** the 210 real Carson's Table shifts (`fixtures/inputs.json`) plus 42 synthetic edge shifts (`fixtures/synthetic_v1.json`).
**Source of every number below:** `fixtures/characterization_v1.json`, regenerated with `npm run gen:characterization` and enforced by `npm run test:characterize`.

## How this was measured

Each consumer's math was transcribed line for line into `harness/consumers/`, because the route files can't load outside the browser. The one exception is SMS: `src/lib/shift-messages.ts` is pure, so the test runs the real module. Each copy is pinned to a sha256 of its source file, and the test fails if the source changes.

Each copy is fed the columns its own Supabase `select` actually returns. A column a screen doesn't select (`total_sales`, or `shift_support.role` for Trends and SMS) is missing from its input too. Its output is then compared with payroll for the same shift, per person and per field, to the cent. "Net" is the sum of signed differences. "Abs" is the sum of absolute differences.

## Summary

| # | Consumer | Confirmed? | Effect on Carson's 210 shifts | Example shift |
| --- | --- | --- | --- | --- |
| 1 | Daily totals (`daily.tsx` `totals()`, ShiftBlock header) | Yes, with corrections | 4 shifts, $0.01 each (split-share rounding). First-record-only: $0. | `2026-08-17-PM` |
| 2 | Daily person rows (`daily.tsx` `personRows`) | Yes | $0 (one record per date and period in the data) | n/a (scenario only) |
| 3 | Individual (`individual.tsx`) | Yes | Bartender cash omitted: **−$14,658.59** over 166 person-shifts. Hours **+32.0** over 6. Take-home: $0. | `2026-06-30-PM` |
| 4 | Trends (`trends.tsx`) | Yes, worse than described | Take-home moved between people: **$401 abs, +$1 net**, 35 person-shifts across 13 shifts | `2026-07-04-PM` |
| 5 | SMS (`shift-messages.ts` via `sms.functions.ts`) | Yes | Texted take-home wrong: **$297 abs, +$1 net**, 24 person-shifts across 9 shifts. 5 people got 2 texts for one shift. | `2026-07-17-PM` |
| 6 | Shift form, live (`shift.new.tsx`) | Yes | $0 on saved shifts. The unrounded split and blank cards change only on-screen numbers. | scenario `2026-10-30-PM` |
| 7 | All report queries: `total_sales` not selected | Yes | **$0 for every consumer** (tips basis, no `total_sales` values) | `SYN-rb-sales` (synthetic) |

Payroll itself, run through its real query shape, matches `expected_v1.json` period totals to the cent for all 24 staff.

---

## 1. Daily totals — `daily.tsx` `totals()` (357–388), Day Totals card, ShiftBlock header (564–573)

**What it does differently.** It sums cash, credit and LBW sales from the raw entries, not from per-person shares. It sums take-home from whole entries plus actual support payouts, not from member shares. "From servers" is the full server bar total whenever any bartender exists, not N × the rounded receipt. The Day Totals card uses only the first AM and first PM record returned (`shifts.find`).

**Carson's data.** Four shifts differ, each by one cent, all from split-entry share rounding:

| Shift | Field | Payroll (sum of shares) | Daily | Δ |
| --- | --- | --- | --- | --- |
| `2026-08-01-PM` | credit tips | 1,217.24 | 1,217.23 | −0.01 |
| `2026-08-17-PM` | credit tips | 1,115.47 | 1,115.46 | −0.01 |
| `2026-08-17-PM` | LBW sales | 621.01 | 621.00 | −0.01 |
| `2026-08-17-PM` | take-home | 1,115.01 | 1,115.00 | −0.01 |
| `2026-09-19-PM` | credit tips | 428.74 | 428.73 | −0.01 |

Cash, bar tip-out, support tip-out, support pool and "from servers" agree on all 210 shifts. Per-row tables in ShiftBlock (server, bartender and support rows) are identical to payroll on all 210.

**Correction to FINANCIAL_AUDIT.md.** The "raw entries vs shares" difference is real but worth only cents on this data. The larger gaps appear only where entries are paid to no one (synthetic):

| Synthetic shift | Field | Payroll | Daily | Why |
| --- | --- | --- | --- | --- |
| `SYN-single-null-staff` | take-home | 253 | 650 | Daily counts the take-home of entries with no recipient |
| `SYN-split-no-members` | take-home | 143 | 550 | Same, for split entries with no members |
| `SYN-three-bartenders` | from servers | 39.99 | 40.00 | Full total instead of 3 × round2(40/3) |
| `SYN-dup-support` | support pool | 47 | 56 | Sums all payouts; payroll's `find` repeats the first match |

**First AM/PM record only.** It costs $0 on the fixtures, which hold exactly one record per date and period. In the scenario where `2026-10-30-PM` is saved twice, the Day Totals card shows **$1,212** of take-home while the person sheets on the same page show **$2,424**.

## 2. Daily person rows — `daily.tsx` `personRows` (162–222)

**Confirmed identical to payroll** on all 106 fixture dates: $0 difference on every field. It loops over every returned record, while the Day Totals card uses only the first per period. That is the divergence shown in the scenario above.

## 3. Individual — `individual.tsx` `lines` (137–214)

**Bartender cash omitted.** Bartender shares never add `cash_owed`. Take-home and tip fields are unaffected; only the cash column is wrong.

| Staff | Payroll cash owed | Individual cash owed | Δ |
| --- | --- | --- | --- |
| S02 | 7,792.50 | 484.00 | −7,308.50 |
| S11 | 3,989.00 | 730.00 | −3,259.00 |
| S12 | 3,245.09 | 346.00 | −2,899.09 |
| S21 | 3,212.00 | 2,612.50 | −599.50 |
| S22 | 1,575.31 | 982.81 | −592.50 |
| **Total** | | | **−14,658.59** (166 person-shifts, 132 shifts) |

Example: `2026-06-30-PM`, S02 owed $265 cash; Individual shows $0.

**Hours counted differently.** Individual adds bartender member hours from hours-mode splits; payroll counts only support hours. That's +32.0 hours over 6 person-shifts, e.g. `2026-08-06-PM` S11 +6.5 h and S12 +5.5 h. Server split hours are ignored by both.

**Not money:** the support role label uses the person's current role, and "average" is take-home ÷ touched shifts. Take-home, credit tips, bar and support figures match payroll on all 210 shifts.

## 4. Trends — `trends.tsx` `series` (115–184)

**Confirmed, and worse than described.** Trends doesn't select `shift_support.role`. It casts the person's current primary role straight to a support role, without `resolveSupportRole`. Two effects:

1. A person who worked as a runner but whose primary role is hostess is weighted 0.5 instead of 1.0.
2. A person whose primary role is not a support role at all (e.g. a server who worked as a busser) falls through `calcSupportPool`'s `weightFor` to the **bar_back weight (0.5)**. Everywhere else they would resolve to the shift role, or to runner (1.0).

Only weighted pools with two or more support staff whose weights differ are affected. Shared pools and single-person pools are not.

| | |
| --- | --- |
| Person-shifts affected | 35, across 13 shifts |
| Take-home moved | $401 abs, **+$1 net** (rounding) |
| Monthly house totals vs payroll | Jul −$3 · Aug +$3 · Sep +$1 · Jun and Oct $0 |
| Per person, whole period | S19 +$107 · S18 +$83 · S20 +$11 · S23 −$9 · S04 −$56 · S05 −$135 |

Example `2026-07-04-PM`: the weighted pool has three people at 5 h each. S04 worked as busser, but their primary role is server. Payroll pays $18 / $18 / $18. Trends shows S04 $11, and S18 and S19 $21 each.

Week buckets mix local-time date math with UTC serialization. The test pins `TZ=UTC`, and the monthly view used above isn't affected.

## 5. SMS — `shift-messages.ts` `buildShiftMessages`, fed by `sms.functions.ts` `SHIFT_SELECT`

**Role omitted.** The builder calls `resolveSupportRole`, but `SHIFT_SELECT` doesn't fetch `shift_support.role`, so it always resolves from the current primary role. That's milder than Trends: a non-support primary role falls back to runner, not bar_back.

| | |
| --- | --- |
| Person-shifts texted a different take-home than payroll pays | 24, across 9 shifts |
| Amount | $297 abs, **+$1 net** |
| Per person, whole period | S19 +$62 · S18 +$57 · S04 +$19 · S20 +$11 · S05 −$148 |

Example `2026-07-17-PM`: S05 worked as a runner but their primary role is hostess. Payroll pays S05 $64 and S18 $64. The texts tell S05 **$43** and S18 **$85**.

**One message per share row.** On five person-shifts the person would get two texts instead of one: `2026-08-17-PM` S10, `2026-09-16-PM` S23, `2026-10-09-PM` S11, `2026-10-17-AM` S12, `2026-10-30-PM` S05. Combined, the two texts add up to the person's payroll take-home, apart from the role effect above. Whether texts were actually sent is unverified.

## 6. Shift form, live — `shift.new.tsx`

**On saved shifts (edit view), it agrees with payroll on every Carson shift:** entry take-home, member shares, bar "from servers", support pool, every support payout and the cash subtotal. $0 difference.

**Unrounded bar split.** The form divides the server bar total by the bartender count without `round2`. Carson's bar tip-outs are whole dollars and never more than two bartenders, so it never shows. In the synthetic shift `SYN-three-bartenders`, the form uses 13.333… where payroll uses 13.33. That's sub-cent on screen, but it feeds split shares and the take-home % label.

**Blank or unsaved cards count.** Every card on screen counts toward the division and the pool, even one with no person picked. Save then drops that card. Scenario: open `2026-10-30-PM` (one bartender) and add an empty bartender card. The real bartender's "From servers" drops from **$95.00 to $47.50**, and their live take-home from **$358 to $311**. Save writes one bartender, and payroll still pays $358. The money is right in payroll; the screen is wrong while entering.

**Latent ($0 on fixtures).** When a support row has no saved role, the form resolves it from `staff_positions`, not the primary role. Its staff list also loads active staff only. Every fixture support row has a saved role, so neither path changes a number today.

**Cash deposit.** It uses raw entry cash, and a PM shift adds the first saved AM record's raw cash. The current-shift subtotal equals payroll's allocated cash on all 210 shifts. The AM add-on is a separate query that wasn't characterized.

## 7. All report queries — `total_sales` not selected

Payroll, Daily, Individual, Trends and SMS all leave `total_sales` out of their nested selects, so `adjustInputs` sees $0. **Proven zero-impact on Carson's data.** Payroll run through its real select reproduces `expected_v1.json` exactly, and every consumer's `total_sales`-related difference on the golden data is $0. Carson's settings use `rb_basis = "tips"`, and no fixture row has `total_sales`.

Under `rb_basis = "sales"` it matters. Synthetic `SYN-rb-sales`: payroll's support pool is $281; every report screen and SMS computes **$0** pool and moves the cap room to the bar. Across the three affected synthetic shifts, payroll-as-queried shifts $607 of support tip-out. The shift form selects `*`, so it is the only screen that would get this right.

## Other facts surfaced (not in the brief's table)

- **Payroll grand totals, 2026-06-30 to 2026-10-30:** credit tips allocated $66,220.83, against $66,220.80 raw (+$0.03 split-share rounding). Take-home $65,883.01. Support tip-out collected $4,194 vs paid $3,856, so **$338 of support tip-out was paid to no one**. Of that, $318 is pool on shifts with no support staff, and $20 is whole-dollar rounding inside staffed pools. The 55 conservation-gap shifts in `expected_v1.json` net to −$337.79; 23 of them have no support staff. It's v1 behavior; nothing changed.
- With the cap, `rb_basis = "sales"` and zero credit tips, a server's tip-out is capped to $0 unless overrides are set. With overrides, take-home goes negative (`SYN-zero-tips-override`: −$60).
- Rounding `up` and `down` (unused by Carson) move each shift's allocation off the tips by several dollars (`SYN-round-up` +$2.63, `SYN-round-down` −$3.37), because each line rounds to whole dollars on its own.

## Phase 2 expectations (for approval)

When each consumer moves onto `computeShift`, its numbers should become payroll's. Expected changes on Carson's data, if approved:

| Consumer | Change on the 210 shifts |
| --- | --- |
| Daily totals | Four 1¢ moves (sum of member shares) |
| Daily person rows | None |
| Individual | Cash column gains $14,658.59 (bartender cash). Hours change by −32.0 if payroll's hours rule is adopted. |
| Trends | $401 of take-home moves between 6 people. Net +$1 → $0. |
| SMS | 24 texted amounts corrected ($297 abs). Per-person messages are a separate formatting decision. |
| Shift form | None on saved shifts. Live numbers stop counting blank cards. |
| `total_sales` select fix | None |

Each move will update `fixtures/characterization_v1.json` in its own commit, and that diff is the before/after record. **Chad's sign-off is needed per consumer before merging.**
