// Phase 1 characterization: runs every consumer's CURRENT math (verbatim copies in
// harness/consumers/, or the real module where it is pure) on the golden and synthetic
// fixtures, and records every place it disagrees with payroll (reports.tsx, frozen as
// harness/reference-pipeline-v1.ts). Nothing here decides what is correct; it records what is.
process.env.TZ = "UTC"; // trends weekKey depends on the process time zone

import { readFileSync } from "node:fs";
import { computeShiftV1 } from "./reference-pipeline-v1.ts";
import {
  FORM_SELECT,
  REPORT_SELECT,
  SMS_SELECT,
  TRENDS_SELECT,
  staffRows,
  toDbShift,
} from "./consumers/db-shape.ts";
import { dayRowsByStaff, payrollRowsAndGrand, totalsByStaff } from "./consumers/payroll-v1.ts";
import { dayTotals, personRows, shiftBlock } from "./consumers/daily-v1.ts";
import { individualLines, individualTotal } from "./consumers/individual-v1.ts";
import { monthKey, series, trendRows } from "./consumers/trends-v1.ts";
import { formStaff, hydrate, liveValues } from "./consumers/shift-form-v1.ts";
// The SMS builder is pure, so the REAL module is used (needs --import ./harness/register-alias.mjs).
import { buildShiftMessages } from "../src/lib/shift-messages.ts";

const load = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const r2 = (n: number) => Math.round(n * 100) / 100;
const cents = (n: number) => Math.round(n * 100);

export type Dataset = {
  name: string;
  settingsFor: (key: string) => any;
  staff: { id: string; role: string; active?: boolean }[];
  shifts: any[];
  dayOf: (shift: any) => string;
};

export function datasets(): Dataset[] {
  const inputs = load("../fixtures/inputs.json");
  const syn = load("../fixtures/synthetic_v1.json");
  const synSettings = new Map(syn.cases.map((c: any) => [c.key, c.settings]));
  return [
    {
      name: "golden",
      settingsFor: () => inputs.settings,
      staff: inputs.staff,
      shifts: inputs.shifts,
      dayOf: (sh) => sh.shift_date,
    },
    // Synthetic cases all share one placeholder date; each is its own "day".
    {
      name: "synthetic",
      settingsFor: (k) => synSettings.get(k),
      staff: syn.staff,
      shifts: syn.cases.map((c: any) => c.shift),
      dayOf: (sh) => sh.key,
    },
  ];
}

/** A difference ledger: one row per (shift, person-or-field) where a consumer disagrees with payroll. */
type Diff = {
  key: string;
  who: string;
  field: string;
  payroll: number;
  consumer: number;
  delta: number;
};
/** Exact comparison for values that are not money-rounded on screen (e.g. an unrounded division). */
const diffExact = (
  out: Diff[],
  key: string,
  who: string,
  field: string,
  payroll: number,
  consumer: number,
) => {
  if (payroll !== consumer)
    out.push({
      key,
      who,
      field,
      payroll,
      consumer,
      delta: Math.round((consumer - payroll) * 1e6) / 1e6,
    });
};
const diff = (
  out: Diff[],
  key: string,
  who: string,
  field: string,
  payroll: number,
  consumer: number,
) => {
  if (cents(payroll) !== cents(consumer))
    out.push({
      key,
      who,
      field,
      payroll: r2(payroll),
      consumer: r2(consumer),
      delta: r2(consumer - payroll),
    });
};

export function summarize(diffs: Diff[]) {
  const byField: Record<
    string,
    { rows: number; shifts: number; net: number; abs: number; example: string }
  > = {};
  for (const d of diffs) {
    const f = (byField[d.field] ??= { rows: 0, shifts: 0, net: 0, abs: 0, example: d.key });
    f.rows++;
    f.net += d.delta;
    f.abs += Math.abs(d.delta);
  }
  for (const [field, f] of Object.entries(byField)) {
    f.shifts = new Set(diffs.filter((d) => d.field === field).map((d) => d.key)).size;
    f.net = r2(f.net);
    f.abs = r2(f.abs);
  }
  return byField;
}

const PERSON_FIELDS = [
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

function reference(ds: Dataset) {
  const role = new Map(ds.staff.map((s) => [s.id, s.role]));
  return new Map(ds.shifts.map((sh) => [sh.key, computeShiftV1(sh, ds.settingsFor(sh.key), role)]));
}

// ---------------------------------------------------------------- per consumer

/** Payroll as the screen actually runs it: through its Supabase select (no total_sales). */
export function payrollQuery(ds: Dataset) {
  const ref = reference(ds);
  const staffById = new Map(staffRows(ds.staff).map((s) => [s.id, s]));
  const out: Diff[] = [];
  for (const sh of ds.shifts) {
    const rows = dayRowsByStaff([toDbShift(sh, REPORT_SELECT)], ds.settingsFor(sh.key), staffById);
    const want = ref.get(sh.key)!.per_person as any;
    for (const id of new Set([...Object.keys(want), ...rows.keys()])) {
      const got = rows.get(id)?.[0]?.totals as any;
      for (const f of PERSON_FIELDS) diff(out, sh.key, id, f, want[id]?.[f] ?? 0, got?.[f] ?? 0);
    }
  }
  return out;
}

/** Daily person sheets (personRows) vs payroll, per date. */
export function dailyPersons(ds: Dataset) {
  const ref = reference(ds);
  const staffById = new Map(staffRows(ds.staff).map((s) => [s.id, s]));
  const out: Diff[] = [];
  const dates = groupBy(ds.shifts, ds.dayOf);
  for (const [date, records] of dates) {
    const settings = ds.settingsFor(records[0].key);
    const got = new Map(
      personRows(
        records.map((r, i) => toDbShift(r, REPORT_SELECT, `${r.key}#${i}`)),
        settings,
        staffById,
      ).map((p) => [p.staff_id, p]),
    );
    const want = new Map<string, any>();
    for (const r of records)
      for (const [id, t] of Object.entries(ref.get(r.key)!.per_person) as any) {
        const w = want.get(id) ?? Object.fromEntries(PERSON_FIELDS.map((f) => [f, 0]));
        for (const f of PERSON_FIELDS) w[f] += t[f];
        want.set(id, w);
      }
    const map: Record<string, string> = {
      hours: "hours",
      cash_owed: "cash_owed",
      credit_tips: "credit_tips",
      lbw_sales: "lbw_sales",
      bar_tip_out: "bar_out",
      rb_tip_out: "rb_out",
      rb_received: "rb_received",
      bar_from_servers: "from_servers",
      takehome: "takehome",
    };
    for (const id of new Set([...want.keys(), ...got.keys()]))
      for (const f of PERSON_FIELDS)
        diff(out, date, id, f, want.get(id)?.[f] ?? 0, (got.get(id) as any)?.[map[f]] ?? 0);
  }
  return out;
}

const groupBy = (shifts: any[], keyOf: (s: any) => string) => {
  const m = new Map<string, any[]>();
  for (const s of shifts) (m.get(keyOf(s)) ?? m.set(keyOf(s), []).get(keyOf(s))!).push(s);
  return m;
};

/** Daily shift totals (Day Totals card + ShiftBlock header) vs payroll's per-person sums for the same shift. */
export function dailyTotals(ds: Dataset) {
  const ref = reference(ds);
  const staffById = new Map(staffRows(ds.staff).map((s) => [s.id, s]));
  const out: Diff[] = [];
  for (const sh of ds.shifts) {
    const settings = ds.settingsFor(sh.key);
    const db = toDbShift(sh, REPORT_SELECT);
    const t = dayTotals([db], settings, staffById).day;
    const block = shiftBlock(db, settings, staffById);
    const pp = Object.values(ref.get(sh.key)!.per_person) as any[];
    const sum = (f: string) => pp.reduce((a, p) => a + p[f], 0);
    diff(out, sh.key, "shift", "cash (raw entries)", sum("cash_owed"), t.cash);
    diff(out, sh.key, "shift", "credit (raw entries)", sum("credit_tips"), t.credit);
    diff(out, sh.key, "shift", "lbw (raw entries)", sum("lbw_sales"), t.lbw);
    diff(out, sh.key, "shift", "barOut", sum("bar_tip_out"), t.barOut);
    diff(out, sh.key, "shift", "rbOut", sum("rb_tip_out"), t.rbOut);
    diff(out, sh.key, "shift", "supportPool", sum("rb_received"), t.supportPool);
    diff(out, sh.key, "shift", "fromServers", sum("bar_from_servers"), t.fromServers);
    diff(out, sh.key, "shift", "takehome (whole entries)", sum("takehome"), t.takehome);
    diff(
      out,
      sh.key,
      "shift",
      "ShiftBlock totalTakehome vs Day Totals",
      t.takehome,
      block.totalTakehome,
    );
    // ShiftBlock table rows must be exactly payroll's shares and payouts.
    const e = ref.get(sh.key)!.entries as any;
    const refRows = JSON.stringify([
      e.servers.flatMap((x: any) => x.shares),
      e.bartenders.flatMap((x: any) => x.shares),
      sh.support.map(
        (p: any) => e.support.payouts.find((q: any) => q.staff_id === p.staff_id)?.payout ?? 0,
      ),
    ]);
    const gotRows = JSON.stringify([
      block.serverRows,
      block.bartenderRows,
      block.supportLines.map((l: any) => l.payout),
    ]);
    if (refRows !== gotRows)
      out.push({
        key: sh.key,
        who: "shift",
        field: "ShiftBlock rows",
        payroll: 0,
        consumer: 0,
        delta: 0,
      });
  }
  return out;
}

/** Individual report lines vs payroll per person per shift. */
export function individual(ds: Dataset) {
  const ref = reference(ds);
  const staffById = new Map(staffRows(ds.staff).map((s) => [s.id, s]));
  const out: Diff[] = [];
  for (const sh of ds.shifts) {
    const settings = ds.settingsFor(sh.key);
    const db = toDbShift(sh, REPORT_SELECT);
    const want = ref.get(sh.key)!.per_person as any;
    for (const s of ds.staff) {
      const line = individualLines([db], settings, s.id, staffById)[0] as any;
      for (const f of PERSON_FIELDS)
        diff(out, sh.key, s.id, f, want[s.id]?.[f] ?? 0, line?.[f] ?? 0);
    }
  }
  return out;
}

/** Trends per-person take-home vs payroll, per shift. */
export function trends(ds: Dataset) {
  const ref = reference(ds);
  const staffById = new Map(staffRows(ds.staff).map((s) => [s.id, s]));
  const out: Diff[] = [];
  for (const sh of ds.shifts) {
    const s = series([toDbShift(sh, TRENDS_SELECT)], ds.settingsFor(sh.key), staffById, "month");
    const want = ref.get(sh.key)!.per_person as any;
    for (const id of new Set([...Object.keys(want), ...s.map.keys()]))
      diff(
        out,
        sh.key,
        id,
        "takehome",
        want[id]?.takehome ?? 0,
        s.map.get(id)?.get(monthKey(sh.shift_date))?.takehome ?? 0,
      );
  }
  return out;
}

/** SMS: per-person total of every "Take-home" line vs payroll; also counts messages per person. */
export function sms(ds: Dataset) {
  const ref = reference(ds);
  const msgStaff = staffRows(ds.staff).map((s) => ({ ...s, phone: null }));
  const out: Diff[] = [];
  const multi: { key: string; who: string; messages: number }[] = [];
  for (const sh of ds.shifts) {
    const msgs = buildShiftMessages(
      toDbShift(sh, SMS_SELECT) as any,
      ds.settingsFor(sh.key),
      msgStaff,
    );
    const got = new Map<string, { takehome: number; n: number }>();
    for (const m of msgs) {
      const v = Number(/Take-home: \$(-?[\d.]+)$/.exec(m.body)![1]);
      const g = got.get(m.staff_id) ?? { takehome: 0, n: 0 };
      g.takehome += v;
      g.n++;
      got.set(m.staff_id, g);
    }
    const want = ref.get(sh.key)!.per_person as any;
    for (const id of new Set([...Object.keys(want), ...got.keys()])) {
      diff(out, sh.key, id, "takehome", want[id]?.takehome ?? 0, got.get(id)?.takehome ?? 0);
      if ((got.get(id)?.n ?? 0) > 1) multi.push({ key: sh.key, who: id, messages: got.get(id)!.n });
    }
  }
  return { diffs: out, multiMessage: multi };
}

/** Shift form opened on a SAVED shift (edit-load path) vs payroll for the same shift. */
export function shiftForm(ds: Dataset) {
  const ref = reference(ds);
  const staff = formStaff(ds.staff);
  const out: Diff[] = [];
  for (const sh of ds.shifts) {
    const v = liveValues(hydrate(toDbShift(sh, FORM_SELECT)), ds.settingsFor(sh.key), staff);
    const e = ref.get(sh.key)!.entries as any;
    e.servers.forEach((x: any, i: number) => {
      diff(
        out,
        sh.key,
        `server#${i}`,
        "entry takehome",
        x.calc.takehome,
        v.serverCards[i].calc.takehome,
      );
      x.shares.forEach((s: any, j: number) => {
        if (v.serverCards[i].shared)
          diff(
            out,
            sh.key,
            `server#${i}/${s.staff_id}`,
            "member share takehome",
            s.takehome,
            v.serverCards[i].shares[j]?.takehome ?? 0,
          );
      });
    });
    e.bartenders.forEach((x: any, i: number) => {
      diffExact(
        out,
        sh.key,
        `bartender#${i}`,
        "from servers (unrounded division)",
        x.collected,
        v.bartenderCards[i].perBartender,
      );
      diff(
        out,
        sh.key,
        `bartender#${i}`,
        "entry takehome",
        x.calc.takehome,
        v.bartenderCards[i].calc.takehome,
      );
      x.shares.forEach((s: any, j: number) => {
        if (v.bartenderCards[i].shared)
          diff(
            out,
            sh.key,
            `bartender#${i}/${s.staff_id}`,
            "member share takehome",
            s.takehome,
            v.bartenderCards[i].shares[j]?.takehome ?? 0,
          );
      });
    });
    diff(out, sh.key, "shift", "support pool", e.support.pool, v.pool);
    sh.support.forEach((p: any, i: number) =>
      diff(
        out,
        sh.key,
        p.staff_id,
        "support payout",
        e.support.payouts.find((q: any) => q.staff_id === p.staff_id)?.payout ?? 0,
        v.supportCards[i].payout,
      ),
    );
    const cash = (Object.values(ref.get(sh.key)!.per_person) as any[]).reduce(
      (a, p) => a + p.cash_owed,
      0,
    );
    diff(out, sh.key, "shift", "cash subtotal (raw entries)", cash, v.currentSubtotal);
  }
  return out;
}

// ---------------------------------------------------------------- scenarios the fixtures cannot contain

/** Daily: two saved records for the same date and period (e.g. a duplicate or a second location
 *  under the same login). Day Totals uses only the first; person sheets use both. */
export function dailyDuplicateRecordScenario() {
  const inputs = load("../fixtures/inputs.json");
  const sh = inputs.shifts.find((s: any) => s.key === "2026-10-30-PM");
  const staffById = new Map(staffRows(inputs.staff).map((s) => [s.id, s]));
  const records = [toDbShift(sh, REPORT_SELECT, "rec-1"), toDbShift(sh, REPORT_SELECT, "rec-2")];
  const day = dayTotals(records, inputs.settings, staffById).day;
  const persons = personRows(records, inputs.settings, staffById);
  return {
    key: sh.key,
    dayTotalsTakehome: r2(day.takehome),
    personSheetsTakehome: r2(persons.reduce((a, p) => a + p.takehome, 0)),
  };
}

/** Shift form: a blank, unsaved bartender card on screen while entering a real shift. */
export function shiftFormBlankEntryScenario() {
  const inputs = load("../fixtures/inputs.json");
  const sh = inputs.shifts.find((s: any) => s.key === "2026-10-30-PM");
  const f = hydrate(toDbShift(sh, FORM_SELECT));
  const withBlank = {
    ...f,
    bartenders: [
      ...f.bartenders,
      {
        staff_id: "",
        cash_owed: "",
        credit_tips: "",
        total_sales: "",
        rb_tip_override: "",
        split_mode: "single",
        members: [],
      },
    ],
  };
  const before = liveValues(f, inputs.settings, formStaff(inputs.staff));
  const after = liveValues(withBlank, inputs.settings, formStaff(inputs.staff));
  return {
    key: sh.key,
    bartenders_on_screen: withBlank.bartenders.length,
    bartenders_saved: after.saved.bartenders,
    from_servers_without_blank: r2(before.perBartender),
    from_servers_with_blank: r2(after.perBartender),
    bartender_takehome_without_blank: before.bartenderCards[0].calc.takehome,
    bartender_takehome_with_blank: after.bartenderCards[0].calc.takehome,
  };
}

/** Whole-period payroll through the real query shape vs expected_v1 period totals. */
export function payrollPeriodTotals() {
  const inputs = load("../fixtures/inputs.json");
  const staffById = new Map(staffRows(inputs.staff).map((s) => [s.id, s]));
  const totals = totalsByStaff(
    inputs.shifts.map((s: any) => toDbShift(s, REPORT_SELECT)),
    inputs.settings,
    staffById,
  );
  return {
    totals: Object.fromEntries([...totals].sort()),
    grand: payrollRowsAndGrand(totals, staffById).grand,
  };
}

/** Trends whole-period monthly house totals vs payroll take-home per month. */
export function trendsMonthly() {
  const inputs = load("../fixtures/inputs.json");
  const staffById = new Map(staffRows(inputs.staff).map((s) => [s.id, s]));
  const { houseTotals } = trendRows(
    series(
      inputs.shifts.map((s: any) => toDbShift(s, TRENDS_SELECT)),
      inputs.settings,
      staffById,
      "month",
    ),
    staffById,
  );
  const ref = reference(datasets()[0]);
  const payroll: Record<string, number> = {};
  for (const sh of inputs.shifts)
    for (const p of Object.values(ref.get(sh.key)!.per_person) as any[])
      payroll[monthKey(sh.shift_date)] = (payroll[monthKey(sh.shift_date)] ?? 0) + p.takehome;
  return houseTotals.map((h) => ({
    month: h.key,
    trends: h.total,
    payroll: r2(payroll[h.key]),
    delta: r2(h.total - payroll[h.key]),
  }));
}

/** Individual whole-period totals per person vs payroll period totals. */
export function individualPeriod() {
  const inputs = load("../fixtures/inputs.json");
  const staffById = new Map(staffRows(inputs.staff).map((s) => [s.id, s]));
  const db = inputs.shifts.map((s: any) => toDbShift(s, REPORT_SELECT));
  const payroll = totalsByStaff(db, inputs.settings, staffById);
  const rows: any[] = [];
  for (const s of inputs.staff) {
    const lines = individualLines(db, inputs.settings, s.id, staffById);
    if (!lines.length) continue;
    const { total } = individualTotal(lines);
    const p = payroll.get(s.id)!;
    const d: any = { who: s.id, lines: lines.length, payroll_shifts: p.shifts };
    for (const f of ["cash_owed", "hours", "takehome"] as const)
      d[f] = { payroll: r2(p[f]), individual: r2((total as any)[f]) };
    rows.push(d);
  }
  return rows;
}

// ---------------------------------------------------------------- snapshot

export function buildCharacterization() {
  const out: any = {
    note: "Generated by harness/gen-characterization.ts from CURRENT code. Records where each consumer disagrees with payroll. Do not hand-edit.",
    consumers: {},
  };
  for (const ds of datasets()) {
    const s = sms(ds);
    const all: Record<string, Diff[]> = {
      payroll_query: payrollQuery(ds),
      daily_persons: dailyPersons(ds),
      daily_totals: dailyTotals(ds),
      individual: individual(ds),
      trends: trends(ds),
      sms: s.diffs,
      shift_form: shiftForm(ds),
    };
    for (const [name, diffs] of Object.entries(all)) {
      (out.consumers[name] ??= {})[ds.name] = { summary: summarize(diffs), diffs };
    }
    out.consumers.sms[ds.name].multi_message = s.multiMessage;
  }
  out.scenarios = {
    daily_duplicate_record: dailyDuplicateRecordScenario(),
    shift_form_blank_entry: shiftFormBlankEntryScenario(),
    trends_monthly: trendsMonthly(),
    individual_period: individualPeriod(),
  };
  return out;
}
