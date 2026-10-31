// Synthetic edge-case parity. Run: node --experimental-strip-types --test harness/synthetic.test.ts
// Expected values in fixtures/synthetic_v1.json were produced by the v1 code, not by hand.
// Phase 2: point `compute` at engine/ computeShift(rules "v1"), same as golden.test.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeShiftV1 as compute } from "./reference-pipeline-v1.ts";
import { SYNTHETIC_CASES } from "./synthetic-cases.ts";

const fx = JSON.parse(
  readFileSync(new URL("../fixtures/synthetic_v1.json", import.meta.url), "utf8"),
);
const staffRole = new Map<string, string>(fx.staff.map((s: any) => [s.id, s.role]));

test("synthetic fixture covers every defined case", () => {
  assert.deepStrictEqual(
    fx.cases.map((c: any) => c.key),
    SYNTHETIC_CASES.map((c) => c.shift.key),
  );
  assert.equal(new Set(fx.cases.map((c: any) => c.key)).size, fx.cases.length);
});

for (const c of fx.cases) {
  test(`v1 synthetic ${c.key}: ${c.name}`, () => {
    const got = compute(c.shift, c.settings, staffRole);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(got)), c.expected);
  });
}
