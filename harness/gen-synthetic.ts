// Regenerates fixtures/synthetic_v1.json by running the CURRENT (frozen v1) pipeline.
// Run: node --experimental-strip-types harness/gen-synthetic.ts
// Only rerun when ADDING cases. Existing expectations must never change; synthetic.test.ts
// fails if they do, and a changed expectation is a behavior change that needs Chad's sign-off.
import { writeFileSync } from "node:fs";
import { buildSyntheticFixture } from "./synthetic-lib.ts";

const out = new URL("../fixtures/synthetic_v1.json", import.meta.url);
const fx = buildSyntheticFixture();
writeFileSync(out, JSON.stringify(fx, null, 1) + "\n");
console.log(`wrote ${fx.cases.length} synthetic cases`);
