// Phase 1 characterization of every pipeline copy outside payroll.
// Run: npm run test:characterize
// Each consumer's CURRENT output is compared with payroll (reports.tsx) on the golden and synthetic
// fixtures, and every disagreement is locked in fixtures/characterization_v1.json. If a consumer's
// numbers change, this fails. That is intended: record the before/after in docs/VARIANCES.md and get
// Chad's approval before regenerating the snapshot.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  buildCharacterization,
  dailyDuplicateRecordScenario,
  payrollPeriodTotals,
  shiftFormBlankEntryScenario,
} from "./characterize-lib.ts";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const snapshot = JSON.parse(read("../fixtures/characterization_v1.json"));
const current = JSON.parse(JSON.stringify(buildCharacterization()));
const c = (n: string, ds = "golden") => current.consumers[n][ds];

// The harness/consumers/* files are transcriptions. If a source file changes, its copy may be stale:
// re-transcribe it (or, in Phase 2, delete the copy once that consumer runs on the engine).
const PINNED: Record<string, string> = {
  "../src/engine/calculations.ts": "481e6d903211fecb1749cefca19016fcfedc0e7c5222347b23806eb4ad7443d7",
  "../src/routes/_authenticated/reports.tsx":
    "01030a663edfd7a0bbad5842780193638ba5b3618c810b18cd50b2a42188de0e",
  "../src/routes/_authenticated/daily.tsx":
    "c768f6609185686bd34b4a245ab1c3df84ce24211e53e4bf1b165c23c2692539",
  "../src/routes/_authenticated/individual.tsx":
    "355c166500dae5cfc7f8967b642e95d2f702f0509b8f38ba02af78e24273eea8",
  "../src/routes/_authenticated/trends.tsx":
    "e70a6971fcf57c3254b7c8dea58dbc3dc5b927a9345222f3bfea5529c88b1fa3",
  "../src/routes/_authenticated/shift.new.tsx":
    "6c3759a245e7ec72982ce129be56d97c72c79f70685be7e46d7abe88631febd7",
  "../src/lib/shift-messages.ts":
    "71e19be5cbf0c812b366c42134aa66831007909ddd652acbe0ff562ba4adb2d2",
  "../src/lib/sms.functions.ts": "61b278ca9a91b02f6e0683d49bfaa3df7798765fe2ca68d6c52d2bcf223db1a3",
};
for (const [p, h] of Object.entries(PINNED)) {
  test(`source pinned: ${p.slice(3)}`, () =>
    assert.equal(createHash("sha256").update(read(p)).digest("hex"), h));
}

// ---- snapshot: every consumer x dataset is exactly as recorded ----
for (const name of Object.keys(snapshot.consumers)) {
  for (const ds of ["golden", "synthetic"]) {
    test(`characterization snapshot: ${name} / ${ds}`, () =>
      assert.deepStrictEqual(current.consumers[name][ds], snapshot.consumers[name][ds]));
  }
}
test("characterization snapshot: scenarios", () =>
  assert.deepStrictEqual(current.scenarios, snapshot.scenarios));

// ---- the brief's table, row by row (documented in docs/VARIANCES.md) ----
test("payroll copy is faithful: whole-period totals match expected_v1 to the cent", () => {
  const exp = JSON.parse(read("../fixtures/expected_v1.json")).period_totals_by_staff;
  const got: any = payrollPeriodTotals().totals;
  assert.deepStrictEqual(Object.keys(got).sort(), Object.keys(exp).sort());
  for (const id of Object.keys(exp))
    for (const k of Object.keys(exp[id]))
      assert.equal(Math.round(got[id][k] * 100), Math.round(exp[id][k] * 100), `${id}.${k}`);
});

test("all report queries: total_sales omission is $0 on Carson's data, nonzero under rb_basis=sales", () => {
  assert.deepStrictEqual(c("payroll_query").diffs, []);
  const syn = c("payroll_query", "synthetic").diffs;
  assert.deepStrictEqual([...new Set(syn.map((d: any) => d.key))].sort(), [
    "SYN-rb-sales",
    "SYN-rb-sales-net",
    "SYN-zero-tips-sales-basis",
  ]);
});

test("daily totals: raw entry cash/credit and whole-entry take-home differ from payroll", () => {
  const fields = new Set(c("daily_totals").diffs.map((d: any) => d.field));
  assert.deepStrictEqual([...fields].sort(), [
    "credit (raw entries)",
    "lbw (raw entries)",
    "takehome (whole entries)",
  ]);
  const syn = c("daily_totals", "synthetic").diffs;
  const has = (key: string, field: string) =>
    syn.some((d: any) => d.key === key && d.field === field);
  assert.ok(
    has("SYN-single-null-staff", "takehome (whole entries)"),
    "counts take-home of entries paid to no one",
  );
  assert.ok(has("SYN-three-bartenders", "fromServers"), "full bar total, not N x rounded receipt");
  assert.ok(has("SYN-dup-support", "supportPool"), "sums actual payouts, not find()-matched ones");
});

test("daily totals: only the first AM/PM record is used", () => {
  const s = dailyDuplicateRecordScenario();
  assert.equal(s.personSheetsTakehome, 2 * s.dayTotalsTakehome);
});

test("daily person rows: identical to payroll on single-record days", () => {
  assert.deepStrictEqual(c("daily_persons").diffs, []);
});

test("individual: omits bartender cash and adds bartender member hours", () => {
  const fields = new Set(c("individual").diffs.map((d: any) => d.field));
  assert.deepStrictEqual([...fields].sort(), ["cash_owed", "hours"]);
  assert.ok(
    c("individual")
      .diffs.filter((d: any) => d.field === "cash_owed")
      .every((d: any) => d.delta < 0),
  );
});

test("trends: weights support by current staff role, not the saved shift role", () => {
  const fields = new Set(c("trends").diffs.map((d: any) => d.field));
  assert.deepStrictEqual([...fields], ["takehome"]);
  assert.ok(c("trends").summary.takehome.abs > 0);
});

test("sms: omits the support role and sends one message per share row", () => {
  assert.ok(c("sms").summary.takehome.abs > 0);
  assert.ok(c("sms").multi_message.length > 0);
});

test("shift form: agrees with payroll on saved Carson shifts; unrounded bar split shows only in synthetic", () => {
  assert.deepStrictEqual(c("shift_form").diffs, []);
  assert.ok(
    c("shift_form", "synthetic").diffs.some(
      (d: any) => d.field === "from servers (unrounded division)",
    ),
  );
});

test("shift form: a blank unsaved bartender card changes live numbers", () => {
  const s = shiftFormBlankEntryScenario();
  assert.equal(s.bartenders_saved, s.bartenders_on_screen - 1);
  assert.notEqual(s.bartender_takehome_with_blank, s.bartender_takehome_without_blank);
});
