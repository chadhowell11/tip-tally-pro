// Reference v1 pipeline: a 1:1 copy of the per-shift logic in src/routes/_authenticated/reports.tsx
// (totalsByStaff / dayRowsByStaff) as of 2026-10-31. It exists ONLY to prove parity.
// Do not "fix" anything in this file. Behavior changes belong in engine rules v2.
import * as C from "../src/lib/calculations.ts";

const F = ["shifts","hours","cash_owed","credit_tips","lbw_sales","bar_tip_out","rb_tip_out","rb_received","bar_from_servers","takehome"] as const;
const empty = () => Object.fromEntries(F.map((k) => [k, 0])) as Record<(typeof F)[number], number>;

export function computeShiftV1(sh: any, s: any, staffRole: Map<string, string>) {
  const entries: any = { servers: [], bartenders: [], support: null };
  const per = new Map<string, any>();
  const bump = (id: string, p: any) => { const t = per.get(id) ?? empty(); for (const k in p) t[k] += p[k] ?? 0; per.set(id, t); };
  for (const sv of sh.servers) {
    const c = C.calcServer(sv, s);
    const shares = C.splitServerShares(sv, { bar_tip: c.bar_tip, rb_tip: c.rb_tip, takehome: c.takehome }, sv.split_mode ?? "single", sv.members ?? []);
    entries.servers.push({ calc: c, shares });
    for (const x of shares) bump(x.staff_id, { cash_owed: x.cash_owed, credit_tips: x.credit_tips, lbw_sales: x.lbw_sales, bar_tip_out: x.bar_tip, rb_tip_out: x.rb_tip, takehome: x.takehome });
  }
  const serverBarTotal = sh.servers.reduce((a: number, sv: any) => a + C.calcServer(sv, s).bar_tip, 0);
  const cnt = Math.max(sh.bartenders.length, 1);
  for (const bt of sh.bartenders) {
    const col = C.round2(serverBarTotal / cnt);
    const c = C.calcBartender(bt, col, s);
    const shares = C.splitBartenderShares(bt, { rb_tip: c.rb_tip, takehome: c.takehome, collected_from_servers: col }, bt.split_mode ?? "single", bt.members ?? []);
    entries.bartenders.push({ collected: col, calc: c, shares });
    for (const x of shares) bump(x.staff_id, { cash_owed: x.cash_owed, credit_tips: x.credit_tips, bar_from_servers: x.bar_from_servers, rb_tip_out: x.rb_tip, takehome: x.takehome });
  }
  const pool = C.poolFromShift(sh.servers, sh.bartenders, s);
  const rows = sh.support.map((p: any) => ({ staff_id: p.staff_id, role: C.resolveSupportRole(p.role, staffRole.get(p.staff_id)), hours_worked: p.hours_worked }));
  const payouts = C.calcSupportPool(rows, pool, s, sh.support_split_mode === "shared" ? "shared" : "weighted");
  entries.support = { pool, payouts };
  for (const p of sh.support) { const v = payouts.find((x: any) => x.staff_id === p.staff_id)?.payout ?? 0; bump(p.staff_id, { hours: p.hours_worked, rb_received: v, takehome: v }); }
  for (const t of per.values()) t.shifts = 1;
  return { entries, per_person: Object.fromEntries([...per].sort()), server_bar_total: serverBarTotal };
}
