// Payroll aggregation over engine results (what reports.tsx shows, prints and exports).
// Behavior-preserving move of reports.tsx totalsByStaff / dayRowsByStaff: same visit order,
// so period sums are bit-identical to the pre-engine code (harness/engine.test.ts checks this).
import type { Settings } from "./calculations.ts";
import { bumpInto, computeShift, forEachPersonPatch, type PersonTotals } from "./compute-shift.ts";
import { fromDbShift, type DbShiftRow } from "./db-shape.ts";

/** Whole-range totals per staff id. `shifts` counts person-shifts (one per staff id per shift record). */
export function payrollTotalsByStaff(
  shifts: DbShiftRow[],
  settings: Settings,
  staffRole: Map<string, string>,
) {
  const map = new Map<string, PersonTotals>();
  const bump = bumpInto(map);
  for (const sh of shifts) {
    const input = fromDbShift(sh);
    const result = computeShift(input, settings, { staffRole }, "v1");
    const seen = new Set<string>();
    forEachPersonPatch(input, result, (id, patch) => {
      bump(id, patch);
      seen.add(id);
    });
    for (const id of seen) bump(id, { shifts: 1 });
  }
  return map;
}

/** Per staff id, one line per shift record they appear on, sorted by date then period. */
export function payrollDayRowsByStaff<
  S extends DbShiftRow & { shift_date: string; period: string },
>(shifts: S[], settings: Settings, staffRole: Map<string, string>) {
  const out = new Map<string, { date: string; period: string; totals: PersonTotals }[]>();
  for (const sh of shifts) {
    const input = fromDbShift(sh);
    const result = computeShift(input, settings, { staffRole }, "v1");
    const perStaff = new Map<string, PersonTotals>();
    forEachPersonPatch(input, result, bumpInto(perStaff));
    for (const [id, t] of perStaff) {
      t.shifts = 1;
      (out.get(id) ?? out.set(id, []).get(id)!).push({
        date: sh.shift_date,
        period: sh.period,
        totals: t,
      });
    }
  }
  for (const list of out.values()) {
    list.sort((a, b) =>
      a.date === b.date ? a.period.localeCompare(b.period) : a.date.localeCompare(b.date),
    );
  }
  return out;
}
