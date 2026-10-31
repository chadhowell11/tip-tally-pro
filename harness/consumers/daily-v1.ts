// CHARACTERIZATION COPY of the Daily report math in src/routes/_authenticated/daily.tsx
// (am/pm 108–109, personRows 162–222, totals() 357–388 and day 391–402, ShiftBlock 540–573 + rows 608–700).
// React removed; logic transcribed line for line. Never fix anything here.
import {
  calcBartender,
  calcServer,
  calcSupportPool,
  poolFromShift,
  resolveSupportRole,
  round2,
  splitBartenderShares,
  splitServerShares,
} from "../../src/lib/calculations.ts";

type PersonDay = {
  staff_id: string;
  hours: number;
  cash_owed: number;
  credit_tips: number;
  from_servers: number;
  rb_received: number;
  lbw_sales: number;
  bar_out: number;
  rb_out: number;
  takehome: number;
};
const blankPerson = (staff_id: string): PersonDay => ({
  staff_id,
  hours: 0,
  cash_owed: 0,
  credit_tips: 0,
  from_servers: 0,
  rb_received: 0,
  lbw_sales: 0,
  bar_out: 0,
  rb_out: 0,
  takehome: 0,
});

/** `shifts` = every record the date query returned (`.eq("shift_date", date).order("period")`). */
export function personRows(shifts: any[], settings: any, staffById: Map<string, any>): PersonDay[] {
  if (!settings) return [];
  const map = new Map<string, PersonDay>();
  const bump = (id: string, patch: Partial<PersonDay>) => {
    const cur = map.get(id) ?? blankPerson(id);
    for (const k in patch) {
      if (k === "staff_id") continue;
      (cur as any)[k] += (patch as any)[k] ?? 0;
    }
    map.set(id, cur);
  };
  for (const sh of shifts) {
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
          bar_out: share.bar_tip,
          rb_out: share.rb_tip,
          takehome: share.takehome,
        });
      }
    }
    const serverBarTotal = sh.shift_servers.reduce(
      (s: number, sv: any) => s + calcServer(sv, settings).bar_tip,
      0,
    );
    const btCount = Math.max(sh.shift_bartenders.length, 1);
    for (const bt of sh.shift_bartenders) {
      const collected = round2(serverBarTotal / btCount);
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
          from_servers: share.bar_from_servers,
          rb_out: share.rb_tip,
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
  }
  return Array.from(map.values()).sort((a, b) =>
    (staffById.get(a.staff_id)?.name ?? "").localeCompare(staffById.get(b.staff_id)?.name ?? ""),
  );
}

const ZERO = {
  serverCash: 0,
  barCash: 0,
  cash: 0,
  credit: 0,
  lbw: 0,
  takehome: 0,
  barOut: 0,
  rbOut: 0,
  supportPool: 0,
  fromServers: 0,
};

/** The Day Totals card's per-shift totals() closure. */
export function shiftTotals(sh: any | undefined, settings: any, staffById: Map<string, any>) {
  if (!sh) return { ...ZERO };
  const serverCash = sh.shift_servers.reduce(
    (s: number, x: any) => s + Number(x.cash_owed ?? 0),
    0,
  );
  const barCash = sh.shift_bartenders.reduce(
    (s: number, x: any) => s + Number(x.cash_owed ?? 0),
    0,
  );
  const credit =
    sh.shift_servers.reduce((s: number, x: any) => s + Number(x.credit_tips ?? 0), 0) +
    sh.shift_bartenders.reduce((s: number, x: any) => s + Number(x.credit_tips ?? 0), 0);
  const lbw = sh.shift_servers.reduce((s: number, x: any) => s + Number(x.lbw_sales ?? 0), 0);
  const serverCalcs = sh.shift_servers.map((sv: any) => calcServer(sv, settings));
  const serverBarTotal = serverCalcs.reduce((s: number, c: any) => s + c.bar_tip, 0);
  const barOut = serverBarTotal;
  const rbOutServer = serverCalcs.reduce((s: number, c: any) => s + c.rb_tip, 0);
  const btCount = Math.max(sh.shift_bartenders.length, 1);
  const bartenderCalcs = sh.shift_bartenders.map((bt: any) =>
    calcBartender(bt, round2(serverBarTotal / btCount), settings),
  );
  const rbOutBar = bartenderCalcs.reduce((s: number, c: any) => s + c.rb_tip, 0);
  const rbOut = rbOutServer + rbOutBar;
  const fromServers = sh.shift_bartenders.length > 0 ? serverBarTotal : 0;
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
  const supportPool = payouts.reduce((s, p) => s + p.payout, 0);
  const takehome =
    serverCalcs.reduce((s: number, c: any) => s + c.takehome, 0) +
    bartenderCalcs.reduce((s: number, c: any) => s + c.takehome, 0) +
    supportPool;
  return {
    serverCash,
    barCash,
    cash: serverCash + barCash,
    credit,
    lbw,
    takehome,
    barOut,
    rbOut,
    supportPool,
    fromServers,
  };
}

/** The whole Day Totals card: FIRST AM and FIRST PM record only. */
export function dayTotals(shifts: any[], settings: any, staffById: Map<string, any>) {
  const am = shifts.find((s) => s.period === "AM");
  const pm = shifts.find((s) => s.period === "PM");
  const a = shiftTotals(am, settings, staffById);
  const p = shiftTotals(pm, settings, staffById);
  const day: any = {};
  for (const k of Object.keys(ZERO)) day[k] = (a as any)[k] + (p as any)[k];
  return { am: am ? a : null, pm: pm ? p : null, day, netHouseCash: day.cash - day.takehome };
}

/** Values the per-shift ShiftBlock renders (header/stat totals plus each row). */
export function shiftBlock(shift: any, settings: any, staffById: Map<string, any>) {
  const serverBarTotal = shift.shift_servers.reduce(
    (s: number, sv: any) => s + calcServer(sv, settings).bar_tip,
    0,
  );
  const bartenderCount = Math.max(shift.shift_bartenders.length, 1);
  const pool = poolFromShift(shift.shift_servers, shift.shift_bartenders, settings);
  const supportRows = shift.shift_support.map((sp: any) => ({
    staff_id: sp.staff_id,
    role: resolveSupportRole(sp.role, staffById.get(sp.staff_id)?.role),
    hours_worked: sp.hours_worked,
  }));
  const payouts = calcSupportPool(
    supportRows,
    pool,
    settings,
    shift.support_split_mode === "shared" ? "shared" : "weighted",
  );
  const serverCash = shift.shift_servers.reduce(
    (s: number, x: any) => s + Number(x.cash_owed ?? 0),
    0,
  );
  const barCash = shift.shift_bartenders.reduce(
    (s: number, x: any) => s + Number(x.cash_owed ?? 0),
    0,
  );
  const totalCash = serverCash + barCash;
  const totalCredit =
    shift.shift_servers.reduce((s: number, x: any) => s + Number(x.credit_tips ?? 0), 0) +
    shift.shift_bartenders.reduce((s: number, x: any) => s + Number(x.credit_tips ?? 0), 0);
  const totalSales = shift.shift_servers.reduce(
    (s: number, x: any) => s + Number(x.lbw_sales ?? 0),
    0,
  );
  const totalTakehome =
    shift.shift_servers.reduce((s: number, sv: any) => s + calcServer(sv, settings).takehome, 0) +
    shift.shift_bartenders.reduce(
      (s: number, bt: any) =>
        s + calcBartender(bt, round2(serverBarTotal / bartenderCount), settings).takehome,
      0,
    ) +
    payouts.reduce((s, p) => s + p.payout, 0);
  const serverRows = shift.shift_servers.flatMap((sv: any) => {
    const c = calcServer(sv, settings);
    return splitServerShares(
      sv,
      { bar_tip: c.bar_tip, rb_tip: c.rb_tip, takehome: c.takehome },
      sv.split_mode ?? "single",
      sv.shift_server_members ?? [],
    );
  });
  const bartenderRows = shift.shift_bartenders.flatMap((bt: any) => {
    const collected = round2(serverBarTotal / bartenderCount);
    const c = calcBartender(bt, collected, settings);
    return splitBartenderShares(
      bt,
      { rb_tip: c.rb_tip, takehome: c.takehome, collected_from_servers: collected },
      bt.split_mode ?? "single",
      bt.shift_bartender_members ?? [],
    );
  });
  const supportLines = shift.shift_support.map((sp: any) => ({
    staff_id: sp.staff_id,
    role_label: (staffById.get(sp.staff_id)?.role ?? "").replace("_", " "),
    hours: sp.hours_worked,
    payout: payouts.find((p) => p.staff_id === sp.staff_id)?.payout ?? 0,
  }));
  return {
    pool,
    serverCash,
    barCash,
    totalCash,
    totalCredit,
    totalSales,
    totalTakehome,
    serverRows,
    bartenderRows,
    supportLines,
  };
}
