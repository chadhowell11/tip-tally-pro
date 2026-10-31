// Phase 2 engine checks. Run: npm run test:engine
// 1. computeShift(rules "v1") is identical to the frozen reference pipeline on every fixture.
// 2. Payroll aggregation on the engine is bit-identical (values AND map order) to the
//    pre-engine reports.tsx code, transcribed in harness/consumers/payroll-v1.ts.
// 3. src/engine/ is pure: it imports nothing outside itself.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { computeShift, payrollDayRowsByStaff, payrollTotalsByStaff } from "../src/engine/index.ts";
import { computeShiftV1 } from "./reference-pipeline-v1.ts";
import { dayRowsByStaff, totalsByStaff } from "./consumers/payroll-v1.ts";
import { REPORT_SELECT, staffRows, toDbShift } from "./consumers/db-shape.ts";

const load = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const inputs = load("../fixtures/inputs.json");
const syn = load("../fixtures/synthetic_v1.json");

const sets = [
  {
    name: "golden",
    staff: inputs.staff,
    cases: inputs.shifts.map((s: any) => ({ shift: s, settings: inputs.settings })),
  },
  {
    name: "synthetic",
    staff: syn.staff,
    cases: syn.cases.map((c: any) => ({ shift: c.shift, settings: c.settings })),
  },
];

for (const set of sets) {
  const staffRole = new Map<string, string>(set.staff.map((s: any) => [s.id, s.role]));
  const staffById = new Map(staffRows(set.staff).map((s) => [s.id, s]));

  test(`engine equals frozen reference: ${set.name}`, () => {
    for (const { shift, settings } of set.cases) {
      assert.deepStrictEqual(
        computeShift(shift, settings, { staffRole }, "v1"),
        computeShiftV1(shift, settings, staffRole),
        shift.key,
      );
    }
  });

  // Payroll is computed one settings object per run, as on the screen; synthetic cases each
  // carry their own settings, so they are checked one shift at a time.
  const runs = set.name === "golden" ? [set.cases] : set.cases.map((c: any) => [c]);
  test(`payroll totals on engine are bit-identical to pre-engine reports.tsx: ${set.name}`, () => {
    for (const run of runs) {
      const db = run.map((c: any) => toDbShift(c.shift, REPORT_SELECT));
      const before = totalsByStaff(db, run[0].settings, staffById);
      const after = payrollTotalsByStaff(db, run[0].settings, staffRole);
      assert.deepStrictEqual([...after.entries()], [...before.entries()]);
    }
  });
  test(`payroll day rows on engine are bit-identical to pre-engine reports.tsx: ${set.name}`, () => {
    for (const run of runs) {
      const db = run.map((c: any) => toDbShift(c.shift, REPORT_SELECT));
      const before = dayRowsByStaff(db, run[0].settings, staffById);
      const after = payrollDayRowsByStaff(db, run[0].settings, staffRole);
      assert.deepStrictEqual([...after.entries()], [...before.entries()]);
    }
  });
}

test("engine is pure: src/engine imports only its own files", () => {
  const dir = new URL("../src/engine/", import.meta.url);
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".ts"))) {
    const src = readFileSync(new URL(f, dir), "utf8");
    for (const m of src.matchAll(/(?:import|export)[^"';]*?from\s+["']([^"']+)["']/g)) {
      assert.ok(m[1].startsWith("./"), `${f} imports ${m[1]}`);
    }
    assert.ok(
      !/\b(window|document|localStorage)\b/.test(src.replace(/\/\/.*$/gm, "")),
      `${f} touches the DOM`,
    );
  }
});

test("unknown rules version is refused", () => {
  assert.throws(() =>
    computeShift(
      { servers: [], bartenders: [], support: [] },
      inputs.settings,
      { staffRole: new Map() },
      "v2" as any,
    ),
  );
});
