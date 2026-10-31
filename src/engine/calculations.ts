// Tip share math — mirrors the source spreadsheet exactly.
// All inputs in dollars (numbers). Rounded to cents for display, full precision in math.

export type RoundingMode = "none" | "nearest" | "up" | "down";

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const roundCents = (n: number, mode: RoundingMode = "nearest") => {
  if (mode === "none") return Math.round(n * 100) / 100;
  if (mode === "up") return Math.ceil(n);
  if (mode === "down") return Math.floor(n);
  return Math.round(n);
};

const rm = (s: { rounding_mode?: RoundingMode }) => s.rounding_mode ?? "nearest";

export interface Settings {
  bar_tip_pct: number; // e.g. 0.05 (5% of LBW sales)
  runner_busser_tip_pct: number; // servers: e.g. 0.20 (20% of remaining tips)
  bartender_tip_pct: number; // bartenders: e.g. 0.10 (10% of credit tips)
  max_tipout_pct: number; // cap on total tip-out as fraction of credit tips, e.g. 0.30
  rb_basis?: "tips" | "sales"; // support tip-out taken from tips (default) or gross sales
  weight_runner: number;
  weight_busser: number;
  weight_bar_back: number;
  weight_hostess: number;
  rounding_mode?: RoundingMode; // how cents are rounded across payouts
  // Batch A toggles
  use_net_sales?: boolean; // if true, LBW sales entered are gross; strip tax before tip-out
  sales_tax_pct?: number; // e.g. 0.0875 (8.75%)
  cc_fee_enabled?: boolean; // if true, deduct processing fee from credit tips before calc
  cc_fee_pct?: number; // e.g. 0.03 (3%)
}

/** Apply net-sales + CC-fee toggles to raw inputs before tip-out math runs. */
function adjustInputs(lbw_sales: number, credit_tips: number, s: Settings, total_sales = 0) {
  const netSales = s.use_net_sales && (s.sales_tax_pct ?? 0) > 0
    ? lbw_sales / (1 + (s.sales_tax_pct ?? 0))
    : lbw_sales;
  const netTips = s.cc_fee_enabled && (s.cc_fee_pct ?? 0) > 0
    ? credit_tips * (1 - (s.cc_fee_pct ?? 0))
    : credit_tips;
  const netTotal = s.use_net_sales && (s.sales_tax_pct ?? 0) > 0
    ? total_sales / (1 + (s.sales_tax_pct ?? 0))
    : total_sales;
  return { lbw_sales: netSales, credit_tips: netTips, total_sales: netTotal };
}


export interface ServerRow {
  staff_id: string | null;
  cash_owed: number;
  credit_tips: number;
  lbw_sales: number;
  total_sales?: number;
  bar_tip_override?: number | null;
  rb_tip_override?: number | null;
}

export interface BartenderRow {
  staff_id: string | null;
  cash_owed: number;
  credit_tips: number;
  total_sales?: number;
  rb_tip_override?: number | null;
}

export type BartenderSplitMode = "single" | "equal" | "hours";
export interface BartenderMember {
  staff_id: string;
  hours_worked: number;
}



export type SupportRole = "runner" | "busser" | "bar_back" | "hostess";
export interface SupportRow {
  staff_id: string;
  role: SupportRole;
  hours_worked: number;
}

/** Apply max_tipout_pct cap: bar_tip + rb_tip cannot exceed cap × credit_tips.
 *  Support pool (runners/bussers/hostesses) is paid first; bar tip-out absorbs
 *  the cut so the support team never loses their share to the bar. */
function applyCap(bar_tip: number, rb_tip: number, credit_tips: number, cap: number) {
  const max = (cap > 0 ? cap : 1) * credit_tips;
  const total = bar_tip + rb_tip;
  if (total <= max) return { bar_tip, rb_tip, capped: false };
  // Pay R/B pool first, then bar gets whatever's left under the cap.
  const capped_rb = Math.min(rb_tip, max);
  const capped_bar = Math.max(0, max - capped_rb);
  return { bar_tip: round2(capped_bar), rb_tip: round2(capped_rb), capped: true };
}

export function calcServer(row: ServerRow, s: Settings) {
  const mode = rm(s);
  const adj = adjustInputs(row.lbw_sales, row.credit_tips, s, row.total_sales ?? 0);
  const rawBar = roundCents(adj.lbw_sales * s.bar_tip_pct, mode);
  const rbBase = s.rb_basis === "sales" ? adj.total_sales : Math.max(0, adj.credit_tips - rawBar);
  const rawRb = roundCents(rbBase * s.runner_busser_tip_pct, mode);
  const { bar_tip: capBar, rb_tip: capRb, capped } = applyCap(rawBar, rawRb, adj.credit_tips, s.max_tipout_pct);
  const bar_tip = row.bar_tip_override != null ? roundCents(row.bar_tip_override, mode) : roundCents(capBar, mode);
  const rb_tip = row.rb_tip_override != null ? roundCents(row.rb_tip_override, mode) : roundCents(capRb, mode);
  const takehome = roundCents(adj.credit_tips - bar_tip - rb_tip, mode);
  return { bar_tip, rb_tip, takehome, capped };
}

export function calcBartender(row: BartenderRow, serverBarTipsCollected: number, s: Settings) {
  const mode = rm(s);
  const adj = adjustInputs(0, row.credit_tips, s, row.total_sales ?? 0);
  const barBase = s.rb_basis === "sales" ? adj.total_sales : adj.credit_tips;
  const rawRb = roundCents(barBase * s.bartender_tip_pct, mode);
  const { rb_tip: capRb, capped } = applyCap(0, rawRb, adj.credit_tips, s.max_tipout_pct);
  const rb_tip = row.rb_tip_override != null ? roundCents(row.rb_tip_override, mode) : roundCents(capRb, mode);
  // Cash owed goes to the house, not the bartender.
  const takehome = roundCents(adj.credit_tips + serverBarTipsCollected - rb_tip, mode);
  return { rb_tip, takehome, collected_from_servers: serverBarTipsCollected, capped };
}

/** Split a bartender entry's payouts across one or more people.
 *  - "single": single bartender identified by entry.staff_id gets everything.
 *  - "equal": divide evenly across members.
 *  - "hours": weighted by hours_worked (falls back to equal if total hours = 0). */
export interface BartenderShare {
  staff_id: string;
  hours_worked: number;
  share: number;
  cash_owed: number;
  credit_tips: number;
  bar_from_servers: number;
  rb_tip: number;
  takehome: number;
}
export function splitBartenderShares(
  entry: { staff_id: string | null; cash_owed: number; credit_tips: number },
  entryCalc: { rb_tip: number; takehome: number; collected_from_servers: number },
  splitMode: BartenderSplitMode,
  members: BartenderMember[],
): BartenderShare[] {
  if (splitMode === "single" || members.length === 0) {
    if (!entry.staff_id) return [];
    return [{
      staff_id: entry.staff_id, hours_worked: 0, share: 1,
      cash_owed: round2(entry.cash_owed),
      credit_tips: round2(entry.credit_tips),
      bar_from_servers: round2(entryCalc.collected_from_servers),
      rb_tip: round2(entryCalc.rb_tip),
      takehome: round2(entryCalc.takehome),
    }];
  }
  const totalHours = members.reduce((s, m) => s + (m.hours_worked || 0), 0);
  const shares = members.map((m) => {
    if (splitMode === "hours" && totalHours > 0) return (m.hours_worked || 0) / totalHours;
    return 1 / members.length;
  });
  return members.map((m, i) => ({
    staff_id: m.staff_id,
    hours_worked: m.hours_worked || 0,
    share: shares[i],
    cash_owed: round2(entry.cash_owed * shares[i]),
    credit_tips: round2(entry.credit_tips * shares[i]),
    bar_from_servers: round2(entryCalc.collected_from_servers * shares[i]),
    rb_tip: round2(entryCalc.rb_tip * shares[i]),
    takehome: round2(entryCalc.takehome * shares[i]),
  }));
}

/** Split a server entry ("split party" cash-out) across one or more servers.
 *  Same modes as bartenders: single / equal / hours. */
export interface ServerShare {
  staff_id: string;
  hours_worked: number;
  share: number;
  cash_owed: number;
  credit_tips: number;
  lbw_sales: number;
  bar_tip: number;
  rb_tip: number;
  takehome: number;
}
export function splitServerShares(
  entry: { staff_id: string | null; cash_owed: number; credit_tips: number; lbw_sales: number },
  entryCalc: { bar_tip: number; rb_tip: number; takehome: number },
  splitMode: BartenderSplitMode,
  members: BartenderMember[],
): ServerShare[] {
  if (splitMode === "single" || members.length === 0) {
    if (!entry.staff_id) return [];
    return [{
      staff_id: entry.staff_id, hours_worked: 0, share: 1,
      cash_owed: round2(entry.cash_owed),
      credit_tips: round2(entry.credit_tips),
      lbw_sales: round2(entry.lbw_sales),
      bar_tip: round2(entryCalc.bar_tip),
      rb_tip: round2(entryCalc.rb_tip),
      takehome: round2(entryCalc.takehome),
    }];
  }
  const totalHours = members.reduce((s, m) => s + (m.hours_worked || 0), 0);
  const shares = members.map((m) => {
    if (splitMode === "hours" && totalHours > 0) return (m.hours_worked || 0) / totalHours;
    return 1 / members.length;
  });
  return members.map((m, i) => ({
    staff_id: m.staff_id,
    hours_worked: m.hours_worked || 0,
    share: shares[i],
    cash_owed: round2(entry.cash_owed * shares[i]),
    credit_tips: round2(entry.credit_tips * shares[i]),
    lbw_sales: round2(entry.lbw_sales * shares[i]),
    bar_tip: round2(entryCalc.bar_tip * shares[i]),
    rb_tip: round2(entryCalc.rb_tip * shares[i]),
    takehome: round2(entryCalc.takehome * shares[i]),
  }));
}





export type SupportSplitMode = "shared" | "weighted";

export function calcSupportPool(
  rows: SupportRow[],
  poolTotal: number,
  s: Settings,
  splitMode: SupportSplitMode = "weighted",
): { staff_id: string; payout: number }[] {
  const mode = rm(s);
  if (splitMode === "shared") {
    if (rows.length === 0) return [];
    return rows.map((r) => ({ staff_id: r.staff_id, payout: roundCents(poolTotal / rows.length, mode) }));
  }
  const weightFor = (r: SupportRole) =>
    r === "runner" ? s.weight_runner
    : r === "busser" ? s.weight_busser
    : r === "hostess" ? s.weight_hostess
    : s.weight_bar_back;
  const totalWeighted = rows.reduce((sum, r) => sum + weightFor(r.role) * r.hours_worked, 0);
  if (totalWeighted <= 0) return rows.map((r) => ({ staff_id: r.staff_id, payout: 0 }));
  return rows.map((r) => ({
    staff_id: r.staff_id,
    payout: roundCents((poolTotal * (weightFor(r.role) * r.hours_worked)) / totalWeighted, mode),
  }));
}


/** Total tip pool fed to runners/bussers/bar backs from a shift. */
export function poolFromShift(
  servers: ServerRow[],
  bartenders: BartenderRow[],
  s: Settings,
): number {
  const serverRB = servers.reduce((sum, r) => sum + calcServer(r, s).rb_tip, 0);
  const barRB = bartenders.reduce((sum, b) => sum + calcBartender(b, 0, s).rb_tip, 0);
  return round2(serverRB + barRB);
}

const SUPPORT_ROLE_SET = new Set<SupportRole>(["runner", "busser", "bar_back", "hostess"]);

/** Resolve the support position used for weighting.
 *  Prefers the position picked on the shift; falls back to the staff member's
 *  default role, and to "runner" when that isn't a support position. */
export function resolveSupportRole(
  shiftRole?: string | null,
  staffRole?: string | null,
): SupportRole {
  if (shiftRole && SUPPORT_ROLE_SET.has(shiftRole as SupportRole)) return shiftRole as SupportRole;
  if (staffRole && SUPPORT_ROLE_SET.has(staffRole as SupportRole)) return staffRole as SupportRole;
  return "runner";
}
