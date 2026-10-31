// CHARACTERIZATION COPY of the live calculations in src/routes/_authenticated/shift.new.tsx
// (edit-load hydration 355–399, staff positions 166–169, num/optNum + serverRows/bartenderRows 185–210,
//  pool/supportRows/supportPayouts 214–221, server cards 680–797, bartender cards 810–925,
//  support payouts 963, House Cash Deposit 1003–1007, save filters 485 / 509 / 538).
// React state removed; logic transcribed line for line. Never fix anything here.
import {
  calcBartender,
  calcServer,
  calcSupportPool,
  poolFromShift,
  splitBartenderShares,
  splitServerShares,
  type SupportRole,
} from "../../src/engine/calculations.ts";

const SUPPORT_ROLES: SupportRole[] = ["runner", "busser", "bar_back", "hostess"];

export type FormState = {
  period: "AM" | "PM";
  supportSplit: "shared" | "weighted";
  servers: {
    staff_id: string;
    cash_owed: string;
    credit_tips: string;
    lbw_sales: string;
    total_sales: string;
    bar_tip_override: string;
    rb_tip_override: string;
    split_mode: any;
    members: { staff_id: string; hours_worked: string }[];
  }[];
  bartenders: {
    staff_id: string;
    cash_owed: string;
    credit_tips: string;
    total_sales: string;
    rb_tip_override: string;
    split_mode: any;
    members: { staff_id: string; hours_worked: string }[];
  }[];
  support: { staff_id: string; role: string; hours_worked: string }[];
};

/** Edit-load: turns the `select(*)` result into form strings. */
export function hydrate(data: any): FormState {
  const str = (v: number | null | undefined) => (v == null ? "" : String(v));
  return {
    period: data.period,
    supportSplit: data.support_split_mode ?? "weighted",
    servers: (data.shift_servers ?? []).map((r: any) => ({
      staff_id: r.staff_id ?? "",
      cash_owed: str(r.cash_owed),
      credit_tips: str(r.credit_tips),
      lbw_sales: str(r.lbw_sales),
      total_sales: str(r.total_sales),
      bar_tip_override: str(r.bar_tip_override),
      rb_tip_override: str(r.rb_tip_override),
      split_mode: r.split_mode ?? "single",
      members: (r.shift_server_members ?? []).map((m: any) => ({
        staff_id: m.staff_id,
        hours_worked: str(m.hours_worked),
      })),
    })),
    bartenders: (data.shift_bartenders ?? []).map((r: any) => ({
      staff_id: r.staff_id ?? "",
      cash_owed: str(r.cash_owed),
      credit_tips: str(r.credit_tips),
      total_sales: str(r.total_sales),
      rb_tip_override: str(r.rb_tip_override),
      split_mode: r.split_mode ?? "single",
      members: (r.shift_bartender_members ?? []).map((m: any) => ({
        staff_id: m.staff_id,
        hours_worked: str(m.hours_worked),
      })),
    })),
    support: (data.shift_support ?? []).map((r: any) => ({
      staff_id: r.staff_id,
      role: r.role ?? "",
      hours_worked: str(r.hours_worked),
    })),
  };
}

/** Form staff list: ACTIVE staff only; positions fall back to [role] when no staff_positions rows. */
export function formStaff(
  rows: { id: string; role: string; active?: boolean; positions?: string[] }[],
) {
  return rows
    .filter((r) => r.active !== false)
    .map((r) => ({
      id: r.id,
      role: r.role,
      positions: r.positions?.length ? r.positions : [r.role],
    }));
}

/** Everything the form shows live, plus what save() would write. `amCash` = saved AM cash (PM only). */
export function liveValues(
  f: FormState,
  settings: any,
  staff: ReturnType<typeof formStaff>,
  amCash = 0,
) {
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const num = (s: string) => Number(s) || 0;
  const optNum = (s: string) => (s.trim() === "" ? null : Number(s));
  const serverRows = f.servers.map((s) => ({
    staff_id: s.staff_id,
    cash_owed: num(s.cash_owed),
    credit_tips: num(s.credit_tips),
    lbw_sales: num(s.lbw_sales),
    total_sales: num(s.total_sales),
    bar_tip_override: optNum(s.bar_tip_override),
    rb_tip_override: optNum(s.rb_tip_override),
    split_mode: s.split_mode,
    members: s.members
      .filter((m) => m.staff_id)
      .map((m) => ({ staff_id: m.staff_id, hours_worked: num(m.hours_worked) })),
  }));
  const bartenderRows = f.bartenders.map((b) => ({
    staff_id: b.split_mode === "single" ? b.staff_id : null,
    cash_owed: num(b.cash_owed),
    credit_tips: num(b.credit_tips),
    total_sales: num(b.total_sales),
    rb_tip_override: optNum(b.rb_tip_override),
    split_mode: b.split_mode,
    members: b.members
      .filter((m) => m.staff_id)
      .map((m) => ({ staff_id: m.staff_id, hours_worked: num(m.hours_worked) })),
  }));
  const pool = poolFromShift(serverRows as any, bartenderRows as any, settings);
  const supportRows = f.support.map((sp) => ({
    staff_id: sp.staff_id,
    role: (sp.role ||
      (staffById
        .get(sp.staff_id)
        ?.positions.find((p) => SUPPORT_ROLES.includes(p as SupportRole)) ??
        "runner")) as SupportRole,
    hours_worked: num(sp.hours_worked),
  }));
  const supportPayouts = calcSupportPool(supportRows, pool, settings, f.supportSplit);

  const serverCards = f.servers.map((row) => {
    const shared = row.split_mode !== "single";
    const raw = {
      staff_id: row.staff_id,
      cash_owed: num(row.cash_owed),
      credit_tips: num(row.credit_tips),
      lbw_sales: num(row.lbw_sales),
      total_sales: num(row.total_sales),
    };
    const auto = calcServer(raw as any, settings);
    const calc = calcServer(
      {
        ...raw,
        bar_tip_override: optNum(row.bar_tip_override),
        rb_tip_override: optNum(row.rb_tip_override),
      } as any,
      settings,
    );
    const memberInputs = row.members
      .filter((m) => m.staff_id)
      .map((m) => ({ staff_id: m.staff_id, hours_worked: num(m.hours_worked) }));
    const shares = shared
      ? splitServerShares(
          {
            staff_id: null,
            cash_owed: raw.cash_owed,
            credit_tips: raw.credit_tips,
            lbw_sales: raw.lbw_sales,
          },
          { bar_tip: calc.bar_tip, rb_tip: calc.rb_tip, takehome: calc.takehome },
          row.split_mode,
          memberInputs,
        )
      : [];
    const memberTakehome = shared
      ? row.members.map((m) => shares.find((s) => s.staff_id === m.staff_id)?.takehome ?? 0)
      : [];
    const pctLabel =
      raw.credit_tips > 0
        ? `${((calc.takehome / raw.credit_tips) * 100).toFixed(1)}% of tips`
        : "—";
    return { shared, auto, calc, shares, memberTakehome, pctLabel };
  });

  const totalServerBar = serverRows.reduce(
    (sum, r) => sum + calcServer(r as any, settings).bar_tip,
    0,
  );
  const perBartender = f.bartenders.length > 0 ? totalServerBar / f.bartenders.length : 0;
  const bartenderCards = f.bartenders.map((row) => {
    const shared = row.split_mode !== "single";
    const rawB = {
      staff_id: shared ? null : row.staff_id,
      cash_owed: num(row.cash_owed),
      credit_tips: num(row.credit_tips),
      total_sales: num(row.total_sales),
    };
    const auto = calcBartender(rawB as any, perBartender, settings);
    const calc = calcBartender(
      { ...rawB, rb_tip_override: optNum(row.rb_tip_override) } as any,
      perBartender,
      settings,
    );
    const memberInputs = row.members.map((m) => ({
      staff_id: m.staff_id,
      hours_worked: num(m.hours_worked),
    }));
    const shares = shared
      ? splitBartenderShares(
          rawB,
          { rb_tip: calc.rb_tip, takehome: calc.takehome, collected_from_servers: perBartender },
          row.split_mode,
          memberInputs.filter((m) => m.staff_id),
        )
      : [];
    const memberTakehome = shared
      ? row.members.map((m) => shares.find((s) => s.staff_id === m.staff_id)?.takehome ?? 0)
      : [];
    const total = rawB.credit_tips + perBartender;
    const pctLabel = total > 0 ? `${((calc.takehome / total) * 100).toFixed(1)}% of tips` : "—";
    return { shared, perBartender, auto, calc, shares, memberTakehome, pctLabel };
  });

  const supportCards = f.support.map((row) => ({
    staff_id: row.staff_id,
    payout: supportPayouts.find((p) => p.staff_id === row.staff_id)?.payout ?? 0,
  }));

  const serverCash = serverRows.reduce((s, r) => s + r.cash_owed, 0);
  const bartenderCash = bartenderRows.reduce((s, r) => s + r.cash_owed, 0);
  const currentSubtotal = serverCash + bartenderCash;
  const deposit = currentSubtotal + (f.period === "PM" ? amCash : 0);

  const saved = {
    servers: serverRows.filter((r) =>
      r.split_mode === "single" ? r.staff_id : r.members.length > 0,
    ).length,
    bartenders: bartenderRows.filter((r) => r.staff_id || r.members.length > 0).length,
    support: supportRows
      .filter((r) => r.staff_id)
      .map((r) => ({ staff_id: r.staff_id, role: r.role })),
  };

  return {
    pool,
    supportRows,
    supportPayouts,
    serverCards,
    perBartender,
    bartenderCards,
    supportCards,
    serverCash,
    bartenderCash,
    currentSubtotal,
    deposit,
    saved,
  };
}
