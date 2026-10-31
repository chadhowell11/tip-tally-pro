// Builds the per-person tip-report text message for a shift.
// Pure module — safe to import from both the browser and server functions.

import {
  calcBartender,
  calcServer,
  calcSupportPool,
  poolFromShift,
  round2,
  splitBartenderShares,
  splitServerShares,
  type BartenderSplitMode,
  type Settings,
  type SupportRole,
  resolveSupportRole,
} from "@/lib/calculations";

export type MsgStaff = {
  id: string;
  name: string;
  server_number: string | null;
  phone: string | null;
  role: string;
};

export type MsgShift = {
  id: string;
  shift_date: string;
  period: "AM" | "PM";
  shift_servers: {
    staff_id: string | null;
    split_mode?: BartenderSplitMode | null;
    shift_server_members?: { staff_id: string; hours_worked: number }[];
    cash_owed: number;
    credit_tips: number;
    lbw_sales: number;
    bar_tip_override: number | null;
    rb_tip_override: number | null;
  }[];
  shift_bartenders: {
    staff_id: string | null;
    cash_owed: number;
    credit_tips: number;
    rb_tip_override: number | null;
    split_mode: BartenderSplitMode | null;
    shift_bartender_members: { staff_id: string; hours_worked: number }[];
  }[];
  support_split_mode?: string | null;
  shift_support: { staff_id: string; hours_worked: number; role?: string | null }[];
};

export type ShiftMessage = {
  staff_id: string;
  name: string;
  phone: string | null;
  body: string;
};

const money = (n: number) => `$${n.toFixed(2)}`;

/** Digits-only E.164 normalization for US-style 10/11-digit numbers. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) {
    const rest = trimmed.slice(1).replace(/\D/g, "");
    return rest.length >= 8 ? `+${rest}` : null;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function buildShiftMessages(
  shift: MsgShift,
  settings: Settings,
  staff: MsgStaff[],
  opts: { establishmentName?: string | null; includeBreakdown?: boolean } = {},
): ShiftMessage[] {
  const byId = new Map(staff.map((s) => [s.id, s]));
  const includeBreakdown = opts.includeBreakdown !== false;
  const header = `${opts.establishmentName || "Tip Share"} — ${shift.shift_date} ${shift.period}`;
  const out: ShiftMessage[] = [];

  const push = (staff_id: string, lines: string[], takehome: number) => {
    const s = byId.get(staff_id);
    if (!s) return;
    const body = includeBreakdown
      ? `${header}\n${s.name}\n${lines.join("\n")}\nTake-home: ${money(takehome)}`
      : `${header}\n${s.name}\nTake-home: ${money(takehome)}`;
    out.push({ staff_id, name: s.name, phone: normalizePhone(s.phone), body });
  };

  // Servers
  for (const sv of shift.shift_servers) {
    const c = calcServer(sv, settings);
    const shares = splitServerShares(
      sv,
      { bar_tip: c.bar_tip, rb_tip: c.rb_tip, takehome: c.takehome },
      sv.split_mode ?? "single",
      sv.shift_server_members ?? [],
    );
    for (const share of shares) {
      push(
        share.staff_id,
        [
          `Credit tips: ${money(share.credit_tips)}`,
          `Cash owed to house: ${money(share.cash_owed)}`,
          `Bar tip-out: -${money(share.bar_tip)}`,
          `Support tip-out: -${money(share.rb_tip)}`,
        ],
        share.takehome,
      );
    }
  }

  // Bartenders (single or shared cash-outs)
  const serverBarTotal = shift.shift_servers.reduce((s, sv) => s + calcServer(sv, settings).bar_tip, 0);
  const btCount = Math.max(shift.shift_bartenders.length, 1);
  for (const bt of shift.shift_bartenders) {
    const collected = round2(serverBarTotal / btCount);
    const c = calcBartender(bt, collected, settings);
    const shares = splitBartenderShares(
      bt,
      { rb_tip: c.rb_tip, takehome: c.takehome, collected_from_servers: collected },
      bt.split_mode ?? "single",
      bt.shift_bartender_members ?? [],
    );
    for (const sh of shares) {
      push(
        sh.staff_id,
        [
          `Credit tips: ${money(sh.credit_tips)}`,
          `From servers: ${money(sh.bar_from_servers)}`,
          `Cash owed to house: ${money(sh.cash_owed)}`,
          `Support tip-out: -${money(sh.rb_tip)}`,
        ],
        sh.takehome,
      );
    }
  }

  // Support pool
  const pool = poolFromShift(shift.shift_servers, shift.shift_bartenders, settings);
  const supportRows = shift.shift_support.map((sp) => ({
    staff_id: sp.staff_id,
    role: resolveSupportRole(sp.role, byId.get(sp.staff_id)?.role),
    hours_worked: sp.hours_worked,
  }));
  const payouts = calcSupportPool(supportRows, pool, settings, shift.support_split_mode === "shared" ? "shared" : "weighted");
  for (const sp of shift.shift_support) {
    const payout = payouts.find((p) => p.staff_id === sp.staff_id)?.payout ?? 0;
    push(sp.staff_id, [`Hours: ${sp.hours_worked.toFixed(2)}`, `Tip pool share: ${money(payout)}`], payout);
  }

  return out;
}
