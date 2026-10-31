import { supabase } from "@/integrations/supabase/client";

/** The current user's establishment (first membership). */
export async function getMyLocationId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("location_members")
    .select("location_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  return data?.location_id ?? null;
}

/**
 * Settings row for the current establishment. RLS already scopes app_settings to
 * locations the user belongs to, so a single unfiltered row is safe and works
 * even before we know the location id.
 */
export async function loadMySettings() {
  const { data } = await supabase.from("app_settings").select("*").limit(1).maybeSingle();
  return data;
}

/**
 * Logos live in a private bucket keyed by `<location_id>/<file>`; anyone may read
 * them, so a long-lived signed URL is fine for display.
 */
export async function resolveLogoUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (value.startsWith("http")) return value;
  const { data } = await supabase.storage.from("logos").createSignedUrl(value, 60 * 60 * 24 * 365);
  return data?.signedUrl ?? null;
}

export type PayPeriodType = "weekly" | "biweekly" | "semimonthly" | "monthly";

export const PAY_PERIOD_LABELS: Record<PayPeriodType, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  semimonthly: "Twice a month (1st & 16th)",
  monthly: "Monthly",
};

const DAY = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s: string) => new Date(`${s}T00:00:00Z`);

/** Start/end (inclusive, YYYY-MM-DD) of the pay period containing `on`. */
export function payPeriodRange(
  type: PayPeriodType,
  anchor: string | null,
  on: Date = new Date(),
): { start: string; end: string } {
  const today = parse(iso(on));

  if (type === "monthly") {
    const s = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const e = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
    return { start: iso(s), end: iso(e) };
  }

  if (type === "semimonthly") {
    const y = today.getUTCFullYear();
    const m = today.getUTCMonth();
    if (today.getUTCDate() <= 15) {
      return { start: iso(new Date(Date.UTC(y, m, 1))), end: iso(new Date(Date.UTC(y, m, 15))) };
    }
    return { start: iso(new Date(Date.UTC(y, m, 16))), end: iso(new Date(Date.UTC(y, m + 1, 0))) };
  }

  const len = type === "weekly" ? 7 : 14;
  // Default anchor: the most recent Monday on/before today.
  let base: Date;
  if (anchor) {
    base = parse(anchor);
  } else {
    base = new Date(today);
    const dow = (base.getUTCDay() + 6) % 7; // Monday = 0
    base = new Date(base.getTime() - dow * DAY);
  }
  const diff = Math.floor((today.getTime() - base.getTime()) / DAY);
  const periods = Math.floor(diff / len);
  const start = new Date(base.getTime() + periods * len * DAY);
  const end = new Date(start.getTime() + (len - 1) * DAY);
  return { start: iso(start), end: iso(end) };
}

/** The pay period immediately before the one containing today. */
export function previousPayPeriod(type: PayPeriodType, anchor: string | null): { start: string; end: string } {
  const current = payPeriodRange(type, anchor);
  const dayBefore = new Date(parse(current.start).getTime() - DAY);
  return payPeriodRange(type, anchor, dayBefore);
}
