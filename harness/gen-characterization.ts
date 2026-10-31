// Regenerates fixtures/characterization_v1.json from CURRENT code.
// Run: npm run gen:characterization
// Rerun only after a Chad-approved consumer change (Phase 2) — the diff of this file IS the
// before/after record for docs/VARIANCES.md. Never rerun just to make a failing test pass.
import { writeFileSync } from "node:fs";
import { buildCharacterization } from "./characterize-lib.ts";

writeFileSync(
  new URL("../fixtures/characterization_v1.json", import.meta.url),
  JSON.stringify(buildCharacterization(), null, 1) + "\n",
);
console.log("wrote fixtures/characterization_v1.json");
