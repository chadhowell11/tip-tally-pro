// CHARACTERIZATION COPY of the payroll report math in src/routes/_authenticated/reports.tsx
// (totalsByStaff 208–276, dayRowsByStaff 278–342, rows 344–349, grand 358–373, totalTips/takePct 66–73).
// React hooks removed; logic transcribed line for line. Never fix anything here — it records today's behavior.
// characterize.test.ts pins reports.tsx by sha256 so this copy cannot silently drift.
import {
  calcBartender,
  calcServer,
  calcSupportPool,
  poolFromShift,
  resolveSupportRole,
  round2,
  splitBartenderShares,
  splitServerShares,
} from "../../src/engine/calculations.ts";

type Totals = {
  shifts: number;
  hours: number;
  cash_owed: number;
  credit_tips: number;
  lbw_sales: number;
  bar_tip_out: number;
  rb_tip_out: number;
  rb_received: number;
  bar_from_servers: number;
  takehome: number;
};
export const empty = (): Totals => ({
  shifts: 0,
  hours: 0,
  cash_owed: 0,
  credit_tips: 0,
  lbw_sales: 0,
  bar_tip_out: 0,
  rb_tip_out: 0,
  rb_received: 0,
  bar_from_servers: 0,
  takehome: 0,
});
export const totalTips = (t: Totals) => t.credit_tips + t.bar_from_servers + t.rb_received;
export const takePct = (t: Totals) => {
  const tips = totalTips(t);
  return tips > 0 ? (t.takehome / tips) * 100 : null;
};

export function totalsByStaff(shifts: any[], settings: any, staffById: Map<string, any>) {
  const map = new Map<string, Totals>();
  if (!settings) return map;
  const bump = (id: string, patch: Partial<Totals>) => {
    const t = map.get(id) ?? empty();
    for (const k in patch) (t as any)[k] += (patch as any)[k] ?? 0;
    map.set(id, t);
  };
  for (const sh of shifts) {
    const shiftStaffSeen = new Set<string>();
    for (const sv of sh.shift_servers) {
      const c = calcServer(sv, settings);
      const shares = splitServerShares(
        sv,
        { bar_tip: c.bar_tip, rb_tip: c.rb_tip, takehome: c.takehome },
        sv.split_mode ?? "single",
        sv.shift_server_members ?? [],
      );
      for (const share of shares) {
        bump(share.staff_id, {
          cash_owed: share.cash_owed,
          credit_tips: share.credit_tips,
          lbw_sales: share.lbw_sales,
          bar_tip_out: share.bar_tip,
          rb_tip_out: share.rb_tip,
          takehome: share.takehome,
        });
        shiftStaffSeen.add(share.staff_id);
      }
    }
    const serverBarTotal = sh.shift_servers.reduce(
      (s: number, sv: any) => s + calcServer(sv, settings).bar_tip,
      0,
    );
    const bartenderCount = Math.max(sh.shift_bartenders.length, 1);
    for (const bt of sh.shift_bartenders) {
      const collected = round2(serverBarTotal / bartenderCount);
      const c = calcBartender(bt, collected, settings);
      const shares = splitBartenderShares(
        bt,
        { rb_tip: c.rb_tip, takehome: c.takehome, collected_from_servers: collected },
        bt.split_mode ?? "single",
        bt.shift_bartender_members ?? [],
      );
      for (const share of shares) {
        bump(share.staff_id, {
          cash_owed: share.cash_owed,
          credit_tips: share.credit_tips,
          bar_from_servers: share.bar_from_servers,
          rb_tip_out: share.rb_tip,
          takehome: share.takehome,
        });
        shiftStaffSeen.add(share.staff_id);
      }
    }
    const pool = poolFromShift(sh.shift_servers, sh.shift_bartenders, settings);
    const supportRows = sh.shift_support.map((sp: any) => ({
      staff_id: sp.staff_id,
      role: resolveSupportRole(sp.role, staffById.get(sp.staff_id)?.role),
      hours_worked: sp.hours_worked,
    }));
    const payouts = calcSupportPool(
      supportRows,
      pool,
      settings,
      sh.support_split_mode === "shared" ? "shared" : "weighted",
    );
    for (const sp of sh.shift_support) {
      const payout = payouts.find((p) => p.staff_id === sp.staff_id)?.payout ?? 0;
      bump(sp.staff_id, { hours: sp.hours_worked, rb_received: payout, takehome: payout });
      shiftStaffSeen.add(sp.staff_id);
    }
    for (const id of shiftStaffSeen) bump(id, { shifts: 1 });
  }
  return map;
}

export function dayRowsByStaff(shifts: any[], settings: any, staffById: Map<string, any>) {
  const out = new Map<string, { date: string; period: string; totals: Totals }[]>();
  if (!settings) return out;
  for (const sh of shifts) {
    const perStaff = new Map<string, Totals>();
    const bump = (id: string, patch: Partial<Totals>) => {
      const t = perStaff.get(id) ?? empty();
      for (const k in patch) (t as any)[k] += (patch as any)[k] ?? 0;
      perStaff.set(id, t);
    };
    for (const sv of sh.shift_servers) {
      const c = calcServer(sv, settings);
      const shares = splitServerShares(
        sv,
        { bar_tip: c.bar_tip, rb_tip: c.rb_tip, takehome: c.takehome },
        sv.split_mode ?? "single",
        sv.shift_server_members ?? [],
      );
      for (const share of shares) {
        bump(share.staff_id, {
          cash_owed: share.cash_owed,
          credit_tips: share.credit_tips,
          lbw_sales: share.lbw_sales,
          bar_tip_out: share.bar_tip,
          rb_tip_out: share.rb_tip,
          takehome: share.takehome,
        });
      }
    }
    const serverBarTotal = sh.shift_servers.reduce(
      (s: number, sv: any) => s + calcServer(sv, settings).bar_tip,
      0,
    );
    const bartenderCount = Math.max(sh.shift_bartenders.length, 1);
    for (const bt of sh.shift_bartenders) {
      const collected = round2(serverBarTotal / bartenderCount);
      const c = calcBartender(bt, collected, settings);
      const shares = splitBartenderShares(
        bt,
        { rb_tip: c.rb_tip, takehome: c.takehome, collected_from_servers: collected },
        bt.split_mode ?? "single",
        bt.shift_bartender_members ?? [],
      );
      for (const share of shares) {
        bump(share.staff_id, {
          cash_owed: share.cash_owed,
          credit_tips: share.credit_tips,
          bar_from_servers: share.bar_from_servers,
          rb_tip_out: share.rb_tip,
          takehome: share.takehome,
        });
      }
    }
    const pool = poolFromShift(sh.shift_servers, sh.shift_bartenders, settings);
    const supportRows = sh.shift_support.map((sp: any) => ({
      staff_id: sp.staff_id,
      role: resolveSupportRole(sp.role, staffById.get(sp.staff_id)?.role),
      hours_worked: sp.hours_worked,
    }));
    const payouts = calcSupportPool(
      supportRows,
      pool,
      settings,
      sh.support_split_mode === "shared" ? "shared" : "weighted",
    );
    for (const sp of sh.shift_support) {
      const payout = payouts.find((p) => p.staff_id === sp.staff_id)?.payout ?? 0;
      bump(sp.staff_id, { hours: sp.hours_worked, rb_received: payout, takehome: payout });
    }
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

/** rows (known staff only, sorted by name) and grand (sum of ALL rows). */
export function payrollRowsAndGrand(totals: Map<string, Totals>, staffById: Map<string, any>) {
  const rows = Array.from(totals.entries())
    .map(([id, t]) => ({ staff: staffById.get(id), totals: t }))
    .filter((r) => r.staff)
    .sort((a, b) => (a.staff!.name ?? "").localeCompare(b.staff!.name ?? ""));
  const grand = empty();
  for (const r of rows)
    for (const k of Object.keys(grand) as (keyof Totals)[]) grand[k] += r.totals[k];
  return { rows, grand };
}
