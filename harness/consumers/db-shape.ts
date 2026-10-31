// Turns a fixture shift into the nested row shape each consumer receives from its
// Supabase select. Each consumer's select is reproduced column for column, so a
// column a screen does not select (total_sales, shift_support.role) is absent here too.

export type SelectSpec = { name: string; total_sales: boolean; support_role: boolean };

/** reports.tsx:178, daily.tsx:97, individual.tsx:123 — no total_sales; support role selected. */
export const REPORT_SELECT: SelectSpec = {
  name: "reports/daily/individual",
  total_sales: false,
  support_role: true,
};
/** trends.tsx:101 — no total_sales; shift_support(staff_id, hours_worked) only. */
export const TRENDS_SELECT: SelectSpec = {
  name: "trends",
  total_sales: false,
  support_role: false,
};
/** sms.functions.ts:7 SHIFT_SELECT — no total_sales; shift_support(staff_id, hours_worked) only. */
export const SMS_SELECT: SelectSpec = { name: "sms", total_sales: false, support_role: false };
/** shift.new.tsx:358 edit-load select uses `*` — every column, including total_sales and role. */
export const FORM_SELECT: SelectSpec = {
  name: "shift form",
  total_sales: true,
  support_role: true,
};

export function toDbShift(sh: any, sel: SelectSpec, id: string = sh.key) {
  return {
    id,
    shift_date: sh.shift_date,
    period: sh.period,
    notes: null,
    support_split_mode: sh.support_split_mode,
    shift_servers: sh.servers.map((e: any) => ({
      staff_id: e.staff_id,
      cash_owed: e.cash_owed,
      credit_tips: e.credit_tips,
      lbw_sales: e.lbw_sales,
      ...(sel.total_sales && "total_sales" in e ? { total_sales: e.total_sales } : {}),
      bar_tip_override: e.bar_tip_override,
      rb_tip_override: e.rb_tip_override,
      split_mode: e.split_mode,
      shift_server_members: e.members.map((m: any) => ({
        staff_id: m.staff_id,
        hours_worked: m.hours_worked,
      })),
    })),
    shift_bartenders: sh.bartenders.map((e: any) => ({
      staff_id: e.staff_id,
      cash_owed: e.cash_owed,
      credit_tips: e.credit_tips,
      ...(sel.total_sales && "total_sales" in e ? { total_sales: e.total_sales } : {}),
      rb_tip_override: e.rb_tip_override,
      split_mode: e.split_mode,
      shift_bartender_members: e.members.map((m: any) => ({
        staff_id: m.staff_id,
        hours_worked: m.hours_worked,
      })),
    })),
    shift_support: sh.support.map((p: any) => ({
      staff_id: p.staff_id,
      hours_worked: p.hours_worked,
      ...(sel.support_role ? { role: p.role } : {}),
    })),
  };
}

/** Staff rows as the report screens load them: `select("id, name, server_number, role")`. */
export const staffRows = (staff: { id: string; role: string }[]) =>
  staff.map((s) => ({
    id: s.id,
    name: `Staff ${s.id}`,
    server_number: s.id.slice(1),
    role: s.role,
  }));
