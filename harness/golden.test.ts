// Golden parity test. Run: node --experimental-strip-types --test harness/golden.test.ts
// Phase 2: point `compute` at engine/ computeShift(rules "v1") instead of the reference pipeline.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as C from "../src/lib/calculations.ts";
import { computeShiftV1 as compute } from "./reference-pipeline-v1.ts";

const inputs = JSON.parse(readFileSync(new URL("../fixtures/inputs.json", import.meta.url), "utf8"));
const expected = JSON.parse(readFileSync(new URL("../fixtures/expected_v1.json", import.meta.url), "utf8"));
const staffRole = new Map<string, string>(inputs.staff.map((s: any) => [s.id, s.role]));
const byKey = new Map(expected.shifts.map((e: any) => [e.key, e]));

test("fixture covers every shift", () => assert.equal(inputs.shifts.length, expected.shifts.length));

for (const sh of inputs.shifts) {
  test(`v1 parity ${sh.key}`, () => {
    const got = compute(sh, inputs.settings, staffRole);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(got)), (byKey.get(sh.key) as any).expected);
  });
}

test("Lovable worked examples (unit level)", () => {
  const d = JSON.parse(readFileSync(new URL("../fixtures/lovable_examples.json", import.meta.url), "utf8"));
  let n = 0;
  for (const c of d.cases) {
    const i = c.input; let got: any;
    if (i.row && "lbw_sales" in i.row && c.output && "bar_tip" in c.output) got = C.calcServer(i.row, i.settings);
    else if (i.row && c.output && "collected_from_servers" in c.output) got = C.calcBartender(i.row, i.serverBarTipsCollected ?? i.collected ?? 0, i.settings);
    else if (i.rows && "poolTotal" in i) got = C.calcSupportPool(i.rows, i.poolTotal, i.settings, i.splitMode);
    else if (i.entry && "lbw_sales" in i.entry) got = C.splitServerShares(i.entry, i.entryCalc, i.splitMode, i.members);
    else if (i.entry) got = C.splitBartenderShares(i.entry, i.entryCalc, i.splitMode, i.members);
    else continue;
    n++; assert.deepStrictEqual(JSON.parse(JSON.stringify(got)), c.output, c.name);
  }
  assert.equal(n, 17);
});
