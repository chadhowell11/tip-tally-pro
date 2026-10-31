# Financial call-site audit

Evidence: current source inspected 2026-10-31; static findings, not authenticated runtime tests. Core formulas and full quoted implementations are in ARCHITECTURE.md section 7; worked outputs are in section 8 and CALCULATION_EXAMPLES.json.

## Shared report pipeline and order
1. Calculate each entire server cashout (`calcServer`), then split its result (`splitServerShares`). Calculation, cap and overrides happen BEFORE splitting.
2. Sum calculated server bar tip-outs B. N = number of bartender ENTRIES, not people. Each entry collects `round2(B / Math.max(N,1))` in payroll/daily/individual/trends/messages, then `calcBartender`, then `splitBartenderShares`. With no bartender entries there are no recipients. An entry containing three people gets the same initial collection as an individual entry, then splits internally.
3. `poolFromShift` sums entry support tip-outs; construct support rows; shared if saved mode exactly `shared`, otherwise weighted. Resolve valid shift support role before current primary staff role, except the defects below.
4. Accumulate already-rounded participant amounts; no final penny reconciliation. Many loops use `payouts.find(p=>p.staff_id===sp.staff_id)`; duplicate support IDs repeat the first match, rather than matching row identity.

## Payroll — src/routes/_authenticated/reports.tsx
`totalsByStaff` (208–276) adds server shares: cash_owed, credit_tips, lbw_sales, bar_tip_out, rb_tip_out, takehome. Bartender shares: cash_owed, credit_tips, bar_from_servers, rb_tip_out, takehome. Support: hours_worked, rb_received=payout, takehome=payout. A Set counts one person-shift per staff ID per underlying shift record (AM/PM separate), even with multiple roles. Only support hours accumulate; server/bartender split hours do not. Numeric patches use `(t as any)[k] += (patch as any)[k] ?? 0` with no total rounding.

`dayRowsByStaff` (278–342) duplicates the pipeline for individual sheets: one person/shift line, combines roles within shift, sorts date then period. It sets shifts=1. Unknown staff IDs are filtered out of payroll rows; inactive existing staff remain eligible because report staff load is not active-only. Roles shown derive from CURRENT primary role plus CURRENT staff_positions, not historical worked roles.

`totalTips(t) = t.credit_tips + t.bar_from_servers + t.rb_received`; `takePct(t) = totalTips(t)>0 ? t.takehome/totalTips(t)*100 : null` (66–73). Credit tips are original allocated tips, not adjusted for processing fees. Cash and sales excluded. Monetary/hour display two decimals, percentage one decimal; missing percentage em dash. Grand is sum of ALL known-person rows, not filtered visible rows. Grand percentage is ratio of grand sums, not average percentages. Its total-tip denominator counts internal bar/support transfers AGAIN and is not original house tips. Cash deposit is grand.cash_owed: allocated rounded known-staff cash, not raw entry cash. Grand shifts is person-shifts, not unique establishment shifts.

Date range is inclusive gte/lte shift_date. Default UTC today minus13 days through today. Request sequence discards older results. Shape/year validation does not establish calendar validity; invalid/reversed ranges do not dispatch a new query. Setup/record errors show retry. No historical settings snapshot: every date range is recomputed with CURRENT settings.

## Daily — src/routes/_authenticated/daily.tsx
`personRows` (162–222) uses the payroll per-person pipeline across all loaded shift records for the date; only support hours. Percentage denominator = credit_tips + from_servers + rb_received, positive-only, one decimal. Main AM/PM use FIRST `shifts.find(period)` (108–109), while personRows loops all results: multi-location/duplicate-record results can diverge.

`totals()` (357–388), for a shift:
- serverCash = sum Number(server.cash_owed ??0); barCash analog; cash=serverCash+barCash (RAW ENTRY amounts, no share rounding).
- credit = sum raw server + bartender credit tips; lbw = sum raw server LBW sales.
- barOut = sum calculated server bar_tip; rbOut = sum server+bartender calculated rb_tip.
- fromServers = full serverBarTotal if any bartender entry exists, else0 (not N × rounded receipt).
- supportPool = sum ACTUAL rounded support payouts, not nominal pool.
- takehome = sum WHOLE ENTRY server + bartender takehome + actual support payouts, not member-share sums.
Day fields = first-AM + first-PM fields. Net house cash = day.cash − day.takehome. Money two decimals and dollar signs. Person sheets may differ from day totals because member splits round independently. No Daily financial CSV found.

## Individual — src/routes/_authenticated/individual.tsx
`lines` (137–214) creates one line per underlying touched shift record for the selected staff. Multiple entries/roles sum into that line. Server cash is accumulated; BARTENDER CASH IS OMITTED. Server share hours are omitted; bartender share hours (truthy) and support hours are added. Support financial role resolves shift role but its label uses current staff role. Totals sum line fields. `avg = lines.length>0 ? total.takehome/lines.length :0`: per touched shift, NOT per day/hour. Same positive-only totalTips denominator as payroll. Missing settings/read errors do not have payroll-style retry handling.

## Trends — src/routes/_authenticated/trends.tsx
Window: today minus7×periods days for weeks; `setMonth(currentMonth-periods)` for months. Inclusive ISO-date query. Weeks keyed Monday; months by month. Only observed buckets, NO gap-filled empty periods; first/current periods may be partial. Previous means preceding OBSERVED bucket, not necessarily preceding calendar period. Map staff→bucket sums takehome; counts unique seen staff once per shift. Unknown staff omitted. Sort descending current takehome.
`cur = last observed bucket takehome ??0; prev = previous observed bucket takehome ??0; delta = round2(cur-prev); pct = prev>0 ? delta/prev*100 :null`. Display delta cents, percent zero decimals. House bucket = round2(sum known-person takehome), not tips/sales/deposits. Chart house/detail heights = value/max(1,values)×90; sparkline height = max(6,value/max(1,values)×100). Zero sparkline has minimum6% height. Negative main/detail heights not explicitly clamped. Mixed local-date manipulation and UTC ISO serialization: timezone effects UNVERIFIED.

## Shift form — src/routes/_authenticated/shift.new.tsx
`num(s)=Number(s)||0`; ordinary blank/NaN→0, negatives survive, Infinity survives. `optNum(s)=s.trim()===''?null:Number(s)`. Override editor rejects negative/nonfinite values, blank resets. Opening editor preloads automatic value fixed2. Effective overrides are subject to configured rounding but applied AFTER cap.
`serverRows`/`bartenderRows` map raw numeric fields; includes total_sales in persistence. Live bartender receipt = totalServerBar/bartenders.length WITHOUT round2, unlike reports. ALL UI entries affect that denominator/pool, even entries without recipients; save filters invalid recipients out. This can alter saved results. Server displayed takehome% denominator = raw credit_tips. Bartender denominator = raw credit_tips + UNROUNDED received bar collection; positive-only, one decimal.
HouseCashDeposit (1003–1007): currentSubtotal = raw current serverCash+bartenderCash; total=currentSubtotal+(period==='PM'?savedAmCash:0). PM adds AM raw cash; AM shows current only. Does not subtract cashouts. AM fetch scoped by location/date and first AM result; missing/error→0. Live support pool display = NOMINAL pool, not sum rounded payouts.

## Messages — src/lib/shift-messages.ts
`buildShiftMessages` emits ONE MESSAGE PER encountered server/bartender share/support ROW, not one aggregate per person per shift. Multi-role staff can receive multiple partial messages. Missing staff prevents a message. Same entry allocations as reports. Money fixed2; support hours fixed2; no percentage. Header establishment or Tip Share + date + period. Server fields: Credit tips; Cash owed to house; Bar tip-out; Support tip-out. Bartender: Credit tips; From servers; Cash owed to house; Support tip-out. Support: Hours; Tip pool share. Every message ends Take-home. Optional breakdown disabled only if false. Actual delivery UNVERIFIED.

## Input omissions causing current discrepancies
- `total_sales` is SAVED by form but OMITTED from nested select in payroll, daily, individual, trends, SMS. `adjustInputs` defaults missing total_sales→0. With rb_basis='sales', automated support tips in these reports/messages calculate from ZERO. Overrides may mask this. Confirmed static source defect, not a suggested change; no fix applied.
- Trends omits saved shift_support.role and weights using current primary role directly, unlike resolved role elsewhere. SMS also omits role even though message builder can resolve it. These can disagree with shift/payroll.
- Individual excludes bartender cash; hours differ across reports as above.
- Historical reports use current rates/weights/fees/rounding; no settings snapshot.
- Independent entry/member/support rounding does not conserve cash/tips and can recross an automatic cap after whole-dollar rounding; override flag remains the automatic cap flag.

## Other math
Admin PercentNumber (admin.tsx:526–529): display fraction `Math.round(val*1000)/10`; entered whole-percent raw→fraction `Math.round(raw*10)/1000` if finite, otherwise0. Rounds to0.1 percentage point. Non-percentage weight inputs raw numbers. Onboarding helper `(val*100).toFixed(1)`; onboarding tip inputs fractions unlike Settings percent inputs. Audit percentage format: multiply100, fixed2, trim zeroes; booleans On/Off; null dash; money fixed2 on screen, raw numbers in tips CSV.
Pay-period functions in location.ts: UTC day=86400000ms. Monthly first→last day; semimonthly1–15 or16→last. Weekly len7, other fallback len14. Anchor UTC midnight, or most recent Monday relative to supplied date. diff=floor((today-base)/DAY); index=floor(diff/len); start=base+index×len×DAY; end=start+(len−1)×DAY. Previous = range for day before current start. Biweekly missing anchor recomputes Monday for each date, so previous can overlap current; intended behavior UNVERIFIED.

## CSV exact contracts
Payroll headers (ordered):
```text
Date From,Date To,Name,Server #,Role,Shifts,Hours,Cash Owed,Credit Tips,Tips From Servers (Bar),LBW Sales,Bar Tip Out,R/B Tip Out,R/B Received,Take-Home,Total Tips,Take-Home %
```
Rows = ALL known staff, not visible print filter. Name and role escaped; server_number raw. Shifts integer, hours/money2 decimals, percentage1 decimal or blank (no $/% symbols). Final TOTAL row with grand sums and grand ratio. Filename `tip-share_${from}_to_${to}.csv`.
Individual headers:
```text
Name,Server #,Date,Period,Roles,Hours,Cash Owed,Credit Tips,Tips From Servers (Bar),LBW Sales,Bar Tip Out,R/B Tip Out,R/B Received,Take-Home,Total Tips,Take-Home %
```
One per touched shift; roles join ' / '; final Date `${from} to ${to}`, Period TOTAL; selected staff name, server number. Filename `tips_${person.name.replace(/\s+/g,'-')}_${from}_to_${to}.csv`. Name escaping; raw employee number. Both CSV use comma, LF, no explicit BOM; csvEsc quotes only values with double-quote/comma/LF and doubles quotes. Bare CR and spreadsheet formula injection not handled; downstream behavior UNVERIFIED.
Audit tip headers: `When,Shift date,Period,Type,Staff,Field,Action,Previous,New,Changed by`. Settings: `When,Setting,Previous,New,Changed by`. Every cell quoted/doubled; dates locale formatted; tip previous/new raw numeric String, null blank; settings formatted percentage/boolean text. Filename `audit-${tab}-${from}-to-${to}.csv`; no totals. Each dataset limited500 newest rows by CREATED_AT UTC date boundaries, not shift date; export may be truncated.
Download transport: Blob text/csv;charset=utf-8, appended hidden anchor, click, remove/revoke after2000ms (download.ts).

## Print flows
Current print.ts PRIMARY is printInPage, despite comments describing iframe. It mounts root using innerHTML, hides other direct body children in print media, sets title, synchronous window.print, cleanup500ms after afterprint or120seconds fallback. Popup fallback then ordinary window.print. printElement clones INNER HTML, not wrapper; style/ancestor context may differ. Iframe helper exists but is unused by exports. No PDF generator: browser print-to-PDF only.
Payroll individual sheets always mounted hidden wrapper; printSlips sends wrapper INNER HTML immediately. Payroll full report uses state effect + two requestAnimationFrames, then printElement, not synchronous click. Daily full and slips direct click helper; separate state-driven slips branch prints main innerHTML while slips wrapper remains hidden—whether any current control reaches this branch UNVERIFIED. Individual direct helper. Audit ordinary window.print. Print pagination/platform behavior, blank-page regression, dialog opening and physical printer success UNVERIFIED; no authenticated print capture available.
