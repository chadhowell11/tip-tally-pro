// CHARACTERIZATION COPY of the Individual report math in src/routes/_authenticated/individual.tsx
// (lines 137–214, total 216–230, avg 232). React removed; logic transcribed line for line. Never fix anything here.
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

export type Line = {
  key: string;
  date: string;
  period: "AM" | "PM";
  roles: string[];
  hours: number;
  cash_owed: number;
  credit_tips: number;
  bar_from_servers: number;
  lbw_sales: number;
  bar_tip_out: number;
  rb_tip_out: number;
  rb_received: number;
  takehome: number;
};
const emptyLine = (key: string, date: string, period: "AM" | "PM"): Line => ({
  key,
  date,
  period,
  roles: [],
  hours: 0,
  cash_owed: 0,
  credit_tips: 0,
  bar_from_servers: 0,
  lbw_sales: 0,
  bar_tip_out: 0,
  rb_tip_out: 0,
  rb_received: 0,
  takehome: 0,
});

export function individualLines(
  shifts: any[],
  settings: any,
  selected: string,
  staffById: Map<string, any>,
): Line[] {
  const out: Line[] = [];
  if (!settings || !selected) return out;
  for (const sh of shifts) {
    const line = emptyLine(sh.id, sh.shift_date, sh.period);
    let touched = false;
    for (const sv of sh.shift_servers) {
      const c = calcServer(sv, settings);
      const shares = splitServerShares(
        sv,
        { bar_tip: c.bar_tip, rb_tip: c.rb_tip, takehome: c.takehome },
        sv.split_mode ?? "single",
        sv.shift_server_members ?? [],
      );
      for (const share of shares) {
        if (share.staff_id !== selected) continue;
        line.cash_owed += share.cash_owed;
        line.credit_tips += share.credit_tips;
        line.lbw_sales += share.lbw_sales;
        line.bar_tip_out += share.bar_tip;
        line.rb_tip_out += share.rb_tip;
        line.takehome += share.takehome;
        line.roles.push("server");
        touched = true;
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
        if (share.staff_id !== selected) continue;
        line.credit_tips += share.credit_tips;
        line.bar_from_servers += share.bar_from_servers;
        line.rb_tip_out += share.rb_tip;
        line.takehome += share.takehome;
        if (share.hours_worked) line.hours += share.hours_worked;
        line.roles.push("bartender");
        touched = true;
      }
    }
    const mine = sh.shift_support.filter((sp: any) => sp.staff_id === selected);
    if (mine.length > 0) {
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
      for (const sp of mine) {
        const payout = payouts.find((p) => p.staff_id === sp.staff_id)?.payout ?? 0;
        line.hours += sp.hours_worked;
        line.rb_received += payout;
        line.takehome += payout;
        line.roles.push((staffById.get(sp.staff_id)?.role ?? "support").replace("_", " "));
        touched = true;
      }
    }
    if (touched) {
      line.roles = Array.from(new Set(line.roles));
      out.push(line);
    }
  }
  return out.sort((a, b) =>
    a.date === b.date ? a.period.localeCompare(b.period) : a.date.localeCompare(b.date),
  );
}

export function individualTotal(lines: Line[]) {
  const t = emptyLine("total", "", "AM");
  for (const l of lines) {
    t.hours += l.hours;
    t.cash_owed += l.cash_owed;
    t.credit_tips += l.credit_tips;
    t.bar_from_servers += l.bar_from_servers;
    t.lbw_sales += l.lbw_sales;
    t.bar_tip_out += l.bar_tip_out;
    t.rb_tip_out += l.rb_tip_out;
    t.rb_received += l.rb_received;
    t.takehome += l.takehome;
  }
  const avg = lines.length > 0 ? t.takehome / lines.length : 0;
  return { total: t, avg };
}
