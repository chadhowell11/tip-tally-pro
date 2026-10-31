// Tip Tally Pro calculation engine. The only place money math may live (see harness/engine-guard.test.ts).
export { computeShift, emptyTotals, PERSON_FIELDS } from "./compute-shift.ts";
export type {
  EngineContext,
  PersonTotals,
  RulesVersion,
  ShiftInput,
  ShiftResult,
} from "./compute-shift.ts";
export { fromDbShift } from "./db-shape.ts";
export type { DbShiftRow } from "./db-shape.ts";
export { payrollDayRowsByStaff, payrollTotalsByStaff } from "./payroll.ts";
export type { BartenderSplitMode, Settings, SupportRole } from "./calculations.ts";
