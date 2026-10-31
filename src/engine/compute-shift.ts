// The single per-shift pipeline. Pure TypeScript: no React, Supabase, or DOM.
// rules "v1" reproduces reports.tsx exactly (locked by fixtures/expected_v1.json and
// fixtures/synthetic_v1.json). Do not change v1 behavior; a new rule set gets a new name.
import {
  calcBartender,
  calcServer,
  calcSupportPool,
  poolFromShift,
  resolveSupportRole,
  round2,
  splitBartenderShares,
  splitServerShares,
  type BartenderMember,
  type BartenderShare,
  type BartenderSplitMode,
  type ServerShare,
  type Settings,
} from "./calculations.ts";

export type RulesVersion = "v1";

export type ServerEntryInput = {
  staff_id: string | null;
  cash_owed: number;
  credit_tips: number;
  lbw_sales: number;
  total_sales?: number;
  bar_tip_override?: number | null;
  rb_tip_override?: number | null;
  split_mode?: BartenderSplitMode | null;
  members?: BartenderMember[];
};

export type BartenderEntryInput = {
  staff_id: string | null;
  cash_owed: number;
  credit_tips: number;
  total_sales?: number;
  rb_tip_override?: number | null;
  split_mode?: BartenderSplitMode | null;
  members?: BartenderMember[];
};

export type SupportInput = { staff_id: string; hours_worked: number; role?: string | null };

export type ShiftInput = {
  support_split_mode?: string | null;
  servers: ServerEntryInput[];
  bartenders: BartenderEntryInput[];
  support: SupportInput[];
};

export type EngineContext = { staffRole: Map<string, string> };

export const PERSON_FIELDS = [
  "shifts",
  "hours",
  "cash_owed",
  "credit_tips",
  "lbw_sales",
  "bar_tip_out",
  "rb_tip_out",
  "rb_received",
  "bar_from_servers",
  "takehome",
] as const;
export type PersonTotals = Record<(typeof PERSON_FIELDS)[number], number>;
export const emptyTotals = (): PersonTotals =>
  Object.fromEntries(PERSON_FIELDS.map((k) => [k, 0])) as PersonTotals;

export type ShiftResult = {
  entries: {
    servers: { calc: ReturnType<typeof calcServer>; shares: ServerShare[] }[];
    bartenders: {
      collected: number;
      calc: ReturnType<typeof calcBartender>;
      shares: BartenderShare[];
    }[];
    support: { pool: number; payouts: { staff_id: string; payout: number }[] };
  };
  /** Per person for this shift, sorted by staff id. */
  per_person: Record<string, PersonTotals>;
  server_bar_total: number;
};

type Patch = Partial<PersonTotals>;
type Bump = (id: string, patch: Patch) => void;

/** Adds a shift's results into `bump` in exactly the order reports.tsx always has:
 *  server shares, bartender shares, then each support row (payouts.find takes the
 *  first match). Keeping the order keeps floating-point sums bit-identical. */
export function forEachPersonPatch(input: ShiftInput, result: ShiftResult, bump: Bump) {
  for (const e of result.entries.servers) {
    for (const x of e.shares) {
      bump(x.staff_id, {
        cash_owed: x.cash_owed,
        credit_tips: x.credit_tips,
        lbw_sales: x.lbw_sales,
        bar_tip_out: x.bar_tip,
        rb_tip_out: x.rb_tip,
        takehome: x.takehome,
      });
    }
  }
  for (const e of result.entries.bartenders) {
    for (const x of e.shares) {
      bump(x.staff_id, {
        cash_owed: x.cash_owed,
        credit_tips: x.credit_tips,
        bar_from_servers: x.bar_from_servers,
        rb_tip_out: x.rb_tip,
        takehome: x.takehome,
      });
    }
  }
  const payouts = result.entries.support.payouts;
  for (const p of input.support) {
    const v = payouts.find((x) => x.staff_id === p.staff_id)?.payout ?? 0;
    bump(p.staff_id, { hours: p.hours_worked, rb_received: v, takehome: v });
  }
}

/** Adds a patch into a totals map the way reports.tsx's `bump` does (`+= value ?? 0`). */
export function bumpInto(map: Map<string, PersonTotals>): Bump {
  return (id, patch) => {
    const t = map.get(id) ?? emptyTotals();
    for (const k in patch) t[k as keyof PersonTotals] += patch[k as keyof PersonTotals] ?? 0;
    map.set(id, t);
  };
}

export function computeShift(
  input: ShiftInput,
  settings: Settings,
  ctx: EngineContext,
  rules: RulesVersion,
): ShiftResult {
  if (rules !== "v1") throw new Error(`unknown rules version: ${String(rules)}`);
  const s = settings;

  const servers = input.servers.map((sv) => {
    const calc = calcServer(sv, s);
    const shares = splitServerShares(
      sv,
      { bar_tip: calc.bar_tip, rb_tip: calc.rb_tip, takehome: calc.takehome },
      sv.split_mode ?? "single",
      sv.members ?? [],
    );
    return { calc, shares };
  });

  const serverBarTotal = input.servers.reduce((a, sv) => a + calcServer(sv, s).bar_tip, 0);
  const count = Math.max(input.bartenders.length, 1);
  const bartenders = input.bartenders.map((bt) => {
    const collected = round2(serverBarTotal / count);
    const calc = calcBartender(bt, collected, s);
    const shares = splitBartenderShares(
      bt,
      { rb_tip: calc.rb_tip, takehome: calc.takehome, collected_from_servers: collected },
      bt.split_mode ?? "single",
      bt.members ?? [],
    );
    return { collected, calc, shares };
  });

  const pool = poolFromShift(input.servers, input.bartenders, s);
  const rows = input.support.map((p) => ({
    staff_id: p.staff_id,
    role: resolveSupportRole(p.role, ctx.staffRole.get(p.staff_id)),
    hours_worked: p.hours_worked,
  }));
  const payouts = calcSupportPool(
    rows,
    pool,
    s,
    input.support_split_mode === "shared" ? "shared" : "weighted",
  );

  const result: ShiftResult = {
    entries: { servers, bartenders, support: { pool, payouts } },
    per_person: {},
    server_bar_total: serverBarTotal,
  };
  const per = new Map<string, PersonTotals>();
  forEachPersonPatch(input, result, bumpInto(per));
  for (const t of per.values()) t.shifts = 1;
  result.per_person = Object.fromEntries([...per].sort());
  return result;
}
