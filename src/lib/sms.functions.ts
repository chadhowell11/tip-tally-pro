import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildShiftMessages, type MsgShift, type MsgStaff } from "@/lib/shift-messages";
import type { Settings } from "@/lib/calculations";

const SHIFT_SELECT =
  "id, location_id, shift_date, period, shift_servers(staff_id, cash_owed, credit_tips, lbw_sales, bar_tip_override, rb_tip_override, split_mode, shift_server_members(staff_id, hours_worked)), shift_bartenders(staff_id, cash_owed, credit_tips, rb_tip_override, split_mode, shift_bartender_members(staff_id, hours_worked)), shift_support(staff_id, hours_worked), support_split_mode";

export type SmsRecipientResult = {
  staff_id: string;
  name: string;
  status: "sent" | "skipped" | "failed";
  detail?: string;
};

export type SendShiftReportsResult = {
  configured: boolean;
  sent: number;
  skipped: number;
  failed: number;
  results: SmsRecipientResult[];
  error?: string;
};

/** Text each person on a shift their own tip summary. Numbers come from the
 *  database and payouts are recomputed server-side — nothing is trusted from
 *  the browser except the shift id (still RLS-scoped to the caller). */
export const sendShiftTipReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { shift_id: string }) => {
    if (!data?.shift_id || typeof data.shift_id !== "string") throw new Error("shift_id is required");
    return { shift_id: data.shift_id };
  })
  .handler(async ({ data, context }): Promise<SendShiftReportsResult> => {
    const empty = { sent: 0, skipped: 0, failed: 0, results: [] as SmsRecipientResult[] };

    const { data: shift, error: shiftError } = await context.supabase
      .from("shifts")
      .select(SHIFT_SELECT)
      .eq("id", data.shift_id)
      .maybeSingle();
    if (shiftError) return { configured: true, ...empty, error: shiftError.message };
    if (!shift) return { configured: true, ...empty, error: "Shift not found." };
    const locationId = shift.location_id;
    if (!locationId) return { configured: true, ...empty, error: "Shift has no establishment." };

    const [{ data: settings }, { data: staff }] = await Promise.all([
      context.supabase.from("app_settings").select("*").eq("location_id", locationId).maybeSingle(),
      context.supabase.from("staff").select("id, name, server_number, phone, role").eq("location_id", locationId),
    ]);
    if (!settings) return { configured: true, ...empty, error: "Settings not found for this establishment." };

    const s = settings as unknown as Settings & {
      establishment_name?: string | null;
      sms_enabled?: boolean;
      sms_from_number?: string | null;
      sms_include_breakdown?: boolean;
    };

    if (!s.sms_enabled) {
      return { configured: true, ...empty, error: "Text tip reports are turned off in Admin → Settings." };
    }
    if (!s.sms_from_number) {
      return { configured: true, ...empty, error: "Add a sending phone number in Admin → Settings." };
    }

    const { smsConfigured, sendSms } = await import("@/lib/sms.server");
    const configured = smsConfigured();

    const messages = buildShiftMessages(shift as unknown as MsgShift, s, (staff ?? []) as MsgStaff[], {
      establishmentName: s.establishment_name,
      includeBreakdown: s.sms_include_breakdown !== false,
    });

    if (!configured) {
      return {
        configured: false,
        sent: 0,
        skipped: messages.length,
        failed: 0,
        results: messages.map((m) => ({
          staff_id: m.staff_id,
          name: m.name,
          status: "skipped" as const,
          detail: "Waiting on a text-message provider",
        })),
        error: "No text-message provider is connected yet, so nothing was sent.",
      };
    }

    const results: SmsRecipientResult[] = [];
    const logRows: Record<string, unknown>[] = [];

    for (const m of messages) {
      if (!m.phone) {
        results.push({ staff_id: m.staff_id, name: m.name, status: "skipped", detail: "No valid phone number" });
        continue;
      }
      const res = await sendSms(m.phone, s.sms_from_number, m.body);
      results.push(
        res.ok
          ? { staff_id: m.staff_id, name: m.name, status: "sent" }
          : { staff_id: m.staff_id, name: m.name, status: "failed", detail: res.error },
      );
      logRows.push({
        location_id: locationId,
        shift_id: shift.id,
        staff_id: m.staff_id,
        phone: m.phone,
        body: m.body,
        status: res.ok ? "sent" : "failed",
        provider_sid: res.ok ? res.sid : null,
        error: res.ok ? null : res.error,
        sent_by: context.userId,
      });
    }

    if (logRows.length > 0) {
      const { error: logError } = await context.supabase.from("sms_sends").insert(logRows as never);
      if (logError) console.error("sms_sends log failed:", logError.message);
    }

    return {
      configured: true,
      sent: results.filter((r) => r.status === "sent").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    };
  });
