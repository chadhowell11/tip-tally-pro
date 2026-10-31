# Exact financial source appendix
Source captured 2026-10-31 UTC. Line numbers are citation annotations; remove the `NNNN | ` prefix before executing quoted code. No secret/config files included.

## `src/lib/calculations.ts`
```tsx
0001 | // Tip share math — mirrors the source spreadsheet exactly.
0002 | // All inputs in dollars (numbers). Rounded to cents for display, full precision in math.
0003 | 
0004 | export type RoundingMode = "none" | "nearest" | "up" | "down";
0005 | 
0006 | export const round2 = (n: number) => Math.round(n * 100) / 100;
0007 | 
0008 | export const roundCents = (n: number, mode: RoundingMode = "nearest") => {
0009 |   if (mode === "none") return Math.round(n * 100) / 100;
0010 |   if (mode === "up") return Math.ceil(n);
0011 |   if (mode === "down") return Math.floor(n);
0012 |   return Math.round(n);
0013 | };
0014 | 
0015 | const rm = (s: { rounding_mode?: RoundingMode }) => s.rounding_mode ?? "nearest";
0016 | 
0017 | export interface Settings {
0018 |   bar_tip_pct: number; // e.g. 0.05 (5% of LBW sales)
0019 |   runner_busser_tip_pct: number; // servers: e.g. 0.20 (20% of remaining tips)
0020 |   bartender_tip_pct: number; // bartenders: e.g. 0.10 (10% of credit tips)
0021 |   max_tipout_pct: number; // cap on total tip-out as fraction of credit tips, e.g. 0.30
0022 |   rb_basis?: "tips" | "sales"; // support tip-out taken from tips (default) or gross sales
0023 |   weight_runner: number;
0024 |   weight_busser: number;
0025 |   weight_bar_back: number;
0026 |   weight_hostess: number;
0027 |   rounding_mode?: RoundingMode; // how cents are rounded across payouts
0028 |   // Batch A toggles
0029 |   use_net_sales?: boolean; // if true, LBW sales entered are gross; strip tax before tip-out
0030 |   sales_tax_pct?: number; // e.g. 0.0875 (8.75%)
0031 |   cc_fee_enabled?: boolean; // if true, deduct processing fee from credit tips before calc
0032 |   cc_fee_pct?: number; // e.g. 0.03 (3%)
0033 | }
0034 | 
0035 | /** Apply net-sales + CC-fee toggles to raw inputs before tip-out math runs. */
0036 | function adjustInputs(lbw_sales: number, credit_tips: number, s: Settings, total_sales = 0) {
0037 |   const netSales = s.use_net_sales && (s.sales_tax_pct ?? 0) > 0
0038 |     ? lbw_sales / (1 + (s.sales_tax_pct ?? 0))
0039 |     : lbw_sales;
0040 |   const netTips = s.cc_fee_enabled && (s.cc_fee_pct ?? 0) > 0
0041 |     ? credit_tips * (1 - (s.cc_fee_pct ?? 0))
0042 |     : credit_tips;
0043 |   const netTotal = s.use_net_sales && (s.sales_tax_pct ?? 0) > 0
0044 |     ? total_sales / (1 + (s.sales_tax_pct ?? 0))
0045 |     : total_sales;
0046 |   return { lbw_sales: netSales, credit_tips: netTips, total_sales: netTotal };
0047 | }
0048 | 
0049 | 
0050 | export interface ServerRow {
0051 |   staff_id: string | null;
0052 |   cash_owed: number;
0053 |   credit_tips: number;
0054 |   lbw_sales: number;
0055 |   total_sales?: number;
0056 |   bar_tip_override?: number | null;
0057 |   rb_tip_override?: number | null;
0058 | }
0059 | 
0060 | export interface BartenderRow {
0061 |   staff_id: string | null;
0062 |   cash_owed: number;
0063 |   credit_tips: number;
0064 |   total_sales?: number;
0065 |   rb_tip_override?: number | null;
0066 | }
0067 | 
0068 | export type BartenderSplitMode = "single" | "equal" | "hours";
0069 | export interface BartenderMember {
0070 |   staff_id: string;
0071 |   hours_worked: number;
0072 | }
0073 | 
0074 | 
0075 | 
0076 | export type SupportRole = "runner" | "busser" | "bar_back" | "hostess";
0077 | export interface SupportRow {
0078 |   staff_id: string;
0079 |   role: SupportRole;
0080 |   hours_worked: number;
0081 | }
0082 | 
0083 | /** Apply max_tipout_pct cap: bar_tip + rb_tip cannot exceed cap × credit_tips.
0084 |  *  Support pool (runners/bussers/hostesses) is paid first; bar tip-out absorbs
0085 |  *  the cut so the support team never loses their share to the bar. */
0086 | function applyCap(bar_tip: number, rb_tip: number, credit_tips: number, cap: number) {
0087 |   const max = (cap > 0 ? cap : 1) * credit_tips;
0088 |   const total = bar_tip + rb_tip;
0089 |   if (total <= max) return { bar_tip, rb_tip, capped: false };
0090 |   // Pay R/B pool first, then bar gets whatever's left under the cap.
0091 |   const capped_rb = Math.min(rb_tip, max);
0092 |   const capped_bar = Math.max(0, max - capped_rb);
0093 |   return { bar_tip: round2(capped_bar), rb_tip: round2(capped_rb), capped: true };
0094 | }
0095 | 
0096 | export function calcServer(row: ServerRow, s: Settings) {
0097 |   const mode = rm(s);
0098 |   const adj = adjustInputs(row.lbw_sales, row.credit_tips, s, row.total_sales ?? 0);
0099 |   const rawBar = roundCents(adj.lbw_sales * s.bar_tip_pct, mode);
0100 |   const rbBase = s.rb_basis === "sales" ? adj.total_sales : Math.max(0, adj.credit_tips - rawBar);
0101 |   const rawRb = roundCents(rbBase * s.runner_busser_tip_pct, mode);
0102 |   const { bar_tip: capBar, rb_tip: capRb, capped } = applyCap(rawBar, rawRb, adj.credit_tips, s.max_tipout_pct);
0103 |   const bar_tip = row.bar_tip_override != null ? roundCents(row.bar_tip_override, mode) : roundCents(capBar, mode);
0104 |   const rb_tip = row.rb_tip_override != null ? roundCents(row.rb_tip_override, mode) : roundCents(capRb, mode);
0105 |   const takehome = roundCents(adj.credit_tips - bar_tip - rb_tip, mode);
0106 |   return { bar_tip, rb_tip, takehome, capped };
0107 | }
0108 | 
0109 | export function calcBartender(row: BartenderRow, serverBarTipsCollected: number, s: Settings) {
0110 |   const mode = rm(s);
0111 |   const adj = adjustInputs(0, row.credit_tips, s, row.total_sales ?? 0);
0112 |   const barBase = s.rb_basis === "sales" ? adj.total_sales : adj.credit_tips;
0113 |   const rawRb = roundCents(barBase * s.bartender_tip_pct, mode);
0114 |   const { rb_tip: capRb, capped } = applyCap(0, rawRb, adj.credit_tips, s.max_tipout_pct);
0115 |   const rb_tip = row.rb_tip_override != null ? roundCents(row.rb_tip_override, mode) : roundCents(capRb, mode);
0116 |   // Cash owed goes to the house, not the bartender.
0117 |   const takehome = roundCents(adj.credit_tips + serverBarTipsCollected - rb_tip, mode);
0118 |   return { rb_tip, takehome, collected_from_servers: serverBarTipsCollected, capped };
0119 | }
0120 | 
0121 | /** Split a bartender entry's payouts across one or more people.
0122 |  *  - "single": single bartender identified by entry.staff_id gets everything.
0123 |  *  - "equal": divide evenly across members.
0124 |  *  - "hours": weighted by hours_worked (falls back to equal if total hours = 0). */
0125 | export interface BartenderShare {
0126 |   staff_id: string;
0127 |   hours_worked: number;
0128 |   share: number;
0129 |   cash_owed: number;
0130 |   credit_tips: number;
0131 |   bar_from_servers: number;
0132 |   rb_tip: number;
0133 |   takehome: number;
0134 | }
0135 | export function splitBartenderShares(
0136 |   entry: { staff_id: string | null; cash_owed: number; credit_tips: number },
0137 |   entryCalc: { rb_tip: number; takehome: number; collected_from_servers: number },
0138 |   splitMode: BartenderSplitMode,
0139 |   members: BartenderMember[],
0140 | ): BartenderShare[] {
0141 |   if (splitMode === "single" || members.length === 0) {
0142 |     if (!entry.staff_id) return [];
0143 |     return [{
0144 |       staff_id: entry.staff_id, hours_worked: 0, share: 1,
0145 |       cash_owed: round2(entry.cash_owed),
0146 |       credit_tips: round2(entry.credit_tips),
0147 |       bar_from_servers: round2(entryCalc.collected_from_servers),
0148 |       rb_tip: round2(entryCalc.rb_tip),
0149 |       takehome: round2(entryCalc.takehome),
0150 |     }];
0151 |   }
0152 |   const totalHours = members.reduce((s, m) => s + (m.hours_worked || 0), 0);
0153 |   const shares = members.map((m) => {
0154 |     if (splitMode === "hours" && totalHours > 0) return (m.hours_worked || 0) / totalHours;
0155 |     return 1 / members.length;
0156 |   });
0157 |   return members.map((m, i) => ({
0158 |     staff_id: m.staff_id,
0159 |     hours_worked: m.hours_worked || 0,
0160 |     share: shares[i],
0161 |     cash_owed: round2(entry.cash_owed * shares[i]),
0162 |     credit_tips: round2(entry.credit_tips * shares[i]),
0163 |     bar_from_servers: round2(entryCalc.collected_from_servers * shares[i]),
0164 |     rb_tip: round2(entryCalc.rb_tip * shares[i]),
0165 |     takehome: round2(entryCalc.takehome * shares[i]),
0166 |   }));
0167 | }
0168 | 
0169 | /** Split a server entry ("split party" cash-out) across one or more servers.
0170 |  *  Same modes as bartenders: single / equal / hours. */
0171 | export interface ServerShare {
0172 |   staff_id: string;
0173 |   hours_worked: number;
0174 |   share: number;
0175 |   cash_owed: number;
0176 |   credit_tips: number;
0177 |   lbw_sales: number;
0178 |   bar_tip: number;
0179 |   rb_tip: number;
0180 |   takehome: number;
0181 | }
0182 | export function splitServerShares(
0183 |   entry: { staff_id: string | null; cash_owed: number; credit_tips: number; lbw_sales: number },
0184 |   entryCalc: { bar_tip: number; rb_tip: number; takehome: number },
0185 |   splitMode: BartenderSplitMode,
0186 |   members: BartenderMember[],
0187 | ): ServerShare[] {
0188 |   if (splitMode === "single" || members.length === 0) {
0189 |     if (!entry.staff_id) return [];
0190 |     return [{
0191 |       staff_id: entry.staff_id, hours_worked: 0, share: 1,
0192 |       cash_owed: round2(entry.cash_owed),
0193 |       credit_tips: round2(entry.credit_tips),
0194 |       lbw_sales: round2(entry.lbw_sales),
0195 |       bar_tip: round2(entryCalc.bar_tip),
0196 |       rb_tip: round2(entryCalc.rb_tip),
0197 |       takehome: round2(entryCalc.takehome),
0198 |     }];
0199 |   }
0200 |   const totalHours = members.reduce((s, m) => s + (m.hours_worked || 0), 0);
0201 |   const shares = members.map((m) => {
0202 |     if (splitMode === "hours" && totalHours > 0) return (m.hours_worked || 0) / totalHours;
0203 |     return 1 / members.length;
0204 |   });
0205 |   return members.map((m, i) => ({
0206 |     staff_id: m.staff_id,
0207 |     hours_worked: m.hours_worked || 0,
0208 |     share: shares[i],
0209 |     cash_owed: round2(entry.cash_owed * shares[i]),
0210 |     credit_tips: round2(entry.credit_tips * shares[i]),
0211 |     lbw_sales: round2(entry.lbw_sales * shares[i]),
0212 |     bar_tip: round2(entryCalc.bar_tip * shares[i]),
0213 |     rb_tip: round2(entryCalc.rb_tip * shares[i]),
0214 |     takehome: round2(entryCalc.takehome * shares[i]),
0215 |   }));
0216 | }
0217 | 
0218 | 
0219 | 
0220 | 
0221 | 
0222 | export type SupportSplitMode = "shared" | "weighted";
0223 | 
0224 | export function calcSupportPool(
0225 |   rows: SupportRow[],
0226 |   poolTotal: number,
0227 |   s: Settings,
0228 |   splitMode: SupportSplitMode = "weighted",
0229 | ): { staff_id: string; payout: number }[] {
0230 |   const mode = rm(s);
0231 |   if (splitMode === "shared") {
0232 |     if (rows.length === 0) return [];
0233 |     return rows.map((r) => ({ staff_id: r.staff_id, payout: roundCents(poolTotal / rows.length, mode) }));
0234 |   }
0235 |   const weightFor = (r: SupportRole) =>
0236 |     r === "runner" ? s.weight_runner
0237 |     : r === "busser" ? s.weight_busser
0238 |     : r === "hostess" ? s.weight_hostess
0239 |     : s.weight_bar_back;
0240 |   const totalWeighted = rows.reduce((sum, r) => sum + weightFor(r.role) * r.hours_worked, 0);
0241 |   if (totalWeighted <= 0) return rows.map((r) => ({ staff_id: r.staff_id, payout: 0 }));
0242 |   return rows.map((r) => ({
0243 |     staff_id: r.staff_id,
0244 |     payout: roundCents((poolTotal * (weightFor(r.role) * r.hours_worked)) / totalWeighted, mode),
0245 |   }));
0246 | }
0247 | 
0248 | 
0249 | /** Total tip pool fed to runners/bussers/bar backs from a shift. */
0250 | export function poolFromShift(
0251 |   servers: ServerRow[],
0252 |   bartenders: BartenderRow[],
0253 |   s: Settings,
0254 | ): number {
0255 |   const serverRB = servers.reduce((sum, r) => sum + calcServer(r, s).rb_tip, 0);
0256 |   const barRB = bartenders.reduce((sum, b) => sum + calcBartender(b, 0, s).rb_tip, 0);
0257 |   return round2(serverRB + barRB);
0258 | }
0259 | 
0260 | const SUPPORT_ROLE_SET = new Set<SupportRole>(["runner", "busser", "bar_back", "hostess"]);
0261 | 
0262 | /** Resolve the support position used for weighting.
0263 |  *  Prefers the position picked on the shift; falls back to the staff member's
0264 |  *  default role, and to "runner" when that isn't a support position. */
0265 | export function resolveSupportRole(
0266 |   shiftRole?: string | null,
0267 |   staffRole?: string | null,
0268 | ): SupportRole {
0269 |   if (shiftRole && SUPPORT_ROLE_SET.has(shiftRole as SupportRole)) return shiftRole as SupportRole;
0270 |   if (staffRole && SUPPORT_ROLE_SET.has(staffRole as SupportRole)) return staffRole as SupportRole;
0271 |   return "runner";
0272 | }
```

## `src/lib/location.ts`
```tsx
0001 | import { supabase } from "@/integrations/supabase/client";
0002 | 
0003 | /** The current user's establishment (first membership). */
0004 | export async function getMyLocationId(): Promise<string | null> {
0005 |   const { data: { user } } = await supabase.auth.getUser();
0006 |   if (!user) return null;
0007 |   const { data } = await supabase
0008 |     .from("location_members")
0009 |     .select("location_id")
0010 |     .eq("user_id", user.id)
0011 |     .limit(1)
0012 |     .maybeSingle();
0013 |   return data?.location_id ?? null;
0014 | }
0015 | 
0016 | /**
0017 |  * Settings row for the current establishment. RLS already scopes app_settings to
0018 |  * locations the user belongs to, so a single unfiltered row is safe and works
0019 |  * even before we know the location id.
0020 |  */
0021 | export async function loadMySettings() {
0022 |   const { data } = await supabase.from("app_settings").select("*").limit(1).maybeSingle();
0023 |   return data;
0024 | }
0025 | 
0026 | /**
0027 |  * Logos live in a private bucket keyed by `<location_id>/<file>`; anyone may read
0028 |  * them, so a long-lived signed URL is fine for display.
0029 |  */
0030 | export async function resolveLogoUrl(value: string | null | undefined): Promise<string | null> {
0031 |   if (!value) return null;
0032 |   if (value.startsWith("http")) return value;
0033 |   const { data } = await supabase.storage.from("logos").createSignedUrl(value, 60 * 60 * 24 * 365);
0034 |   return data?.signedUrl ?? null;
0035 | }
0036 | 
0037 | export type PayPeriodType = "weekly" | "biweekly" | "semimonthly" | "monthly";
0038 | 
0039 | export const PAY_PERIOD_LABELS: Record<PayPeriodType, string> = {
0040 |   weekly: "Weekly",
0041 |   biweekly: "Every 2 weeks",
0042 |   semimonthly: "Twice a month (1st & 16th)",
0043 |   monthly: "Monthly",
0044 | };
0045 | 
0046 | const DAY = 86400000;
0047 | const iso = (d: Date) => d.toISOString().slice(0, 10);
0048 | const parse = (s: string) => new Date(`${s}T00:00:00Z`);
0049 | 
0050 | /** Start/end (inclusive, YYYY-MM-DD) of the pay period containing `on`. */
0051 | export function payPeriodRange(
0052 |   type: PayPeriodType,
0053 |   anchor: string | null,
0054 |   on: Date = new Date(),
0055 | ): { start: string; end: string } {
0056 |   const today = parse(iso(on));
0057 | 
0058 |   if (type === "monthly") {
0059 |     const s = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
0060 |     const e = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
0061 |     return { start: iso(s), end: iso(e) };
0062 |   }
0063 | 
0064 |   if (type === "semimonthly") {
0065 |     const y = today.getUTCFullYear();
0066 |     const m = today.getUTCMonth();
0067 |     if (today.getUTCDate() <= 15) {
0068 |       return { start: iso(new Date(Date.UTC(y, m, 1))), end: iso(new Date(Date.UTC(y, m, 15))) };
0069 |     }
0070 |     return { start: iso(new Date(Date.UTC(y, m, 16))), end: iso(new Date(Date.UTC(y, m + 1, 0))) };
0071 |   }
0072 | 
0073 |   const len = type === "weekly" ? 7 : 14;
0074 |   // Default anchor: the most recent Monday on/before today.
0075 |   let base: Date;
0076 |   if (anchor) {
0077 |     base = parse(anchor);
0078 |   } else {
0079 |     base = new Date(today);
0080 |     const dow = (base.getUTCDay() + 6) % 7; // Monday = 0
0081 |     base = new Date(base.getTime() - dow * DAY);
0082 |   }
0083 |   const diff = Math.floor((today.getTime() - base.getTime()) / DAY);
0084 |   const periods = Math.floor(diff / len);
0085 |   const start = new Date(base.getTime() + periods * len * DAY);
0086 |   const end = new Date(start.getTime() + (len - 1) * DAY);
0087 |   return { start: iso(start), end: iso(end) };
0088 | }
0089 | 
0090 | /** The pay period immediately before the one containing today. */
0091 | export function previousPayPeriod(type: PayPeriodType, anchor: string | null): { start: string; end: string } {
0092 |   const current = payPeriodRange(type, anchor);
0093 |   const dayBefore = new Date(parse(current.start).getTime() - DAY);
0094 |   return payPeriodRange(type, anchor, dayBefore);
0095 | }
```

## `src/lib/shift-messages.ts`
```tsx
0001 | // Builds the per-person tip-report text message for a shift.
0002 | // Pure module — safe to import from both the browser and server functions.
0003 | 
0004 | import {
0005 |   calcBartender,
0006 |   calcServer,
0007 |   calcSupportPool,
0008 |   poolFromShift,
0009 |   round2,
0010 |   splitBartenderShares,
0011 |   splitServerShares,
0012 |   type BartenderSplitMode,
0013 |   type Settings,
0014 |   type SupportRole,
0015 |   resolveSupportRole,
0016 | } from "@/lib/calculations";
0017 | 
0018 | export type MsgStaff = {
0019 |   id: string;
0020 |   name: string;
0021 |   server_number: string | null;
0022 |   phone: string | null;
0023 |   role: string;
0024 | };
0025 | 
0026 | export type MsgShift = {
0027 |   id: string;
0028 |   shift_date: string;
0029 |   period: "AM" | "PM";
0030 |   shift_servers: {
0031 |     staff_id: string | null;
0032 |     split_mode?: BartenderSplitMode | null;
0033 |     shift_server_members?: { staff_id: string; hours_worked: number }[];
0034 |     cash_owed: number;
0035 |     credit_tips: number;
0036 |     lbw_sales: number;
0037 |     bar_tip_override: number | null;
0038 |     rb_tip_override: number | null;
0039 |   }[];
0040 |   shift_bartenders: {
0041 |     staff_id: string | null;
0042 |     cash_owed: number;
0043 |     credit_tips: number;
0044 |     rb_tip_override: number | null;
0045 |     split_mode: BartenderSplitMode | null;
0046 |     shift_bartender_members: { staff_id: string; hours_worked: number }[];
0047 |   }[];
0048 |   support_split_mode?: string | null;
0049 |   shift_support: { staff_id: string; hours_worked: number; role?: string | null }[];
0050 | };
0051 | 
0052 | export type ShiftMessage = {
0053 |   staff_id: string;
0054 |   name: string;
0055 |   phone: string | null;
0056 |   body: string;
0057 | };
0058 | 
0059 | const money = (n: number) => `$${n.toFixed(2)}`;
0060 | 
0061 | /** Digits-only E.164 normalization for US-style 10/11-digit numbers. */
0062 | export function normalizePhone(raw: string | null | undefined): string | null {
0063 |   if (!raw) return null;
0064 |   const trimmed = raw.trim();
0065 |   if (trimmed.startsWith("+")) {
0066 |     const rest = trimmed.slice(1).replace(/\D/g, "");
0067 |     return rest.length >= 8 ? `+${rest}` : null;
0068 |   }
0069 |   const digits = trimmed.replace(/\D/g, "");
0070 |   if (digits.length === 10) return `+1${digits}`;
0071 |   if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
0072 |   return null;
0073 | }
0074 | 
0075 | export function buildShiftMessages(
0076 |   shift: MsgShift,
0077 |   settings: Settings,
0078 |   staff: MsgStaff[],
0079 |   opts: { establishmentName?: string | null; includeBreakdown?: boolean } = {},
0080 | ): ShiftMessage[] {
0081 |   const byId = new Map(staff.map((s) => [s.id, s]));
0082 |   const includeBreakdown = opts.includeBreakdown !== false;
0083 |   const header = `${opts.establishmentName || "Tip Share"} — ${shift.shift_date} ${shift.period}`;
0084 |   const out: ShiftMessage[] = [];
0085 | 
0086 |   const push = (staff_id: string, lines: string[], takehome: number) => {
0087 |     const s = byId.get(staff_id);
0088 |     if (!s) return;
0089 |     const body = includeBreakdown
0090 |       ? `${header}\n${s.name}\n${lines.join("\n")}\nTake-home: ${money(takehome)}`
0091 |       : `${header}\n${s.name}\nTake-home: ${money(takehome)}`;
0092 |     out.push({ staff_id, name: s.name, phone: normalizePhone(s.phone), body });
0093 |   };
0094 | 
0095 |   // Servers
0096 |   for (const sv of shift.shift_servers) {
0097 |     const c = calcServer(sv, settings);
0098 |     const shares = splitServerShares(
0099 |       sv,
0100 |       { bar_tip: c.bar_tip, rb_tip: c.rb_tip, takehome: c.takehome },
0101 |       sv.split_mode ?? "single",
0102 |       sv.shift_server_members ?? [],
0103 |     );
0104 |     for (const share of shares) {
0105 |       push(
0106 |         share.staff_id,
0107 |         [
0108 |           `Credit tips: ${money(share.credit_tips)}`,
0109 |           `Cash owed to house: ${money(share.cash_owed)}`,
0110 |           `Bar tip-out: -${money(share.bar_tip)}`,
0111 |           `Support tip-out: -${money(share.rb_tip)}`,
0112 |         ],
0113 |         share.takehome,
0114 |       );
0115 |     }
0116 |   }
0117 | 
0118 |   // Bartenders (single or shared cash-outs)
0119 |   const serverBarTotal = shift.shift_servers.reduce((s, sv) => s + calcServer(sv, settings).bar_tip, 0);
0120 |   const btCount = Math.max(shift.shift_bartenders.length, 1);
0121 |   for (const bt of shift.shift_bartenders) {
0122 |     const collected = round2(serverBarTotal / btCount);
0123 |     const c = calcBartender(bt, collected, settings);
0124 |     const shares = splitBartenderShares(
0125 |       bt,
0126 |       { rb_tip: c.rb_tip, takehome: c.takehome, collected_from_servers: collected },
0127 |       bt.split_mode ?? "single",
0128 |       bt.shift_bartender_members ?? [],
0129 |     );
0130 |     for (const sh of shares) {
0131 |       push(
0132 |         sh.staff_id,
0133 |         [
0134 |           `Credit tips: ${money(sh.credit_tips)}`,
0135 |           `From servers: ${money(sh.bar_from_servers)}`,
0136 |           `Cash owed to house: ${money(sh.cash_owed)}`,
0137 |           `Support tip-out: -${money(sh.rb_tip)}`,
0138 |         ],
0139 |         sh.takehome,
0140 |       );
0141 |     }
0142 |   }
0143 | 
0144 |   // Support pool
0145 |   const pool = poolFromShift(shift.shift_servers, shift.shift_bartenders, settings);
0146 |   const supportRows = shift.shift_support.map((sp) => ({
0147 |     staff_id: sp.staff_id,
0148 |     role: resolveSupportRole(sp.role, byId.get(sp.staff_id)?.role),
0149 |     hours_worked: sp.hours_worked,
0150 |   }));
0151 |   const payouts = calcSupportPool(supportRows, pool, settings, shift.support_split_mode === "shared" ? "shared" : "weighted");
0152 |   for (const sp of shift.shift_support) {
0153 |     const payout = payouts.find((p) => p.staff_id === sp.staff_id)?.payout ?? 0;
0154 |     push(sp.staff_id, [`Hours: ${sp.hours_worked.toFixed(2)}`, `Tip pool share: ${money(payout)}`], payout);
0155 |   }
0156 | 
0157 |   return out;
0158 | }
```

## `src/routes/_authenticated/reports.tsx`
```tsx
0001 | import { createFileRoute, Link } from "@tanstack/react-router";
0002 | import { useEffect, useMemo, useRef, useState } from "react";
0003 | import { supabase } from "@/integrations/supabase/client";
0004 | import { printElement, printHtmlFromClick } from "@/lib/print";
0005 | import { downloadTextFile } from "@/lib/download";
0006 | import { type PayPeriodType, payPeriodRange, previousPayPeriod } from "@/lib/location";
0007 | import { useBrand } from "@/lib/brand";
0008 | import {
0009 |   calcServer,
0010 |   calcBartender,
0011 |   calcSupportPool,
0012 |   poolFromShift,
0013 |   round2,
0014 |   splitBartenderShares,
0015 |   splitServerShares,
0016 |   type BartenderSplitMode,
0017 |   type Settings,
0018 |   type SupportRole,
0019 |   resolveSupportRole,
0020 | } from "@/lib/calculations";
0021 | 
0022 | 
0023 | export const Route = createFileRoute("/_authenticated/reports")({
0024 |   head: () => ({ meta: [{ title: "Reports · Tip Share" }] }),
0025 |   component: ReportsPage,
0026 | });
0027 | 
0028 | type Staff = { id: string; name: string; server_number: string | null; role: string };
0029 | type ShiftRow = {
0030 |   id: string;
0031 |   shift_date: string;
0032 |   period: "AM" | "PM";
0033 |   shift_servers: { staff_id: string | null; cash_owed: number; credit_tips: number; lbw_sales: number; bar_tip_override: number | null; rb_tip_override: number | null; split_mode?: BartenderSplitMode | null; shift_server_members?: { staff_id: string; hours_worked: number }[] }[];
0034 |   shift_bartenders: {
0035 |     staff_id: string | null;
0036 |     cash_owed: number;
0037 |     credit_tips: number;
0038 |     rb_tip_override: number | null;
0039 |     split_mode: BartenderSplitMode;
0040 |     shift_bartender_members: { staff_id: string; hours_worked: number }[];
0041 |   }[];
0042 | 
0043 | 
0044 |   support_split_mode?: string | null;
0045 |   shift_support: { staff_id: string; hours_worked: number; role?: string | null }[];
0046 | };
0047 | 
0048 | type Totals = {
0049 |   shifts: number;
0050 |   hours: number;
0051 |   cash_owed: number;
0052 |   credit_tips: number;
0053 |   lbw_sales: number;
0054 |   bar_tip_out: number;
0055 |   rb_tip_out: number;
0056 |   rb_received: number;
0057 |   bar_from_servers: number;
0058 |   takehome: number;
0059 | };
0060 | 
0061 | const empty = (): Totals => ({
0062 |   shifts: 0, hours: 0, cash_owed: 0, credit_tips: 0, lbw_sales: 0,
0063 |   bar_tip_out: 0, rb_tip_out: 0, rb_received: 0, bar_from_servers: 0, takehome: 0,
0064 | });
0065 | 
0066 | /** Total tips flowing to a person before tip-outs. */
0067 | const totalTips = (t: Totals) => t.credit_tips + t.bar_from_servers + t.rb_received;
0068 | 
0069 | /** Take-home as a % of total tips; null when there are no tips. */
0070 | const takePct = (t: Totals) => {
0071 |   const tips = totalTips(t);
0072 |   return tips > 0 ? (t.takehome / tips) * 100 : null;
0073 | };
0074 | 
0075 | 
0076 | 
0077 | type SettingsWithPeriod = Settings & { pay_period_type?: PayPeriodType; pay_period_anchor?: string | null; establishment_name?: string; logo_url?: string | null };
0078 | 
0079 | function ReportsPage() {
0080 |   const today = new Date().toISOString().slice(0, 10);
0081 |   const fourteen = new Date(Date.now() - 13 * 86400_000).toISOString().slice(0, 10);
0082 |   const [from, setFrom] = useState(fourteen);
0083 |   const [to, setTo] = useState(today);
0084 |   const [staff, setStaff] = useState<Staff[]>([]);
0085 |   const [positions, setPositions] = useState<Record<string, string[]>>({});
0086 |   const [settings, setSettings] = useState<SettingsWithPeriod | null>(null);
0087 |   const brand = useBrand(settings?.logo_url);
0088 |   const [shifts, setShifts] = useState<ShiftRow[]>([]);
0089 |   const [loading, setLoading] = useState(false);
0090 |   const [reportError, setReportError] = useState<string | null>(null);
0091 |   const [reloadKey, setReloadKey] = useState(0);
0092 |   const [printMode, setPrintMode] = useState<"all" | "slips">("all");
0093 |   const [printOnly, setPrintOnly] = useState<string | null>(null);
0094 | 
0095 |   const [pendingPrint, setPendingPrint] = useState(false);
0096 |   const mainRef = useRef<HTMLElement>(null);
0097 |   const slipsRef = useRef<HTMLDivElement>(null);
0098 | 
0099 |   // Individual sheets print straight from the click (markup is always mounted,
0100 |   // just hidden), so no popup blocker / async-gesture issues.
0101 |   function printSlips() {
0102 |     const el = slipsRef.current;
0103 |     if (!el) return;
0104 |     printHtmlFromClick(el.innerHTML, "Payroll Sheets");
0105 |   }
0106 | 
0107 |   function runPrint(mode: "all" | "slips", staffId?: string | null) {
0108 |     setPrintMode(mode);
0109 |     setPrintOnly(staffId ?? null);
0110 |     setPendingPrint(true);
0111 |   }
0112 | 
0113 |   // Print only after the slip markup has actually painted, and keep it mounted
0114 |   // until the browser's print dialog closes (afterprint).
0115 |   useEffect(() => {
0116 |     if (!pendingPrint) return;
0117 |     let raf2 = 0;
0118 |     const done = () => {
0119 |       setPendingPrint(false);
0120 |       setPrintMode("all");
0121 |     };
0122 |     window.addEventListener("afterprint", done);
0123 |     const raf1 = requestAnimationFrame(() => {
0124 |       raf2 = requestAnimationFrame(() => {
0125 |         printElement(mainRef.current, "Payroll Report");
0126 |         // Safari/older browsers may never fire afterprint.
0127 |         setTimeout(() => setPendingPrint(false), 1000);
0128 |       });
0129 |     });
0130 |     return () => {
0131 |       cancelAnimationFrame(raf1);
0132 |       cancelAnimationFrame(raf2);
0133 |       window.removeEventListener("afterprint", done);
0134 |     };
0135 |   }, [pendingPrint]);
0136 | 
0137 | 
0138 | 
0139 |   useEffect(() => {
0140 |     let cancelled = false;
0141 |     Promise.all([
0142 |       supabase.from("staff").select("id, name, server_number, role"),
0143 |       supabase.from("app_settings").select("*").limit(1).maybeSingle(),
0144 |       supabase.from("staff_positions").select("staff_id, position"),
0145 |     ]).then(([s, st, sp]) => {
0146 |       if (cancelled) return;
0147 |       const error = s.error ?? st.error ?? sp.error;
0148 |       if (error) {
0149 |         setReportError("The payroll setup could not be loaded. Please try again.");
0150 |         return;
0151 |       }
0152 |       setStaff((s.data ?? []) as Staff[]);
0153 |       setSettings(st.data as SettingsWithPeriod | null);
0154 |       const map: Record<string, string[]> = {};
0155 |       for (const row of (sp.data ?? []) as { staff_id: string; position: string }[]) {
0156 |         (map[row.staff_id] ??= []).push(row.position);
0157 |       }
0158 |       setPositions(map);
0159 |       setReportError(null);
0160 |     }).catch(() => {
0161 |       if (!cancelled) setReportError("The payroll setup could not be loaded. Please try again.");
0162 |     });
0163 |     return () => { cancelled = true; };
0164 |   }, [reloadKey]);
0165 | 
0166 | 
0167 |   const reqSeq = useRef(0);
0168 |   useEffect(() => {
0169 |     // Ignore incomplete/invalid dates while typing in the date inputs.
0170 |     const valid = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number(d.slice(0, 4)) > 1900;
0171 |     if (!valid(from) || !valid(to) || from > to) return;
0172 |     const seq = ++reqSeq.current;
0173 |     setLoading(true);
0174 |     setReportError(null);
0175 |     void (async () => {
0176 |       try {
0177 |         const { data, error } = await supabase
0178 |           .from("shifts")
0179 |           .select("id, shift_date, period, shift_servers(staff_id, cash_owed, credit_tips, lbw_sales, bar_tip_override, rb_tip_override, split_mode, shift_server_members(staff_id, hours_worked)), shift_bartenders(staff_id, cash_owed, credit_tips, rb_tip_override, split_mode, shift_bartender_members(staff_id, hours_worked)), shift_support(staff_id, hours_worked, role), support_split_mode")
0180 |           .gte("shift_date", from)
0181 |           .lte("shift_date", to)
0182 |           .order("shift_date");
0183 |         // Drop out-of-order responses so a slow older range can't overwrite newer results.
0184 |         if (seq !== reqSeq.current) return;
0185 |         if (error) {
0186 |           setReportError("The payroll records could not be loaded. Please try again.");
0187 |           setLoading(false);
0188 |           return;
0189 |         }
0190 |         const safeShifts = (data ?? []).map((shift) => ({
0191 |           ...shift,
0192 |           shift_servers: shift.shift_servers ?? [],
0193 |           shift_bartenders: shift.shift_bartenders ?? [],
0194 |           shift_support: shift.shift_support ?? [],
0195 |         }));
0196 |         setShifts(safeShifts as unknown as ShiftRow[]);
0197 |         setLoading(false);
0198 |       } catch {
0199 |         if (seq !== reqSeq.current) return;
0200 |         setReportError("The payroll records could not be loaded. Please try again.");
0201 |         setLoading(false);
0202 |       }
0203 |     })();
0204 |   }, [from, to, reloadKey]);
0205 | 
0206 |   const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
0207 | 
0208 |   const totalsByStaff = useMemo(() => {
0209 |     const map = new Map<string, Totals>();
0210 |     if (!settings) return map;
0211 |     const bump = (id: string, patch: Partial<Totals>) => {
0212 |       const t = map.get(id) ?? empty();
0213 |       for (const k in patch) (t as any)[k] += (patch as any)[k] ?? 0;
0214 |       map.set(id, t);
0215 |     };
0216 |     for (const sh of shifts) {
0217 |       const shiftStaffSeen = new Set<string>();
0218 |       for (const sv of sh.shift_servers) {
0219 |         const c = calcServer(sv, settings);
0220 |         const shares = splitServerShares(
0221 |           sv,
0222 |           { bar_tip: c.bar_tip, rb_tip: c.rb_tip, takehome: c.takehome },
0223 |           sv.split_mode ?? "single",
0224 |           sv.shift_server_members ?? [],
0225 |         );
0226 |         for (const share of shares) {
0227 |           bump(share.staff_id, {
0228 |             cash_owed: share.cash_owed, credit_tips: share.credit_tips, lbw_sales: share.lbw_sales,
0229 |             bar_tip_out: share.bar_tip, rb_tip_out: share.rb_tip, takehome: share.takehome,
0230 |           });
0231 |           shiftStaffSeen.add(share.staff_id);
0232 |         }
0233 |       }
0234 |       // bartenders: collect server bar tips
0235 |       const serverBarTotal = sh.shift_servers.reduce((s, sv) => s + calcServer(sv, settings).bar_tip, 0);
0236 |       const bartenderCount = Math.max(sh.shift_bartenders.length, 1);
0237 |       for (const bt of sh.shift_bartenders) {
0238 |         const collected = round2(serverBarTotal / bartenderCount);
0239 |         const c = calcBartender(bt, collected, settings);
0240 |         const shares = splitBartenderShares(
0241 |           bt,
0242 |           { rb_tip: c.rb_tip, takehome: c.takehome, collected_from_servers: collected },
0243 |           bt.split_mode ?? "single",
0244 |           bt.shift_bartender_members ?? [],
0245 |         );
0246 |         for (const share of shares) {
0247 |           bump(share.staff_id, {
0248 |             cash_owed: share.cash_owed,
0249 |             credit_tips: share.credit_tips,
0250 |             bar_from_servers: share.bar_from_servers,
0251 |             rb_tip_out: share.rb_tip,
0252 |             takehome: share.takehome,
0253 |           });
0254 |           shiftStaffSeen.add(share.staff_id);
0255 |         }
0256 | 
0257 |       }
0258 | 
0259 | 
0260 |       // support pool
0261 |       const pool = poolFromShift(sh.shift_servers, sh.shift_bartenders, settings);
0262 |       const supportRows = sh.shift_support.map((sp) => ({
0263 |         staff_id: sp.staff_id,
0264 |         role: resolveSupportRole(sp.role, staffById.get(sp.staff_id)?.role),
0265 |         hours_worked: sp.hours_worked,
0266 |       }));
0267 |       const payouts = calcSupportPool(supportRows, pool, settings, (sh.support_split_mode === "shared" ? "shared" : "weighted"));
0268 |       for (const sp of sh.shift_support) {
0269 |         const payout = payouts.find((p) => p.staff_id === sp.staff_id)?.payout ?? 0;
0270 |         bump(sp.staff_id, { hours: sp.hours_worked, rb_received: payout, takehome: payout });
0271 |         shiftStaffSeen.add(sp.staff_id);
0272 |       }
0273 |       for (const id of shiftStaffSeen) bump(id, { shifts: 1 });
0274 |     }
0275 |     return map;
0276 |   }, [shifts, settings, staffById]);
0277 | 
0278 |   /** Per-person, per-day (and period) breakdown used by the individual print sheets. */
0279 |   const dayRowsByStaff = useMemo(() => {
0280 |     const out = new Map<string, { date: string; period: string; totals: Totals }[]>();
0281 |     if (!settings) return out;
0282 |     for (const sh of shifts) {
0283 |       const perStaff = new Map<string, Totals>();
0284 |       const bump = (id: string, patch: Partial<Totals>) => {
0285 |         const t = perStaff.get(id) ?? empty();
0286 |         for (const k in patch) (t as any)[k] += (patch as any)[k] ?? 0;
0287 |         perStaff.set(id, t);
0288 |       };
0289 |       for (const sv of sh.shift_servers) {
0290 |         const c = calcServer(sv, settings);
0291 |         const shares = splitServerShares(
0292 |           sv,
0293 |           { bar_tip: c.bar_tip, rb_tip: c.rb_tip, takehome: c.takehome },
0294 |           sv.split_mode ?? "single",
0295 |           sv.shift_server_members ?? [],
0296 |         );
0297 |         for (const share of shares) {
0298 |           bump(share.staff_id, {
0299 |             cash_owed: share.cash_owed, credit_tips: share.credit_tips, lbw_sales: share.lbw_sales,
0300 |             bar_tip_out: share.bar_tip, rb_tip_out: share.rb_tip, takehome: share.takehome,
0301 |           });
0302 |         }
0303 |       }
0304 |       const serverBarTotal = sh.shift_servers.reduce((s, sv) => s + calcServer(sv, settings).bar_tip, 0);
0305 |       const bartenderCount = Math.max(sh.shift_bartenders.length, 1);
0306 |       for (const bt of sh.shift_bartenders) {
0307 |         const collected = round2(serverBarTotal / bartenderCount);
0308 |         const c = calcBartender(bt, collected, settings);
0309 |         const shares = splitBartenderShares(
0310 |           bt,
0311 |           { rb_tip: c.rb_tip, takehome: c.takehome, collected_from_servers: collected },
0312 |           bt.split_mode ?? "single",
0313 |           bt.shift_bartender_members ?? [],
0314 |         );
0315 |         for (const share of shares) {
0316 |           bump(share.staff_id, {
0317 |             cash_owed: share.cash_owed, credit_tips: share.credit_tips,
0318 |             bar_from_servers: share.bar_from_servers, rb_tip_out: share.rb_tip, takehome: share.takehome,
0319 |           });
0320 |         }
0321 |       }
0322 |       const pool = poolFromShift(sh.shift_servers, sh.shift_bartenders, settings);
0323 |       const supportRows = sh.shift_support.map((sp) => ({
0324 |         staff_id: sp.staff_id,
0325 |         role: resolveSupportRole(sp.role, staffById.get(sp.staff_id)?.role),
0326 |         hours_worked: sp.hours_worked,
0327 |       }));
0328 |       const payouts = calcSupportPool(supportRows, pool, settings, (sh.support_split_mode === "shared" ? "shared" : "weighted"));
0329 |       for (const sp of sh.shift_support) {
0330 |         const payout = payouts.find((p) => p.staff_id === sp.staff_id)?.payout ?? 0;
0331 |         bump(sp.staff_id, { hours: sp.hours_worked, rb_received: payout, takehome: payout });
0332 |       }
0333 |       for (const [id, t] of perStaff) {
0334 |         t.shifts = 1;
0335 |         (out.get(id) ?? out.set(id, []).get(id)!).push({ date: sh.shift_date, period: sh.period, totals: t });
0336 |       }
0337 |     }
0338 |     for (const list of out.values()) {
0339 |       list.sort((a, b) => (a.date === b.date ? a.period.localeCompare(b.period) : a.date.localeCompare(b.date)));
0340 |     }
0341 |     return out;
0342 |   }, [shifts, settings, staffById]);
0343 | 
0344 |   const rows = useMemo(() => {
0345 |     return Array.from(totalsByStaff.entries())
0346 |       .map(([id, t]) => ({ staff: staffById.get(id), totals: t }))
0347 |       .filter((r) => r.staff)
0348 |       .sort((a, b) => (a.staff!.name ?? "").localeCompare(b.staff!.name ?? ""));
0349 |   }, [totalsByStaff, staffById]);
0350 | 
0351 |   const visibleRows = useMemo(
0352 |     () => (printOnly ? rows.filter((r) => r.staff!.id === printOnly) : rows),
0353 |     [rows, printOnly],
0354 |   );
0355 | 
0356 | 
0357 | 
0358 |   const grand = useMemo(() => {
0359 |     const t = empty();
0360 |     for (const r of rows) {
0361 |       t.shifts += r.totals.shifts;
0362 |       t.hours += r.totals.hours;
0363 |       t.cash_owed += r.totals.cash_owed;
0364 |       t.credit_tips += r.totals.credit_tips;
0365 |       t.lbw_sales += r.totals.lbw_sales;
0366 |       t.bar_tip_out += r.totals.bar_tip_out;
0367 |       t.rb_tip_out += r.totals.rb_tip_out;
0368 |       t.rb_received += r.totals.rb_received;
0369 |       t.bar_from_servers += r.totals.bar_from_servers;
0370 |       t.takehome += r.totals.takehome;
0371 |     }
0372 |     return t;
0373 |   }, [rows]);
0374 | 
0375 |   function downloadCSV() {
0376 |     const headers = [
0377 |       "Date From", "Date To", "Name", "Server #", "Role", "Shifts", "Hours",
0378 |       "Cash Owed", "Credit Tips", "Tips From Servers (Bar)", "LBW Sales",
0379 |       "Bar Tip Out", "R/B Tip Out", "R/B Received", "Take-Home", "Total Tips", "Take-Home %",
0380 |     ];
0381 |     const lines = [headers.join(",")];
0382 |     for (const r of rows) {
0383 |       const s = r.staff!;
0384 |       const t = r.totals;
0385 |       const p = takePct(t);
0386 |       const row = [
0387 |         from, to,
0388 |         csvEsc(s.name),
0389 |         s.server_number ?? "",
0390 |         csvEsc(roleLabel(s, positions)),
0391 |         t.shifts, t.hours.toFixed(2),
0392 |         t.cash_owed.toFixed(2), t.credit_tips.toFixed(2),
0393 |         t.bar_from_servers.toFixed(2),
0394 |         t.lbw_sales.toFixed(2),
0395 |         t.bar_tip_out.toFixed(2), t.rb_tip_out.toFixed(2), t.rb_received.toFixed(2), t.takehome.toFixed(2),
0396 |         totalTips(t).toFixed(2), p === null ? "" : p.toFixed(1),
0397 |       ];
0398 |       lines.push(row.join(","));
0399 |     }
0400 |     const gp = takePct(grand);
0401 |     lines.push([
0402 |       from, to, "TOTAL", "", "",
0403 |       grand.shifts, grand.hours.toFixed(2),
0404 |       grand.cash_owed.toFixed(2), grand.credit_tips.toFixed(2),
0405 |       grand.bar_from_servers.toFixed(2),
0406 |       grand.lbw_sales.toFixed(2),
0407 |       grand.bar_tip_out.toFixed(2), grand.rb_tip_out.toFixed(2),
0408 |       grand.rb_received.toFixed(2), grand.takehome.toFixed(2),
0409 |       totalTips(grand).toFixed(2), gp === null ? "" : gp.toFixed(1),
0410 |     ].join(","));
0411 | 
0412 | 
0413 | 
0414 |     downloadTextFile(lines.join("\n"), `tip-share_${from}_to_${to}.csv`);
0415 |   }
0416 | 
0417 |   return (
0418 |     <div className="min-h-screen bg-background">
0419 |       <header className="sticky top-0 bg-background border-b border-border z-10 print:hidden">
0420 |         <div className="max-w-5xl mx-auto p-4 flex items-center gap-3">
0421 |           <Link to="/" className="text-sm text-muted-foreground">← Home</Link>
0422 |           <h1 className="text-lg font-serif flex-1">Payroll Report</h1>
0423 |         </div>
0424 |       </header>
0425 | 
0426 |       <main ref={mainRef} className="max-w-5xl mx-auto p-4 space-y-4">
0427 |         <section className="print:hidden flex flex-wrap gap-2">
0428 |           <button
0429 |             onClick={() => { const r = payPeriodRange(settings?.pay_period_type ?? "biweekly", settings?.pay_period_anchor ?? null); setFrom(r.start); setTo(r.end); }}
0430 |             className="h-9 px-3 rounded-md border border-input text-sm"
0431 |           >
0432 |             This pay period
0433 |           </button>
0434 |           <button
0435 |             onClick={() => { const r = previousPayPeriod(settings?.pay_period_type ?? "biweekly", settings?.pay_period_anchor ?? null); setFrom(r.start); setTo(r.end); }}
0436 |             className="h-9 px-3 rounded-md border border-input text-sm"
0437 |           >
0438 |             Last pay period
0439 |           </button>
0440 |         </section>
0441 |         <section className="bg-card border border-border rounded-lg p-4 grid grid-cols-1 md:grid-cols-3 gap-3 print:hidden">
0442 |           <div>
0443 |             <label className="text-xs uppercase tracking-wide text-muted-foreground">From</label>
0444 |             <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3" />
0445 |           </div>
0446 |           <div>
0447 |             <label className="text-xs uppercase tracking-wide text-muted-foreground">To</label>
0448 |             <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3" />
0449 |           </div>
0450 |           <div className="flex items-end gap-2">
0451 |             <button onClick={downloadCSV} className="flex-1 h-11 rounded-md bg-primary text-primary-foreground font-medium">
0452 |               Download CSV
0453 |             </button>
0454 |             <button onClick={() => runPrint("all")} className="h-11 px-4 rounded-md border border-input">Print all</button>
0455 |           </div>
0456 |         </section>
0457 | 
0458 |         {reportError && (
0459 |           <section className="border border-destructive/40 bg-destructive/10 p-4 print:hidden" role="alert">
0460 |             <p className="text-sm text-destructive">{reportError}</p>
0461 |             <button
0462 |               type="button"
0463 |               onClick={() => setReloadKey((value) => value + 1)}
0464 |               className="mt-3 h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
0465 |             >
0466 |               Try again
0467 |             </button>
0468 |           </section>
0469 |         )}
0470 | 
0471 |         <section className="bg-card border border-border rounded-lg p-4 flex flex-wrap items-end gap-3 print:hidden">
0472 |           <div className="flex-1 min-w-[200px]">
0473 |             <label className="text-xs uppercase tracking-wide text-muted-foreground">Print individually</label>
0474 |             <select
0475 |               value={printOnly ?? ""}
0476 |               onChange={(e) => setPrintOnly(e.target.value || null)}
0477 |               className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3"
0478 |             >
0479 |               <option value="">Everyone — one page per person</option>
0480 |               {rows.map((r) => (
0481 |                 <option key={r.staff!.id} value={r.staff!.id}>
0482 |                   {r.staff!.name}{r.staff!.server_number ? ` (#${r.staff!.server_number})` : ""}
0483 |                 </option>
0484 |               ))}
0485 |             </select>
0486 |           </div>
0487 |           <button
0488 |             onClick={printSlips}
0489 |             disabled={rows.length === 0}
0490 |             className="h-11 px-5 rounded-md border border-input font-medium disabled:opacity-50"
0491 |           >
0492 |             Print individual sheets
0493 |           </button>
0494 |           {printOnly && (
0495 |             <button
0496 |               onClick={() => setPrintOnly(null)}
0497 |               className="h-11 px-4 rounded-md border border-input text-sm"
0498 |             >
0499 |               Show everyone
0500 |             </button>
0501 |           )}
0502 |           {printOnly && (
0503 |             <p className="w-full text-xs text-muted-foreground">
0504 |               Showing {staffById.get(printOnly)?.name ?? "selected person"} only — the table below is filtered to match what will print.
0505 |             </p>
0506 |           )}
0507 |         </section>
0508 | 
0509 |         <p className="text-xs text-muted-foreground print:hidden">
0510 |           CSV is plain comma-separated — your CPA can map columns into QuickBooks (Journal Entry, Bills, or Payroll import) on their end.
0511 |         </p>
0512 | 
0513 |         <section className="bg-card border border-border rounded-lg p-6 text-center print-header" style={{ borderTop: `4px solid ${brand.primary}` }}>
0514 |           {brand.logoUrl && <img src={brand.logoUrl} alt="" className="mx-auto h-24 max-w-[240px] object-contain mb-3" />}
0515 |           <h2 className="text-2xl font-serif" style={{ color: brand.primary }}>{settings?.establishment_name || "Payroll Report"}</h2>
0516 |           <p className="text-sm mt-1" style={{ color: brand.accent }}>Tip Payroll Statement · {from} to {to}</p>
0517 |         </section>
0518 | 
0519 |         <div ref={slipsRef} className="hidden" aria-hidden="true">
0520 |           <div>
0521 |             {rows
0522 |               .filter((r) => !printOnly || r.staff!.id === printOnly)
0523 |               .map((r) => {
0524 |                 const t = r.totals;
0525 |                 const pct = takePct(t);
0526 |                 const days = dayRowsByStaff.get(r.staff!.id) ?? [];
0527 |                 const money = (n: number) => `$${n.toFixed(2)}`;
0528 |                 const dayLabel = (d: string) =>
0529 |                   new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
0530 |                 const line = (label: string, value: string) => (
0531 |                   <div key={label} className="flex justify-between border-b border-black/20 py-1">
0532 |                     <span>{label}</span>
0533 |                     <span className="tabular-nums font-medium">{value}</span>
0534 |                   </div>
0535 |                 );
0536 |                 return (
0537 |                   <div key={r.staff!.id} className="slip text-sm">
0538 |                     <div className="text-lg font-serif">{r.staff!.name}</div>
0539 |                     <div className="text-xs">
0540 |                       {r.staff!.server_number ? `#${r.staff!.server_number} · ` : ""}
0541 |                       {roleLabel(r.staff!, positions)}
0542 |                     </div>
0543 |                     <div className="text-xs mb-2">Pay period {from} – {to}</div>
0544 | 
0545 |                     <table className="slip-table w-full text-xs mb-3">
0546 |                       <thead>
0547 |                         <tr className="border-b border-black/40">
0548 |                           <th className="text-left">Date</th>
0549 |                           <th className="text-left">Shift</th>
0550 |                           <th className="text-right">Hrs</th>
0551 |                           <th className="text-right">Cash Owed</th>
0552 |                           <th className="text-right">CC Tips</th>
0553 |                           <th className="text-right">From Srv</th>
0554 |                           <th className="text-right">R/B Recv</th>
0555 |                           <th className="text-right">Bar Out</th>
0556 |                           <th className="text-right">R/B Out</th>
0557 |                           <th className="text-right">Take-Home</th>
0558 |                         </tr>
0559 |                       </thead>
0560 |                       <tbody>
0561 |                         {days.map((d) => (
0562 |                           <tr key={`${d.date}-${d.period}`} className="border-b border-black/15">
0563 |                             <td>{dayLabel(d.date)}</td>
0564 |                             <td>{d.period}</td>
0565 |                             <td className="text-right tabular-nums">{d.totals.hours ? d.totals.hours.toFixed(2) : "—"}</td>
0566 |                             <td className="text-right tabular-nums">{money(d.totals.cash_owed)}</td>
0567 |                             <td className="text-right tabular-nums">{money(d.totals.credit_tips)}</td>
0568 |                             <td className="text-right tabular-nums">{money(d.totals.bar_from_servers)}</td>
0569 |                             <td className="text-right tabular-nums">{money(d.totals.rb_received)}</td>
0570 |                             <td className="text-right tabular-nums">-{money(d.totals.bar_tip_out)}</td>
0571 |                             <td className="text-right tabular-nums">-{money(d.totals.rb_tip_out)}</td>
0572 |                             <td className="text-right tabular-nums font-medium">{money(d.totals.takehome)}</td>
0573 |                           </tr>
0574 |                         ))}
0575 |                         <tr className="border-t-2 border-black/60 font-semibold">
0576 |                           <td>Totals</td>
0577 |                           <td>{days.length} shift{days.length === 1 ? "" : "s"}</td>
0578 |                           <td className="text-right tabular-nums">{t.hours.toFixed(2)}</td>
0579 |                           <td className="text-right tabular-nums">{money(t.cash_owed)}</td>
0580 |                           <td className="text-right tabular-nums">{money(t.credit_tips)}</td>
0581 |                           <td className="text-right tabular-nums">{money(t.bar_from_servers)}</td>
0582 |                           <td className="text-right tabular-nums">{money(t.rb_received)}</td>
0583 |                           <td className="text-right tabular-nums">-{money(t.bar_tip_out)}</td>
0584 |                           <td className="text-right tabular-nums">-{money(t.rb_tip_out)}</td>
0585 |                           <td className="text-right tabular-nums">{money(t.takehome)}</td>
0586 |                         </tr>
0587 |                       </tbody>
0588 |                     </table>
0589 | 
0590 |                     <div className="text-xs uppercase tracking-wide mb-1" style={{ color: brand.primary }}>
0591 |                       Period summary
0592 |                     </div>
0593 |                     {line("Shifts", String(t.shifts))}
0594 |                     {line("Hours", t.hours.toFixed(2))}
0595 |                     {line("Cash owed (turned in)", money(t.cash_owed))}
0596 |                     {line("Credit card tips", money(t.credit_tips))}
0597 |                     {line("Tips from servers", money(t.bar_from_servers))}
0598 |                     {line("R/B received", money(t.rb_received))}
0599 |                     {line("LBW sales", money(t.lbw_sales))}
0600 |                     {line("Bar tip out", `-${money(t.bar_tip_out)}`)}
0601 |                     {line("R/B tip out", `-${money(t.rb_tip_out)}`)}
0602 |                     {line("Total tips", money(totalTips(t)))}
0603 |                     <div className="flex justify-between pt-2 font-semibold">
0604 |                       <span>Take-home</span>
0605 |                       <span className="tabular-nums">
0606 |                         ${t.takehome.toFixed(2)} ({pct === null ? "—" : `${pct.toFixed(1)}%`})
0607 |                       </span>
0608 |                     </div>
0609 |                   </div>
0610 |                 );
0611 |               })}
0612 |           </div>
0613 |         </div>
0614 | 
0615 |         <section className={`bg-card border border-border rounded-lg p-4 flex items-baseline justify-between gap-3 ${printMode === "slips" ? "print:hidden" : ""}`}>
0616 |           <div>
0617 |             <div className="text-xs uppercase tracking-wide text-muted-foreground">Total cash deposits (house)</div>
0618 |             <div className="text-xs text-muted-foreground">Cash owed turned in by servers and bartenders, {from} – {to}</div>
0619 |           </div>
0620 |           <div className="text-2xl font-serif">${grand.cash_owed.toFixed(2)}</div>
0621 |         </section>
0622 | 
0623 |         <section className={`report-table bg-card border border-border rounded-lg overflow-x-auto ${printMode === "slips" ? "print:hidden" : ""}`}>
0624 | 
0625 |           <table className="w-full text-sm">
0626 |             <thead className="bg-secondary text-secondary-foreground">
0627 |               <tr>
0628 |                 <Th>Name</Th><Th>#</Th><Th>Roles</Th>
0629 |                 <Th right>Shifts</Th><Th right>Hours</Th>
0630 |                 <Th right>Cash Owed</Th>
0631 |                 <Th right>Credit Tips</Th>
0632 |                 <Th right>From Servers</Th>
0633 |                 <Th right>LBW Sales</Th>
0634 |                 <Th right>Bar Out</Th><Th right>R/B Out</Th>
0635 |                 <Th right>R/B Recv</Th>
0636 |                 <Th right>Take-Home (%)</Th>
0637 | 
0638 | 
0639 |               </tr>
0640 |             </thead>
0641 |             <tbody>
0642 |               {loading && <tr><td colSpan={13} className="text-center p-8 text-muted-foreground">Loading…</td></tr>}
0643 |               {!loading && visibleRows.length === 0 && (
0644 |                 <tr><td colSpan={13} className="text-center p-8 text-muted-foreground">No shifts in this range.</td></tr>
0645 |               )}
0646 |               {visibleRows.map((r) => {
0647 |                 const showFromServers = r.totals.bar_from_servers !== 0;
0648 |                 const pct = takePct(r.totals);
0649 |                 return (
0650 |                 <tr key={r.staff!.id} className="border-t border-border">
0651 |                   <Td>{r.staff!.name}</Td>
0652 |                   <Td className="text-muted-foreground">{r.staff!.server_number ?? "—"}</Td>
0653 |                   <Td className="text-muted-foreground capitalize">{roleLabel(r.staff!, positions)}</Td>
0654 |                   <Td right>{r.totals.shifts}</Td>
0655 |                   <Td right>{r.totals.hours.toFixed(2)}</Td>
0656 |                   <Td right>${r.totals.cash_owed.toFixed(2)}</Td>
0657 |                   <Td right>${r.totals.credit_tips.toFixed(2)}</Td>
0658 |                   <Td right className={showFromServers ? "" : "text-muted-foreground"}>
0659 |                     {showFromServers ? `$${r.totals.bar_from_servers.toFixed(2)}` : "—"}
0660 |                   </Td>
0661 |                   <Td right>${r.totals.lbw_sales.toFixed(2)}</Td>
0662 |                   <Td right>${r.totals.bar_tip_out.toFixed(2)}</Td>
0663 |                   <Td right>${r.totals.rb_tip_out.toFixed(2)}</Td>
0664 |                   <Td right>${r.totals.rb_received.toFixed(2)}</Td>
0665 |                   <Td right className="font-medium">
0666 |                     ${r.totals.takehome.toFixed(2)}
0667 |                     <span className="ml-1 text-xs font-normal text-muted-foreground">
0668 |                       ({pct === null ? "—" : `${pct.toFixed(1)}%`})
0669 |                     </span>
0670 |                   </Td>
0671 |                 </tr>
0672 |                 );
0673 |               })}
0674 | 
0675 |               {!loading && !printOnly && rows.length > 0 && (
0676 |                 <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
0677 |                   <Td>Total</Td>
0678 |                   <Td>—</Td>
0679 |                   <Td>{rows.length} people</Td>
0680 |                   <Td right>{grand.shifts}</Td>
0681 |                   <Td right>{grand.hours.toFixed(2)}</Td>
0682 |                   <Td right>${grand.cash_owed.toFixed(2)}</Td>
0683 |                   <Td right>${grand.credit_tips.toFixed(2)}</Td>
0684 |                   <Td right>${grand.bar_from_servers.toFixed(2)}</Td>
0685 |                   <Td right>${grand.lbw_sales.toFixed(2)}</Td>
0686 |                   <Td right>${grand.bar_tip_out.toFixed(2)}</Td>
0687 |                   <Td right>${grand.rb_tip_out.toFixed(2)}</Td>
0688 |                   <Td right>${grand.rb_received.toFixed(2)}</Td>
0689 |                   <Td right>${grand.takehome.toFixed(2)}
0690 |                     <span className="ml-1 text-xs font-normal text-muted-foreground">
0691 |                       ({takePct(grand) === null ? "—" : `${takePct(grand)?.toFixed(1)}%`})
0692 |                     </span>
0693 |                   </Td>
0694 | 
0695 |                 </tr>
0696 | 
0697 |               )}
0698 | 
0699 | 
0700 |             </tbody>
0701 |           </table>
0702 |         </section>
0703 |       </main>
0704 | 
0705 |       <style>{`
0706 |         @media print {
0707 |           @page { size: landscape; margin: 0.25in; }
0708 |           html, body { background: white !important; font-size: 9pt; }
0709 |           * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
0710 |           .print-header img { height: 1.35in !important; max-width: 2.8in !important; }
0711 |           .print-header { border: none !important; border-bottom: 2px solid ${brand.primary} !important; border-radius: 0 !important; padding: 0.15in 0 0.12in 0 !important; margin-bottom: 0.12in !important; }
0712 |           .report-table {
0713 |             overflow: visible !important;
0714 |             border: none !important;
0715 |             border-radius: 0 !important;
0716 |           }
0717 |           .report-table table {
0718 |             width: 100% !important;
0719 |             table-layout: fixed;
0720 |             font-size: 8pt;
0721 |             border-collapse: collapse;
0722 |           }
0723 |           .report-table th, .report-table td {
0724 |             padding: 1px 3px !important;
0725 |             line-height: 1.2;
0726 |             word-break: break-word;
0727 |             overflow-wrap: anywhere;
0728 |           }
0729 |           .report-table thead { display: table-header-group; }
0730 |           .report-table tr { page-break-inside: avoid; break-inside: avoid; }
0731 |           main { max-width: none !important; padding: 0 !important; }
0732 |           main > * + * { margin-top: 0.12in !important; }
0733 |           section { border-radius: 0 !important; padding: 0.06in !important; }
0734 |           /* Individual slips: flow several per page instead of one page each */
0735 |           .slip {
0736 |             page-break-after: always;
0737 |             break-after: page;
0738 |             page-break-inside: avoid;
0739 |             break-inside: avoid;
0740 |             display: block;
0741 |             width: 100%;
0742 |             margin: 0;
0743 |             padding-bottom: 0;
0744 |             font-size: 10pt;
0745 |           }
0746 |           .slip:last-child { page-break-after: auto; break-after: auto; }
0747 |           .slip .py-1 { padding-top: 1px !important; padding-bottom: 1px !important; line-height: 1.35; }
0748 |           .slip-table { border-collapse: collapse; font-size: 8.5pt; }
0749 |           .slip-table th, .slip-table td { padding: 1px 3px !important; line-height: 1.3; white-space: nowrap; }
0750 |           .slip-table tr { page-break-inside: avoid; break-inside: avoid; }
0751 | 
0752 |         }
0753 |       `}</style>
0754 |     </div>
0755 |   );
0756 | }
0757 | 
0758 | function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
0759 |   return <th className={`px-3 py-2 text-xs uppercase tracking-wide font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>;
0760 | }
0761 | function Td({ children, right, className }: { children: React.ReactNode; right?: boolean; className?: string }) {
0762 |   return <td className={`px-3 py-2 ${right ? "text-right tabular-nums" : ""} ${className ?? ""}`}>{children}</td>;
0763 | }
0764 | function csvEsc(s: string) {
0765 |   if (s == null) return "";
0766 |   return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
0767 | }
0768 | /** Show every position a person holds, not just their primary role. */
0769 | function roleLabel(s: Staff, positions: Record<string, string[]>) {
0770 |   const all = new Set<string>([s.role, ...(positions[s.id] ?? [])]);
0771 |   return Array.from(all).map((r) => r.replace("_", " ")).sort().join(", ");
0772 | }
0773 | 
```

## `src/routes/_authenticated/daily.tsx`
```tsx
0001 | import { createFileRoute, Link } from "@tanstack/react-router";
0002 | import { useServerFn } from "@tanstack/react-start";
0003 | import { useEffect, useMemo, useRef, useState } from "react";
0004 | import { supabase } from "@/integrations/supabase/client";
0005 | import { printElement, printElementFromClick, printHtmlFromClick } from "@/lib/print";
0006 | import { useBrand, type Brand } from "@/lib/brand";
0007 | import { sendShiftTipReports, type SendShiftReportsResult } from "@/lib/sms.functions";
0008 | import {
0009 |   calcServer,
0010 |   calcBartender,
0011 |   calcSupportPool,
0012 |   poolFromShift,
0013 |   round2,
0014 |   splitBartenderShares,
0015 |   splitServerShares,
0016 |   type BartenderSplitMode,
0017 |   type Settings,
0018 |   type SupportRole,
0019 |   resolveSupportRole,
0020 | } from "@/lib/calculations";
0021 | 
0022 | 
0023 | type DailySearch = { date?: string };
0024 | 
0025 | export const Route = createFileRoute("/_authenticated/daily")({
0026 |   head: () => ({ meta: [{ title: "Daily Report · Tip Share" }] }),
0027 |   validateSearch: (s: Record<string, unknown>): DailySearch => ({
0028 |     date: typeof s.date === "string" ? s.date : undefined,
0029 |   }),
0030 |   component: DailyReport,
0031 | });
0032 | 
0033 | type Staff = { id: string; name: string; server_number: string | null; role: string };
0034 | type ShiftRow = {
0035 |   id: string;
0036 |   shift_date: string;
0037 |   period: "AM" | "PM";
0038 |   notes: string | null;
0039 |   shift_servers: { staff_id: string | null; cash_owed: number; credit_tips: number; lbw_sales: number; bar_tip_override: number | null; rb_tip_override: number | null; split_mode?: BartenderSplitMode | null; shift_server_members?: { staff_id: string; hours_worked: number }[] }[];
0040 |   shift_bartenders: {
0041 |     staff_id: string | null;
0042 |     cash_owed: number;
0043 |     credit_tips: number;
0044 |     rb_tip_override: number | null;
0045 |     split_mode: BartenderSplitMode;
0046 |     shift_bartender_members: { staff_id: string; hours_worked: number }[];
0047 |   }[];
0048 |   support_split_mode?: string | null;
0049 |   shift_support: { staff_id: string; hours_worked: number; role?: string | null }[];
0050 | };
0051 | 
0052 | type PersonDay = {
0053 |   staff_id: string;
0054 |   hours: number;
0055 |   cash_owed: number;
0056 |   credit_tips: number;
0057 |   from_servers: number;
0058 |   rb_received: number;
0059 |   lbw_sales: number;
0060 |   bar_out: number;
0061 |   rb_out: number;
0062 |   takehome: number;
0063 | };
0064 | const blankPerson = (staff_id: string): PersonDay => ({
0065 |   staff_id, hours: 0, cash_owed: 0, credit_tips: 0, from_servers: 0,
0066 |   rb_received: 0, lbw_sales: 0, bar_out: 0, rb_out: 0, takehome: 0,
0067 | });
0068 | 
0069 | 
0070 | 
0071 | 
0072 | function DailyReport() {
0073 |   const { date: dateParam } = Route.useSearch();
0074 |   const today = new Date().toISOString().slice(0, 10);
0075 |   const [date, setDate] = useState(dateParam ?? today);
0076 |   const [staff, setStaff] = useState<Staff[]>([]);
0077 |   const [settings, setSettings] = useState<(Settings & { establishment_name?: string; logo_url?: string | null }) | null>(null);
0078 |   const brand = useBrand(settings?.logo_url);
0079 |   const [shifts, setShifts] = useState<ShiftRow[]>([]);
0080 |   const [loading, setLoading] = useState(false);
0081 | 
0082 |   useEffect(() => {
0083 |     Promise.all([
0084 |       supabase.from("staff").select("id, name, server_number, role"),
0085 |       supabase.from("app_settings").select("*").limit(1).maybeSingle(),
0086 |     ]).then(([s, st]) => {
0087 |       setStaff((s.data ?? []) as Staff[]);
0088 |       setSettings(st.data as any);
0089 |     });
0090 |   }, []);
0091 | 
0092 |   useEffect(() => {
0093 |     if (!date) return;
0094 |     setLoading(true);
0095 |     supabase
0096 |       .from("shifts")
0097 |       .select("id, shift_date, period, notes, shift_servers(staff_id, cash_owed, credit_tips, lbw_sales, bar_tip_override, rb_tip_override, split_mode, shift_server_members(staff_id, hours_worked)), shift_bartenders(staff_id, cash_owed, credit_tips, rb_tip_override, split_mode, shift_bartender_members(staff_id, hours_worked)), shift_support(staff_id, hours_worked, role), support_split_mode")
0098 |       .eq("shift_date", date)
0099 |       .order("period")
0100 |       .then(({ data }) => {
0101 |         setShifts((data ?? []) as unknown as ShiftRow[]);
0102 |         setLoading(false);
0103 |       });
0104 |   }, [date]);
0105 | 
0106 |   const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
0107 | 
0108 |   const am = shifts.find((s) => s.period === "AM");
0109 |   const pm = shifts.find((s) => s.period === "PM");
0110 | 
0111 |   const [printMode, setPrintMode] = useState<"all" | "slips">("all");
0112 |   const [printOnly, setPrintOnly] = useState<string | null>(null);
0113 | 
0114 |   const [pendingPrint, setPendingPrint] = useState(false);
0115 | 
0116 |   function runPrint(mode: "all" | "slips", staffId?: string | null) {
0117 |     if (mode === "all") {
0118 |       setPrintMode("all");
0119 |       setPrintOnly(null);
0120 |       printElementFromClick(mainRef.current, "Daily Report");
0121 |       return;
0122 |     }
0123 |     setPrintMode(mode);
0124 |     setPrintOnly(staffId ?? null);
0125 |     setPendingPrint(true);
0126 |   }
0127 | 
0128 |   const mainRef = useRef<HTMLElement>(null);
0129 |   const slipsRef = useRef<HTMLDivElement>(null);
0130 | 
0131 |   // Individual sheets print straight from the click (markup stays mounted, hidden).
0132 |   function printSlips() {
0133 |     const el = slipsRef.current;
0134 |     if (!el) return;
0135 |     printHtmlFromClick(el.innerHTML, "Daily Sheets");
0136 |   }
0137 | 
0138 |   // Print only after the slip markup has painted; keep it mounted until the
0139 |   // print dialog closes (afterprint).
0140 |   useEffect(() => {
0141 |     if (!pendingPrint) return;
0142 |     let raf2 = 0;
0143 |     const done = () => {
0144 |       setPendingPrint(false);
0145 |       setPrintMode("all");
0146 |     };
0147 |     window.addEventListener("afterprint", done);
0148 |     const raf1 = requestAnimationFrame(() => {
0149 |       raf2 = requestAnimationFrame(() => {
0150 |         printElement(mainRef.current, "Daily Report");
0151 |         setTimeout(() => setPendingPrint(false), 1000);
0152 |       });
0153 |     });
0154 |     return () => {
0155 |       cancelAnimationFrame(raf1);
0156 |       cancelAnimationFrame(raf2);
0157 |       window.removeEventListener("afterprint", done);
0158 |     };
0159 |   }, [pendingPrint]);
0160 | 
0161 | 
0162 |   // Per-person totals for the whole day (AM + PM), used for individual print sheets.
0163 |   const personRows = useMemo(() => {
0164 |     if (!settings) return [] as PersonDay[];
0165 |     const map = new Map<string, PersonDay>();
0166 |     const bump = (id: string, patch: Partial<PersonDay>) => {
0167 |       const cur = map.get(id) ?? blankPerson(id);
0168 |       for (const k in patch) {
0169 |         if (k === "staff_id") continue;
0170 |         (cur as any)[k] += (patch as any)[k] ?? 0;
0171 |       }
0172 |       map.set(id, cur);
0173 |     };
0174 |     for (const sh of shifts) {
0175 |       for (const sv of sh.shift_servers) {
0176 |         const c = calcServer(sv, settings);
0177 |         const shares = splitServerShares(
0178 |           sv,
0179 |           { bar_tip: c.bar_tip, rb_tip: c.rb_tip, takehome: c.takehome },
0180 |           sv.split_mode ?? "single",
0181 |           sv.shift_server_members ?? [],
0182 |         );
0183 |         for (const share of shares) {
0184 |           bump(share.staff_id, {
0185 |             cash_owed: share.cash_owed, credit_tips: share.credit_tips, lbw_sales: share.lbw_sales,
0186 |             bar_out: share.bar_tip, rb_out: share.rb_tip, takehome: share.takehome,
0187 |           });
0188 |         }
0189 |       }
0190 |       const serverBarTotal = sh.shift_servers.reduce((s, sv) => s + calcServer(sv, settings).bar_tip, 0);
0191 |       const btCount = Math.max(sh.shift_bartenders.length, 1);
0192 |       for (const bt of sh.shift_bartenders) {
0193 |         const collected = round2(serverBarTotal / btCount);
0194 |         const c = calcBartender(bt, collected, settings);
0195 |         const shares = splitBartenderShares(
0196 |           bt,
0197 |           { rb_tip: c.rb_tip, takehome: c.takehome, collected_from_servers: collected },
0198 |           bt.split_mode ?? "single",
0199 |           bt.shift_bartender_members ?? [],
0200 |         );
0201 |         for (const share of shares) {
0202 |           bump(share.staff_id, {
0203 |             cash_owed: share.cash_owed, credit_tips: share.credit_tips,
0204 |             from_servers: share.bar_from_servers, rb_out: share.rb_tip, takehome: share.takehome,
0205 |           });
0206 |         }
0207 |       }
0208 |       const pool = poolFromShift(sh.shift_servers, sh.shift_bartenders, settings);
0209 |       const supportRows = sh.shift_support.map((sp) => ({
0210 |         staff_id: sp.staff_id,
0211 |         role: resolveSupportRole(sp.role, staffById.get(sp.staff_id)?.role),
0212 |         hours_worked: sp.hours_worked,
0213 |       }));
0214 |       const payouts = calcSupportPool(supportRows, pool, settings, (sh.support_split_mode === "shared" ? "shared" : "weighted"));
0215 |       for (const sp of sh.shift_support) {
0216 |         const payout = payouts.find((p) => p.staff_id === sp.staff_id)?.payout ?? 0;
0217 |         bump(sp.staff_id, { hours: sp.hours_worked, rb_received: payout, takehome: payout });
0218 |       }
0219 |     }
0220 |     return Array.from(map.values())
0221 |       .sort((a, b) => (staffById.get(a.staff_id)?.name ?? "").localeCompare(staffById.get(b.staff_id)?.name ?? ""));
0222 |   }, [shifts, settings, staffById]);
0223 | 
0224 | 
0225 |   const label = new Date(date + "T00:00:00").toLocaleDateString(undefined, {
0226 |     weekday: "long", month: "long", day: "numeric", year: "numeric",
0227 |   });
0228 | 
0229 |   return (
0230 |     <div className="min-h-screen bg-background">
0231 |       <header className="sticky top-0 bg-background border-b border-border z-10 print:hidden">
0232 |         <div className="max-w-4xl mx-auto p-4 flex items-center gap-3">
0233 |           <Link to="/" className="text-sm text-muted-foreground">← Home</Link>
0234 |           <h1 className="text-lg font-serif flex-1">Daily Report</h1>
0235 |         </div>
0236 |       </header>
0237 | 
0238 |       <main ref={mainRef} className="max-w-4xl mx-auto p-4 space-y-4 print:p-0 print:max-w-none">
0239 |         <section className="bg-card border border-border rounded-lg p-4 flex flex-wrap items-end gap-3 print:hidden">
0240 |           <div className="flex-1 min-w-[180px]">
0241 |             <label className="text-xs uppercase tracking-wide text-muted-foreground">Date</label>
0242 |             <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3" />
0243 |           </div>
0244 |           <button onClick={() => runPrint("all")} className="h-11 px-6 rounded-md bg-primary text-primary-foreground font-medium">
0245 |             Print all
0246 |           </button>
0247 |         </section>
0248 | 
0249 |         <section className="bg-card border border-border rounded-lg p-4 flex flex-wrap items-end gap-3 print:hidden">
0250 |           <div className="flex-1 min-w-[200px]">
0251 |             <label className="text-xs uppercase tracking-wide text-muted-foreground">Print individually</label>
0252 |             <select
0253 |               value={printOnly ?? ""}
0254 |               onChange={(e) => setPrintOnly(e.target.value || null)}
0255 |               className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3"
0256 |             >
0257 |               <option value="">Everyone — one page per person</option>
0258 |               {personRows.map((p) => {
0259 |                 const s = staffById.get(p.staff_id);
0260 |                 return (
0261 |                   <option key={p.staff_id} value={p.staff_id}>
0262 |                     {s?.name ?? "—"}{s?.server_number ? ` (#${s.server_number})` : ""}
0263 |                   </option>
0264 |                 );
0265 |               })}
0266 |             </select>
0267 |           </div>
0268 |           <button
0269 |             onClick={printSlips}
0270 |             disabled={personRows.length === 0}
0271 |             className="h-11 px-5 rounded-md border border-input font-medium disabled:opacity-50"
0272 |           >
0273 |             Print individual sheets
0274 |           </button>
0275 |         </section>
0276 | 
0277 | 
0278 |         <div
0279 |           className="print:block hidden mb-4 text-center pb-2"
0280 |           style={{ borderBottom: `2px solid ${brand.primary}` }}
0281 |         >
0282 |           {brand.logoUrl && (
0283 |             <img src={brand.logoUrl} alt="" className="mx-auto mb-1 h-14 object-contain" />
0284 |           )}
0285 |           <div className="text-xl font-serif" style={{ color: brand.primary }}>
0286 |             {settings?.establishment_name ?? "Tip Share"}
0287 |           </div>
0288 |           <div className="text-sm" style={{ color: brand.accent }}>Daily Report — {label}</div>
0289 |         </div>
0290 |         <div className="text-lg font-serif print:hidden">{label}</div>
0291 | 
0292 |         {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
0293 | 
0294 |         {!loading && !am && !pm && (
0295 |           <p className="text-sm text-muted-foreground">No shifts recorded for this date.</p>
0296 |         )}
0297 | 
0298 |         <div ref={slipsRef} className="hidden" aria-hidden="true">
0299 |           <div>
0300 |             {personRows
0301 |               .filter((p) => !printOnly || p.staff_id === printOnly)
0302 |               .map((p) => {
0303 |                 const s = staffById.get(p.staff_id);
0304 |                 const tips = p.credit_tips + p.from_servers + p.rb_received;
0305 |                 const pct = tips > 0 ? (p.takehome / tips) * 100 : null;
0306 |                 const line = (l: string, v: string) => (
0307 |                   <div key={l} className="flex justify-between border-b border-black/20 py-1">
0308 |                     <span>{l}</span><span className="tabular-nums font-medium">{v}</span>
0309 |                   </div>
0310 |                 );
0311 |                 return (
0312 |                   <div key={p.staff_id} className="slip text-sm">
0313 |                     <div
0314 |                       className="flex items-center gap-2 pb-1 mb-2"
0315 |                       style={{ borderBottom: `2px solid ${brand.primary}` }}
0316 |                     >
0317 |                       {brand.logoUrl && <img src={brand.logoUrl} alt="" className="h-8 object-contain" />}
0318 |                       <div className="flex-1">
0319 |                         <div className="text-lg font-serif" style={{ color: brand.primary }}>{s?.name ?? "—"}</div>
0320 |                         <div className="text-xs" style={{ color: brand.accent }}>
0321 |                           {settings?.establishment_name ? `${settings.establishment_name} · ` : ""}
0322 |                           {s?.server_number ? `#${s.server_number} · ` : ""}{(s?.role ?? "").replace("_", " ")} · {label}
0323 |                         </div>
0324 |                       </div>
0325 |                     </div>
0326 |                     {p.hours > 0 && line("Hours", p.hours.toFixed(2))}
0327 |                     {line("Cash owed (turned in)", `$${p.cash_owed.toFixed(2)}`)}
0328 |                     {line("Credit card tips", `$${p.credit_tips.toFixed(2)}`)}
0329 |                     {line("Tips from servers", `$${p.from_servers.toFixed(2)}`)}
0330 |                     {line("R/B received", `$${p.rb_received.toFixed(2)}`)}
0331 |                     {line("LBW sales", `$${p.lbw_sales.toFixed(2)}`)}
0332 |                     {line("Bar tip out", `-$${p.bar_out.toFixed(2)}`)}
0333 |                     {line("R/B tip out", `-$${p.rb_out.toFixed(2)}`)}
0334 |                     <div
0335 |                       className="flex justify-between mt-2 px-1 py-1 font-semibold"
0336 |                       style={{ background: brand.soft, color: brand.primary }}
0337 |                     >
0338 |                       <span>Take-home</span>
0339 |                       <span className="tabular-nums">${p.takehome.toFixed(2)} ({pct === null ? "—" : `${pct.toFixed(1)}%`})</span>
0340 |                     </div>
0341 |                   </div>
0342 |                 );
0343 |               })}
0344 |           </div>
0345 |         </div>
0346 | 
0347 |         <div className={`space-y-4 ${printMode === "slips" ? "print:hidden" : ""}`}>
0348 |         {!loading && am && settings && (
0349 |           <ShiftBlock shift={am} settings={settings} staffById={staffById} brand={brand} />
0350 |         )}
0351 |         {!loading && pm && settings && (
0352 |           <ShiftBlock shift={pm} settings={settings} staffById={staffById} brand={brand} />
0353 |         )}
0354 | 
0355 | 
0356 |         {!loading && (am || pm) && settings && (() => {
0357 |           const totals = (sh: ShiftRow | undefined) => {
0358 |             if (!sh) return {
0359 |               serverCash: 0, barCash: 0, cash: 0, credit: 0, lbw: 0,
0360 |               takehome: 0, barOut: 0, rbOut: 0, supportPool: 0, fromServers: 0,
0361 |             };
0362 |             const serverCash = sh.shift_servers.reduce((s, x) => s + Number(x.cash_owed ?? 0), 0);
0363 |             const barCash = sh.shift_bartenders.reduce((s, x) => s + Number(x.cash_owed ?? 0), 0);
0364 |             const credit = sh.shift_servers.reduce((s, x) => s + Number(x.credit_tips ?? 0), 0) +
0365 |               sh.shift_bartenders.reduce((s, x) => s + Number(x.credit_tips ?? 0), 0);
0366 |             const lbw = sh.shift_servers.reduce((s, x) => s + Number(x.lbw_sales ?? 0), 0);
0367 |             const serverCalcs = sh.shift_servers.map((sv) => calcServer(sv, settings));
0368 |             const serverBarTotal = serverCalcs.reduce((s, c) => s + c.bar_tip, 0);
0369 |             const barOut = serverBarTotal;
0370 |             const rbOutServer = serverCalcs.reduce((s, c) => s + c.rb_tip, 0);
0371 |             const btCount = Math.max(sh.shift_bartenders.length, 1);
0372 |             const bartenderCalcs = sh.shift_bartenders.map((bt) => calcBartender(bt, round2(serverBarTotal / btCount), settings));
0373 |             const rbOutBar = bartenderCalcs.reduce((s, c) => s + c.rb_tip, 0);
0374 |             const rbOut = rbOutServer + rbOutBar;
0375 |             const fromServers = sh.shift_bartenders.length > 0 ? serverBarTotal : 0;
0376 |             const pool = poolFromShift(sh.shift_servers, sh.shift_bartenders, settings);
0377 |             const supportRows = sh.shift_support.map((sp) => ({
0378 |               staff_id: sp.staff_id,
0379 |               role: resolveSupportRole(sp.role, staffById.get(sp.staff_id)?.role),
0380 |               hours_worked: sp.hours_worked,
0381 |             }));
0382 |             const payouts = calcSupportPool(supportRows, pool, settings, (sh.support_split_mode === "shared" ? "shared" : "weighted"));
0383 |             const supportPool = payouts.reduce((s, p) => s + p.payout, 0);
0384 |             const takehome =
0385 |               serverCalcs.reduce((s, c) => s + c.takehome, 0) +
0386 |               bartenderCalcs.reduce((s, c) => s + c.takehome, 0) +
0387 |               supportPool;
0388 |             return { serverCash, barCash, cash: serverCash + barCash, credit, lbw, takehome, barOut, rbOut, supportPool, fromServers };
0389 |           };
0390 |           const a = totals(am);
0391 |           const p = totals(pm);
0392 |           const day = {
0393 |             serverCash: a.serverCash + p.serverCash,
0394 |             barCash: a.barCash + p.barCash,
0395 |             cash: a.cash + p.cash,
0396 |             credit: a.credit + p.credit,
0397 |             lbw: a.lbw + p.lbw,
0398 |             takehome: a.takehome + p.takehome,
0399 |             barOut: a.barOut + p.barOut,
0400 |             rbOut: a.rbOut + p.rbOut,
0401 |             supportPool: a.supportPool + p.supportPool,
0402 |             fromServers: a.fromServers + p.fromServers,
0403 |           };
0404 |           const Row = ({ label, av, pv, dv, total }: { label: string; av: number; pv: number; dv: number; total?: boolean }) => (
0405 |             <div className={`flex justify-between text-sm ${total ? "pt-2 border-t border-border font-medium" : ""}`}>
0406 |               <span className={total ? "" : "text-muted-foreground"}>{label}</span>
0407 |               <span className={`tabular-nums ${total ? "font-serif text-lg" : "font-medium"}`}>
0408 |                 {am && <>AM ${av.toFixed(2)}</>}
0409 |                 {am && pm && <span className="mx-2 text-muted-foreground">·</span>}
0410 |                 {pm && <>PM ${pv.toFixed(2)}</>}
0411 |                 <span className="ml-3 font-semibold">Day ${dv.toFixed(2)}</span>
0412 |               </span>
0413 |             </div>
0414 |           );
0415 |           return (
0416 |             <section className="shift-block bg-card border border-border rounded-lg overflow-hidden print:border-black">
0417 |               <div className="px-4 py-3 border-b border-border bg-secondary/40 print:bg-white">
0418 |                 <h2 className="text-base font-serif">Day Totals</h2>
0419 |               </div>
0420 |               <div className="p-4 space-y-2">
0421 |                 <Row label="Server cash owed" av={a.serverCash} pv={p.serverCash} dv={day.serverCash} />
0422 |                 <Row label="Bartender cash owed" av={a.barCash} pv={p.barCash} dv={day.barCash} />
0423 |                 <Row label="Cash deposit (house)" av={a.cash} pv={p.cash} dv={day.cash} />
0424 |                 <Row label="Credit card tips" av={a.credit} pv={p.credit} dv={day.credit} />
0425 |                 <Row label="LBW sales" av={a.lbw} pv={p.lbw} dv={day.lbw} />
0426 |                 <div className="my-2 border-t border-dashed border-border" />
0427 |                 <Row label="Bar tip-out (servers → bartenders)" av={a.barOut} pv={p.barOut} dv={day.barOut} />
0428 |                 <Row label="R/B tip-out (servers + bartenders)" av={a.rbOut} pv={p.rbOut} dv={day.rbOut} />
0429 |                 <Row label="Support pool paid out" av={a.supportPool} pv={p.supportPool} dv={day.supportPool} />
0430 |                 <Row label="Bartender tips from servers" av={a.fromServers} pv={p.fromServers} dv={day.fromServers} />
0431 |                 <div className="my-2 border-t border-dashed border-border" />
0432 |                 <div className="flex justify-between text-sm pt-2 border-t border-border font-medium">
0433 |                   <span>Total cash deposit (house)</span>
0434 |                   <span className="tabular-nums font-serif text-lg">${day.cash.toFixed(2)}</span>
0435 |                 </div>
0436 |                 <div className="flex justify-between text-sm font-medium">
0437 |                   <span>Total take-home paid out (cashouts)</span>
0438 |                   <span className="tabular-nums font-serif text-lg">${day.takehome.toFixed(2)}</span>
0439 |                 </div>
0440 |                 <div className="flex justify-between text-sm pt-2 border-t border-border">
0441 |                   <span>Net house cash (deposit − cashouts)</span>
0442 |                   <span className={`tabular-nums font-medium ${day.cash - day.takehome >= 0 ? "text-green-600" : "text-destructive"}`}>${(day.cash - day.takehome).toFixed(2)}</span>
0443 |                 </div>
0444 |                 <Row label="Take-home total" av={a.takehome} pv={p.takehome} dv={day.takehome} total />
0445 |               </div>
0446 |             </section>
0447 |           );
0448 |         })()}
0449 | 
0450 |         </div>
0451 | 
0452 |       </main>
0453 | 
0454 |       <style>{`
0455 |         @media print {
0456 |           @page { size: portrait; margin: 0.25in; }
0457 |           html, body { background: white !important; font-size: 9pt; }
0458 |           * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
0459 |           main { max-width: none !important; padding: 0 !important; }
0460 |           main > * + * { margin-top: 0.12in !important; }
0461 |           .shift-block { overflow: visible !important; border-radius: 0 !important; }
0462 |           .shift-block table { width: 100% !important; table-layout: fixed; font-size: 8pt; border-collapse: collapse; }
0463 |           .shift-block th, .shift-block td { padding: 1px 3px !important; line-height: 1.2; overflow-wrap: anywhere; }
0464 |           .shift-block > div { padding: 0.06in !important; }
0465 |           .shift-block { page-break-inside: avoid; break-inside: avoid; }
0466 |           /* Let shifts flow onto the same page when they fit */
0467 |           .shift-block + .shift-block { page-break-before: auto; margin-top: 0.14in !important; }
0468 |           .slip {
0469 |             page-break-after: always;
0470 |             break-after: page;
0471 |             page-break-inside: avoid;
0472 |             break-inside: avoid;
0473 |             display: block;
0474 |             width: 100%;
0475 |             margin: 0;
0476 |             padding-bottom: 0;
0477 |             font-size: 10pt;
0478 |           }
0479 |           .slip:last-child { page-break-after: auto; break-after: auto; }
0480 |           .slip .py-1 { padding-top: 1px !important; padding-bottom: 1px !important; line-height: 1.35; }
0481 | 
0482 |         }
0483 |       `}</style>
0484 |     </div>
0485 |   );
0486 | }
0487 | 
0488 | function SendTexts({ shiftId }: { shiftId: string }) {
0489 |   const send = useServerFn(sendShiftTipReports);
0490 |   const [busy, setBusy] = useState(false);
0491 |   const [res, setRes] = useState<SendShiftReportsResult | null>(null);
0492 | 
0493 |   async function go() {
0494 |     setBusy(true);
0495 |     setRes(null);
0496 |     try {
0497 |       setRes(await send({ data: { shift_id: shiftId } }));
0498 |     } catch (e) {
0499 |       setRes({
0500 |         configured: false, sent: 0, skipped: 0, failed: 0, results: [],
0501 |         error: e instanceof Error ? e.message : "Could not send texts.",
0502 |       });
0503 |     } finally {
0504 |       setBusy(false);
0505 |     }
0506 |   }
0507 | 
0508 |   const problems = res?.results.filter((r) => r.status !== "sent") ?? [];
0509 | 
0510 |   return (
0511 |     <div className="px-4 py-3 border-b border-border print:hidden space-y-2">
0512 |       <div className="flex flex-wrap items-center gap-3">
0513 |         <button
0514 |           onClick={go}
0515 |           disabled={busy}
0516 |           className="h-11 px-5 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-60"
0517 |         >
0518 |           {busy ? "Sending…" : "Text tip reports"}
0519 |         </button>
0520 |         {res && !res.error && (
0521 |           <span className="text-sm text-muted-foreground">
0522 |             {res.sent} sent{res.skipped ? ` · ${res.skipped} skipped` : ""}{res.failed ? ` · ${res.failed} failed` : ""}
0523 |           </span>
0524 |         )}
0525 |       </div>
0526 |       {res?.error && <p className="text-sm text-destructive">{res.error}</p>}
0527 |       {problems.length > 0 && (
0528 |         <ul className="text-xs text-muted-foreground space-y-1">
0529 |           {problems.map((p) => (
0530 |             <li key={p.staff_id}>
0531 |               {p.name} — {p.status}{p.detail ? `: ${p.detail}` : ""}
0532 |             </li>
0533 |           ))}
0534 |         </ul>
0535 |       )}
0536 |     </div>
0537 |   );
0538 | }
0539 | 
0540 | function ShiftBlock({
0541 |   shift,
0542 |   settings,
0543 |   staffById,
0544 |   brand,
0545 | }: {
0546 |   shift: ShiftRow;
0547 |   settings: Settings & { sms_enabled?: boolean };
0548 |   staffById: Map<string, Staff>;
0549 |   brand: Brand;
0550 | }) {
0551 |   const periodLabel = shift.period === "AM" ? "AM (Lunch)" : "PM (Dinner)";
0552 | 
0553 | 
0554 |   const serverBarTotal = shift.shift_servers.reduce((s, sv) => s + calcServer(sv, settings).bar_tip, 0);
0555 |   const bartenderCount = Math.max(shift.shift_bartenders.length, 1);
0556 |   const pool = poolFromShift(shift.shift_servers, shift.shift_bartenders, settings);
0557 |   const supportRows = shift.shift_support.map((sp) => ({
0558 |     staff_id: sp.staff_id,
0559 |     role: resolveSupportRole(sp.role, staffById.get(sp.staff_id)?.role),
0560 |     hours_worked: sp.hours_worked,
0561 |   }));
0562 |   const payouts = calcSupportPool(supportRows, pool, settings, (shift.support_split_mode === "shared" ? "shared" : "weighted"));
0563 | 
0564 |   const serverCash = shift.shift_servers.reduce((s, x) => s + Number(x.cash_owed ?? 0), 0);
0565 |   const barCash = shift.shift_bartenders.reduce((s, x) => s + Number(x.cash_owed ?? 0), 0);
0566 |   const totalCash = serverCash + barCash;
0567 |   const totalCredit = shift.shift_servers.reduce((s, x) => s + Number(x.credit_tips ?? 0), 0)
0568 |     + shift.shift_bartenders.reduce((s, x) => s + Number(x.credit_tips ?? 0), 0);
0569 |   const totalSales = shift.shift_servers.reduce((s, x) => s + Number(x.lbw_sales ?? 0), 0);
0570 |   const totalTakehome =
0571 |     shift.shift_servers.reduce((s, sv) => s + calcServer(sv, settings).takehome, 0)
0572 |     + shift.shift_bartenders.reduce((s, bt) => s + calcBartender(bt, round2(serverBarTotal / bartenderCount), settings).takehome, 0)
0573 |     + payouts.reduce((s, p) => s + p.payout, 0);
0574 | 
0575 |   return (
0576 |     <section className="shift-block bg-card border border-border rounded-lg overflow-hidden print:border-black">
0577 |       <div
0578 |         className="flex items-center justify-between px-4 py-3 border-b border-border"
0579 |         style={{ background: brand.soft, borderBottomColor: brand.primary }}
0580 |       >
0581 |         <div className="flex items-center gap-3">
0582 |           <span
0583 |             className="text-xs px-2 py-1 rounded font-medium"
0584 |             style={{ background: brand.primary, color: brand.onPrimary }}
0585 |           >
0586 |             {shift.period}
0587 |           </span>
0588 |           <h2 className="text-base font-serif" style={{ color: brand.primary }}>{periodLabel}</h2>
0589 |         </div>
0590 |         <div className="text-xs" style={{ color: brand.accent }}>Take-Home Total: <span className="font-semibold">${totalTakehome.toFixed(2)}</span></div>
0591 |       </div>
0592 | 
0593 |       {settings.sms_enabled && <SendTexts shiftId={shift.id} />}
0594 | 
0595 |       {shift.shift_servers.length > 0 && (
0596 |         <div className="overflow-x-auto">
0597 |           <div className="px-4 pt-3 text-xs uppercase tracking-wide text-muted-foreground">Servers</div>
0598 |           <table className="w-full text-sm">
0599 |             <thead>
0600 |               <tr className="text-muted-foreground">
0601 |                 <Th>Name</Th><Th>#</Th>
0602 |                 <Th right>Cash Owed</Th><Th right>Credit Tips</Th><Th right>LBW Sales</Th>
0603 |                 <Th right>Bar Out</Th><Th right>R/B Out</Th><Th right>Take-Home</Th>
0604 |               </tr>
0605 |             </thead>
0606 |             <tbody>
0607 |               {shift.shift_servers.flatMap((sv, i) => {
0608 |                 const c = calcServer(sv, settings);
0609 |                 const shares = splitServerShares(
0610 |                   sv,
0611 |                   { bar_tip: c.bar_tip, rb_tip: c.rb_tip, takehome: c.takehome },
0612 |                   sv.split_mode ?? "single",
0613 |                   sv.shift_server_members ?? [],
0614 |                 );
0615 |                 const shared = (sv.split_mode ?? "single") !== "single";
0616 |                 return shares.map((share, j) => {
0617 |                   const s = staffById.get(share.staff_id);
0618 |                   return (
0619 |                     <tr key={`${i}-${j}`} className="border-t border-border">
0620 |                       <Td>{s?.name ?? "—"}{shared ? " (split party)" : ""}</Td>
0621 |                       <Td className="text-muted-foreground">{s?.server_number ?? "—"}</Td>
0622 |                       <Td right>${share.cash_owed.toFixed(2)}</Td>
0623 |                       <Td right>${share.credit_tips.toFixed(2)}</Td>
0624 |                       <Td right>${share.lbw_sales.toFixed(2)}</Td>
0625 |                       <Td right>${share.bar_tip.toFixed(2)}</Td>
0626 |                       <Td right>${share.rb_tip.toFixed(2)}</Td>
0627 |                       <Td right className="font-semibold">${share.takehome.toFixed(2)}</Td>
0628 |                     </tr>
0629 |                   );
0630 |                 });
0631 |               })}
0632 |             </tbody>
0633 |           </table>
0634 |         </div>
0635 |       )}
0636 | 
0637 |       {shift.shift_bartenders.length > 0 && (
0638 |         <div className="overflow-x-auto">
0639 |           <div className="px-4 pt-3 text-xs uppercase tracking-wide text-muted-foreground">Bartenders</div>
0640 |           <table className="w-full text-sm">
0641 |             <thead>
0642 |               <tr className="text-muted-foreground">
0643 |                 <Th>Name</Th><Th>#</Th>
0644 |                 <Th right>Hours</Th>
0645 |                 <Th right>Cash Owed</Th><Th right>Credit Tips</Th>
0646 |                 <Th right>From Servers</Th><Th right>R/B Out</Th><Th right>Take-Home</Th>
0647 |               </tr>
0648 |             </thead>
0649 |             <tbody>
0650 |               {shift.shift_bartenders.flatMap((bt, bi) => {
0651 |                 const collected = round2(serverBarTotal / bartenderCount);
0652 |                 const c = calcBartender(bt, collected, settings);
0653 |                 const shares = splitBartenderShares(bt, { rb_tip: c.rb_tip, takehome: c.takehome, collected_from_servers: collected }, bt.split_mode ?? "single", bt.shift_bartender_members ?? []);
0654 |                 const shared = (bt.split_mode ?? "single") !== "single";
0655 |                 return shares.map((sh, si) => {
0656 |                   const s = staffById.get(sh.staff_id);
0657 |                   return (
0658 |                     <tr key={`${bi}-${sh.staff_id}`} className="border-t border-border">
0659 |                       <Td>
0660 |                         {s?.name ?? "—"}
0661 |                         {shared && si === 0 && <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">shared</span>}
0662 |                       </Td>
0663 |                       <Td className="text-muted-foreground">{s?.server_number ?? "—"}</Td>
0664 |                       <Td right className="text-muted-foreground">{shared && bt.split_mode === "hours" ? sh.hours_worked.toFixed(2) : "—"}</Td>
0665 |                       <Td right>${sh.cash_owed.toFixed(2)}</Td>
0666 |                       <Td right>${sh.credit_tips.toFixed(2)}</Td>
0667 |                       <Td right>${sh.bar_from_servers.toFixed(2)}</Td>
0668 |                       <Td right>${sh.rb_tip.toFixed(2)}</Td>
0669 |                       <Td right className="font-semibold">${sh.takehome.toFixed(2)}</Td>
0670 |                     </tr>
0671 |                   );
0672 |                 });
0673 |               })}
0674 |             </tbody>
0675 |           </table>
0676 | 
0677 |         </div>
0678 |       )}
0679 | 
0680 |       {shift.shift_support.length > 0 && (
0681 |         <div className="overflow-x-auto">
0682 |           <div className="px-4 pt-3 text-xs uppercase tracking-wide text-muted-foreground">Support (Pool ${pool.toFixed(2)})</div>
0683 |           <table className="w-full text-sm">
0684 |             <thead>
0685 |               <tr className="text-muted-foreground">
0686 |                 <Th>Name</Th><Th>Role</Th><Th right>Hours</Th><Th right>Payout</Th>
0687 |               </tr>
0688 |             </thead>
0689 |             <tbody>
0690 |               {shift.shift_support.map((sp) => {
0691 |                 const s = staffById.get(sp.staff_id);
0692 |                 const payout = payouts.find((p) => p.staff_id === sp.staff_id)?.payout ?? 0;
0693 |                 return (
0694 |                   <tr key={sp.staff_id} className="border-t border-border">
0695 |                     <Td>{s?.name ?? "—"}</Td>
0696 |                     <Td className="text-muted-foreground capitalize">{(s?.role ?? "").replace("_", " ")}</Td>
0697 |                     <Td right>{sp.hours_worked.toFixed(2)}</Td>
0698 |                     <Td right className="font-semibold">${payout.toFixed(2)}</Td>
0699 |                   </tr>
0700 |                 );
0701 |               })}
0702 |             </tbody>
0703 |           </table>
0704 |         </div>
0705 |       )}
0706 | 
0707 |       <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 border-t border-border text-sm">
0708 |         <Stat label="Server Cash Owed" value={`$${serverCash.toFixed(2)}`} />
0709 |         <Stat label="Bartender Cash Owed" value={`$${barCash.toFixed(2)}`} />
0710 |         <Stat label="Cash Deposit (Shift)" value={`$${totalCash.toFixed(2)}`} />
0711 |         <Stat label="Total Credit Tips" value={`$${totalCredit.toFixed(2)}`} />
0712 |         <Stat label="LBW Sales" value={`$${totalSales.toFixed(2)}`} />
0713 |         <Stat label="Take-Home Total" value={`$${totalTakehome.toFixed(2)}`} />
0714 |       </div>
0715 | 
0716 |       {shift.notes && (
0717 |         <div className="px-4 pb-4 text-sm">
0718 |           <div className="text-xs uppercase tracking-wide text-muted-foreground">Notes</div>
0719 |           <div className="mt-1 whitespace-pre-wrap">{shift.notes}</div>
0720 |         </div>
0721 |       )}
0722 |     </section>
0723 |   );
0724 | }
0725 | 
0726 | function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
0727 |   return <th className={`px-3 py-2 text-xs uppercase tracking-wide font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>;
0728 | }
0729 | function Td({ children, right, className }: { children: React.ReactNode; right?: boolean; className?: string }) {
0730 |   return <td className={`px-3 py-2 ${right ? "text-right tabular-nums" : ""} ${className ?? ""}`}>{children}</td>;
0731 | }
0732 | function Stat({ label, value }: { label: string; value: string }) {
0733 |   return (
0734 |     <div>
0735 |       <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
0736 |       <div className="font-semibold tabular-nums">{value}</div>
0737 |     </div>
0738 |   );
0739 | }
```

## `src/routes/_authenticated/individual.tsx`
```tsx
0001 | import { createFileRoute, Link } from "@tanstack/react-router";
0002 | import { useEffect, useMemo, useRef, useState } from "react";
0003 | import { supabase } from "@/integrations/supabase/client";
0004 | import { printElementFromClick } from "@/lib/print";
0005 | import { downloadTextFile } from "@/lib/download";
0006 | import { type PayPeriodType, payPeriodRange, previousPayPeriod } from "@/lib/location";
0007 | import { useBrand } from "@/lib/brand";
0008 | import {
0009 |   calcServer,
0010 |   calcBartender,
0011 |   calcSupportPool,
0012 |   poolFromShift,
0013 |   round2,
0014 |   splitBartenderShares,
0015 |   splitServerShares,
0016 |   type BartenderSplitMode,
0017 |   type Settings,
0018 |   type SupportRole,
0019 |   resolveSupportRole,
0020 | } from "@/lib/calculations";
0021 | 
0022 | export const Route = createFileRoute("/_authenticated/individual")({
0023 |   head: () => ({
0024 |     meta: [
0025 |       { title: "Individual Tip Summary · Tip Share" },
0026 |       { name: "description", content: "Pick a staff member and date range to see day-by-day tips with a summary total." },
0027 |       { property: "og:title", content: "Individual Tip Summary · Tip Share" },
0028 |       { property: "og:description", content: "Day-by-day tip detail and totals for one staff member over any date range." },
0029 |       { property: "og:type", content: "website" },
0030 |       { name: "twitter:card", content: "summary" },
0031 |     ],
0032 |   }),
0033 |   component: IndividualPage,
0034 | });
0035 | 
0036 | type Staff = { id: string; name: string; server_number: string | null; role: string };
0037 | type ShiftRow = {
0038 |   id: string;
0039 |   shift_date: string;
0040 |   period: "AM" | "PM";
0041 |   shift_servers: { staff_id: string | null; cash_owed: number; credit_tips: number; lbw_sales: number; bar_tip_override: number | null; rb_tip_override: number | null; split_mode?: BartenderSplitMode | null; shift_server_members?: { staff_id: string; hours_worked: number }[] }[];
0042 |   shift_bartenders: {
0043 |     staff_id: string | null;
0044 |     cash_owed: number;
0045 |     credit_tips: number;
0046 |     rb_tip_override: number | null;
0047 |     split_mode: BartenderSplitMode;
0048 |     shift_bartender_members: { staff_id: string; hours_worked: number }[];
0049 |   }[];
0050 |   support_split_mode?: string | null;
0051 |   shift_support: { staff_id: string; hours_worked: number; role?: string | null }[];
0052 | };
0053 | 
0054 | type Line = {
0055 |   key: string;
0056 |   date: string;
0057 |   period: "AM" | "PM";
0058 |   roles: string[];
0059 |   hours: number;
0060 |   cash_owed: number;
0061 |   credit_tips: number;
0062 |   bar_from_servers: number;
0063 |   lbw_sales: number;
0064 |   bar_tip_out: number;
0065 |   rb_tip_out: number;
0066 |   rb_received: number;
0067 |   takehome: number;
0068 | };
0069 | 
0070 | const emptyLine = (key: string, date: string, period: "AM" | "PM"): Line => ({
0071 |   key, date, period, roles: [], hours: 0, cash_owed: 0, credit_tips: 0,
0072 |   bar_from_servers: 0, lbw_sales: 0, bar_tip_out: 0, rb_tip_out: 0, rb_received: 0, takehome: 0,
0073 | });
0074 | 
0075 | const totalTips = (l: { credit_tips: number; bar_from_servers: number; rb_received: number }) =>
0076 |   l.credit_tips + l.bar_from_servers + l.rb_received;
0077 | 
0078 | const takePct = (l: Line) => {
0079 |   const tips = totalTips(l);
0080 |   return tips > 0 ? (l.takehome / tips) * 100 : null;
0081 | };
0082 | 
0083 | type SettingsWithPeriod = Settings & {
0084 |   pay_period_type?: PayPeriodType;
0085 |   pay_period_anchor?: string | null;
0086 |   establishment_name?: string;
0087 |   logo_url?: string | null;
0088 | };
0089 | 
0090 | function IndividualPage() {
0091 |   const today = new Date().toISOString().slice(0, 10);
0092 |   const fourteen = new Date(Date.now() - 13 * 86400_000).toISOString().slice(0, 10);
0093 |   const [from, setFrom] = useState(fourteen);
0094 |   const [to, setTo] = useState(today);
0095 |   const [staff, setStaff] = useState<Staff[]>([]);
0096 |   const [selected, setSelected] = useState<string>("");
0097 |   const [settings, setSettings] = useState<SettingsWithPeriod | null>(null);
0098 |   const brand = useBrand(settings?.logo_url);
0099 |   const [shifts, setShifts] = useState<ShiftRow[]>([]);
0100 |   const [loading, setLoading] = useState(false);
0101 | 
0102 |   useEffect(() => {
0103 |     Promise.all([
0104 |       supabase.from("staff").select("id, name, server_number, role").order("name"),
0105 |       supabase.from("app_settings").select("*").limit(1).maybeSingle(),
0106 |     ]).then(([s, st]) => {
0107 |       const list = (s.data ?? []) as Staff[];
0108 |       setStaff(list);
0109 |       setSelected((cur) => cur || (list[0]?.id ?? ""));
0110 |       setSettings(st.data as SettingsWithPeriod | null);
0111 |     });
0112 |   }, []);
0113 | 
0114 |   const mainRef = useRef<HTMLElement>(null);
0115 |   const reqSeq = useRef(0);
0116 |   useEffect(() => {
0117 |     const valid = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number(d.slice(0, 4)) > 1900;
0118 |     if (!valid(from) || !valid(to) || from > to) return;
0119 |     const seq = ++reqSeq.current;
0120 |     setLoading(true);
0121 |     supabase
0122 |       .from("shifts")
0123 |       .select("id, shift_date, period, shift_servers(staff_id, cash_owed, credit_tips, lbw_sales, bar_tip_override, rb_tip_override, split_mode, shift_server_members(staff_id, hours_worked)), shift_bartenders(staff_id, cash_owed, credit_tips, rb_tip_override, split_mode, shift_bartender_members(staff_id, hours_worked)), shift_support(staff_id, hours_worked, role), support_split_mode")
0124 |       .gte("shift_date", from)
0125 |       .lte("shift_date", to)
0126 |       .order("shift_date")
0127 |       .then(({ data }) => {
0128 |         if (seq !== reqSeq.current) return;
0129 |         setShifts((data ?? []) as unknown as ShiftRow[]);
0130 |         setLoading(false);
0131 |       });
0132 |   }, [from, to]);
0133 | 
0134 |   const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
0135 |   const person = staffById.get(selected);
0136 | 
0137 |   const lines = useMemo(() => {
0138 |     const out: Line[] = [];
0139 |     if (!settings || !selected) return out;
0140 | 
0141 |     for (const sh of shifts) {
0142 |       const line = emptyLine(sh.id, sh.shift_date, sh.period);
0143 |       let touched = false;
0144 | 
0145 |       for (const sv of sh.shift_servers) {
0146 |         const c = calcServer(sv, settings);
0147 |         const shares = splitServerShares(
0148 |           sv,
0149 |           { bar_tip: c.bar_tip, rb_tip: c.rb_tip, takehome: c.takehome },
0150 |           sv.split_mode ?? "single",
0151 |           sv.shift_server_members ?? [],
0152 |         );
0153 |         for (const share of shares) {
0154 |           if (share.staff_id !== selected) continue;
0155 |           line.cash_owed += share.cash_owed;
0156 |           line.credit_tips += share.credit_tips;
0157 |           line.lbw_sales += share.lbw_sales;
0158 |           line.bar_tip_out += share.bar_tip;
0159 |           line.rb_tip_out += share.rb_tip;
0160 |           line.takehome += share.takehome;
0161 |           line.roles.push("server");
0162 |           touched = true;
0163 |         }
0164 |       }
0165 | 
0166 |       const serverBarTotal = sh.shift_servers.reduce((s, sv) => s + calcServer(sv, settings).bar_tip, 0);
0167 |       const bartenderCount = Math.max(sh.shift_bartenders.length, 1);
0168 |       for (const bt of sh.shift_bartenders) {
0169 |         const collected = round2(serverBarTotal / bartenderCount);
0170 |         const c = calcBartender(bt, collected, settings);
0171 |         const shares = splitBartenderShares(
0172 |           bt,
0173 |           { rb_tip: c.rb_tip, takehome: c.takehome, collected_from_servers: collected },
0174 |           bt.split_mode ?? "single",
0175 |           bt.shift_bartender_members ?? [],
0176 |         );
0177 |         for (const share of shares) {
0178 |           if (share.staff_id !== selected) continue;
0179 |           line.credit_tips += share.credit_tips;
0180 |           line.bar_from_servers += share.bar_from_servers;
0181 |           line.rb_tip_out += share.rb_tip;
0182 |           line.takehome += share.takehome;
0183 |           if (share.hours_worked) line.hours += share.hours_worked;
0184 |           line.roles.push("bartender");
0185 |           touched = true;
0186 |         }
0187 |       }
0188 | 
0189 |       const mine = sh.shift_support.filter((sp) => sp.staff_id === selected);
0190 |       if (mine.length > 0) {
0191 |         const pool = poolFromShift(sh.shift_servers, sh.shift_bartenders, settings);
0192 |         const supportRows = sh.shift_support.map((sp) => ({
0193 |           staff_id: sp.staff_id,
0194 |           role: resolveSupportRole(sp.role, staffById.get(sp.staff_id)?.role),
0195 |           hours_worked: sp.hours_worked,
0196 |         }));
0197 |         const payouts = calcSupportPool(supportRows, pool, settings, sh.support_split_mode === "shared" ? "shared" : "weighted");
0198 |         for (const sp of mine) {
0199 |           const payout = payouts.find((p) => p.staff_id === sp.staff_id)?.payout ?? 0;
0200 |           line.hours += sp.hours_worked;
0201 |           line.rb_received += payout;
0202 |           line.takehome += payout;
0203 |           line.roles.push((staffById.get(sp.staff_id)?.role ?? "support").replace("_", " "));
0204 |           touched = true;
0205 |         }
0206 |       }
0207 | 
0208 |       if (touched) {
0209 |         line.roles = Array.from(new Set(line.roles));
0210 |         out.push(line);
0211 |       }
0212 |     }
0213 |     return out.sort((a, b) => (a.date === b.date ? a.period.localeCompare(b.period) : a.date.localeCompare(b.date)));
0214 |   }, [shifts, settings, selected, staffById]);
0215 | 
0216 |   const total = useMemo(() => {
0217 |     const t = emptyLine("total", "", "AM");
0218 |     for (const l of lines) {
0219 |       t.hours += l.hours;
0220 |       t.cash_owed += l.cash_owed;
0221 |       t.credit_tips += l.credit_tips;
0222 |       t.bar_from_servers += l.bar_from_servers;
0223 |       t.lbw_sales += l.lbw_sales;
0224 |       t.bar_tip_out += l.bar_tip_out;
0225 |       t.rb_tip_out += l.rb_tip_out;
0226 |       t.rb_received += l.rb_received;
0227 |       t.takehome += l.takehome;
0228 |     }
0229 |     return t;
0230 |   }, [lines]);
0231 | 
0232 |   const avg = lines.length > 0 ? total.takehome / lines.length : 0;
0233 | 
0234 |   function downloadCSV() {
0235 |     if (!person) return;
0236 |     const headers = [
0237 |       "Name", "Server #", "Date", "Period", "Roles", "Hours", "Cash Owed",
0238 |       "Credit Tips", "Tips From Servers (Bar)", "LBW Sales",
0239 |       "Bar Tip Out", "R/B Tip Out", "R/B Received", "Take-Home", "Total Tips", "Take-Home %",
0240 |     ];
0241 |     const lineFor = (l: Line, dateLabel: string, periodLabel: string) => {
0242 |       const p = takePct(l);
0243 |       return [
0244 |         csvEsc(person.name), person.server_number ?? "",
0245 |         dateLabel, periodLabel, csvEsc(l.roles.join(" / ")),
0246 |         l.hours.toFixed(2), l.cash_owed.toFixed(2), l.credit_tips.toFixed(2),
0247 |         l.bar_from_servers.toFixed(2), l.lbw_sales.toFixed(2),
0248 |         l.bar_tip_out.toFixed(2), l.rb_tip_out.toFixed(2), l.rb_received.toFixed(2),
0249 |         l.takehome.toFixed(2), totalTips(l).toFixed(2), p === null ? "" : p.toFixed(1),
0250 |       ].join(",");
0251 |     };
0252 |     const rows = [headers.join(","), ...lines.map((l) => lineFor(l, l.date, l.period))];
0253 |     rows.push(lineFor(total, `${from} to ${to}`, "TOTAL"));
0254 |     downloadTextFile(
0255 |       rows.join("\n"),
0256 |       `tips_${person.name.replace(/\s+/g, "-")}_${from}_to_${to}.csv`,
0257 |     );
0258 |   }
0259 | 
0260 |   return (
0261 |     <div className="min-h-screen bg-background">
0262 |       <header className="sticky top-0 bg-background border-b border-border z-10 print:hidden">
0263 |         <div className="max-w-5xl mx-auto p-4 flex items-center gap-3">
0264 |           <Link to="/" className="text-sm text-muted-foreground">← Home</Link>
0265 |           <h1 className="text-lg font-serif flex-1">Individual Summary</h1>
0266 |         </div>
0267 |       </header>
0268 | 
0269 |       <main ref={mainRef} className="max-w-5xl mx-auto p-4 space-y-4">
0270 |         <section className="print:hidden flex flex-wrap gap-2">
0271 |           <button
0272 |             onClick={() => { const r = payPeriodRange(settings?.pay_period_type ?? "biweekly", settings?.pay_period_anchor ?? null); setFrom(r.start); setTo(r.end); }}
0273 |             className="h-9 px-3 rounded-md border border-input text-sm"
0274 |           >
0275 |             This pay period
0276 |           </button>
0277 |           <button
0278 |             onClick={() => { const r = previousPayPeriod(settings?.pay_period_type ?? "biweekly", settings?.pay_period_anchor ?? null); setFrom(r.start); setTo(r.end); }}
0279 |             className="h-9 px-3 rounded-md border border-input text-sm"
0280 |           >
0281 |             Last pay period
0282 |           </button>
0283 |         </section>
0284 | 
0285 |         <section className="bg-card border border-border rounded-lg p-4 grid grid-cols-1 md:grid-cols-4 gap-3 print:hidden">
0286 |           <div className="md:col-span-2">
0287 |             <label className="text-xs uppercase tracking-wide text-muted-foreground">Staff member</label>
0288 |             <select
0289 |               value={selected}
0290 |               onChange={(e) => setSelected(e.target.value)}
0291 |               className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3"
0292 |             >
0293 |               {staff.length === 0 && <option value="">No staff yet</option>}
0294 |               {staff.map((s) => (
0295 |                 <option key={s.id} value={s.id}>
0296 |                   {s.name}{s.server_number ? ` (#${s.server_number})` : ""}
0297 |                 </option>
0298 |               ))}
0299 |             </select>
0300 |           </div>
0301 |           <div>
0302 |             <label className="text-xs uppercase tracking-wide text-muted-foreground">From</label>
0303 |             <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3" />
0304 |           </div>
0305 |           <div>
0306 |             <label className="text-xs uppercase tracking-wide text-muted-foreground">To</label>
0307 |             <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3" />
0308 |           </div>
0309 |           <div className="md:col-span-4 flex gap-2">
0310 |             <button onClick={downloadCSV} className="flex-1 h-11 rounded-md bg-primary text-primary-foreground font-medium">Download CSV</button>
0311 |             <button onClick={() => printElementFromClick(mainRef.current, "Individual Summary")} className="h-11 px-4 rounded-md border border-input">Print</button>
0312 |           </div>
0313 |         </section>
0314 | 
0315 |         <section className="bg-card border border-border rounded-lg p-6 text-center print-header" style={{ borderTop: `4px solid ${brand.primary}` }}>
0316 |           {brand.logoUrl && <img src={brand.logoUrl} alt="" className="mx-auto h-24 max-w-[240px] object-contain mb-3" />}
0317 |           <h2 className="text-2xl font-serif" style={{ color: brand.primary }}>{settings?.establishment_name || "Individual Tip Summary"}</h2>
0318 |           {person ? (
0319 |             <div className="mt-3 inline-flex items-center gap-3 rounded-full px-5 py-2" style={{ background: brand.soft }}>
0320 |               <span className="text-3xl font-bold tracking-tight" style={{ color: brand.primary }}>{person.name}</span>
0321 |               {person.server_number && (
0322 |                 <span className="text-lg font-semibold opacity-80" style={{ color: brand.primary }}>#{person.server_number}</span>
0323 |               )}
0324 |             </div>
0325 |           ) : (
0326 |             <p className="text-xl mt-3 font-medium text-muted-foreground">—</p>
0327 |           )}
0328 |           <p className="text-sm mt-3" style={{ color: brand.accent }}>{from} to {to}</p>
0329 |           <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
0330 |             <Stat label="Shifts worked" value={String(lines.length)} />
0331 |             <Stat label="Total tips" value={`$${totalTips(total).toFixed(2)}`} />
0332 |             <Stat label="Take-home" value={`$${total.takehome.toFixed(2)}`} />
0333 |             <Stat label="Avg per shift" value={`$${avg.toFixed(2)}`} />
0334 |           </div>
0335 |         </section>
0336 | 
0337 |         <section className="report-table bg-card border border-border rounded-lg overflow-x-auto">
0338 |           <table className="w-full text-sm">
0339 |             <thead style={{ background: brand.primary, color: brand.onPrimary }}>
0340 |               <tr>
0341 |                 <Th>Date</Th><Th>Shift</Th><Th>Role(s)</Th>
0342 |                 <Th right>Hours</Th>
0343 |                 <Th right>Credit Tips</Th>
0344 |                 <Th right>From Servers</Th>
0345 |                 <Th right>LBW Sales</Th>
0346 |                 <Th right>Bar Out</Th><Th right>R/B Out</Th><Th right>R/B Recv</Th>
0347 |                 <Th right>Take-Home (%)</Th>
0348 |               </tr>
0349 |             </thead>
0350 |             <tbody>
0351 |               {loading && <tr><td colSpan={11} className="text-center p-8 text-muted-foreground">Loading…</td></tr>}
0352 |               {!loading && lines.length === 0 && (
0353 |                 <tr><td colSpan={11} className="text-center p-8 text-muted-foreground">No shifts for this person in this range.</td></tr>
0354 |               )}
0355 |               {lines.map((l) => {
0356 |                 const pct = takePct(l);
0357 |                 return (
0358 |                   <tr key={l.key} className="border-t border-border">
0359 |                     <Td>{dayLabel(l.date)}</Td>
0360 |                     <Td className="text-muted-foreground">{l.period}</Td>
0361 |                     <Td className="text-muted-foreground capitalize">{l.roles.join(", ")}</Td>
0362 |                     <Td right>{l.hours ? l.hours.toFixed(2) : "—"}</Td>
0363 |                     <Td right>${l.credit_tips.toFixed(2)}</Td>
0364 |                     <Td right className={l.bar_from_servers ? "" : "text-muted-foreground"}>
0365 |                       {l.bar_from_servers ? `$${l.bar_from_servers.toFixed(2)}` : "—"}
0366 |                     </Td>
0367 |                     <Td right>${l.lbw_sales.toFixed(2)}</Td>
0368 |                     <Td right>${l.bar_tip_out.toFixed(2)}</Td>
0369 |                     <Td right>${l.rb_tip_out.toFixed(2)}</Td>
0370 |                     <Td right>${l.rb_received.toFixed(2)}</Td>
0371 |                     <Td right className="font-medium">
0372 |                       ${l.takehome.toFixed(2)}
0373 |                       <span className="ml-1 text-xs font-normal text-muted-foreground">
0374 |                         ({pct === null ? "—" : `${pct.toFixed(1)}%`})
0375 |                       </span>
0376 |                     </Td>
0377 |                   </tr>
0378 |                 );
0379 |               })}
0380 |               {!loading && lines.length > 0 && (
0381 |                 <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
0382 |                   <Td>Total</Td>
0383 |                   <Td>{lines.length} shifts</Td>
0384 |                   <Td>—</Td>
0385 |                   <Td right>{total.hours.toFixed(2)}</Td>
0386 |                   <Td right>${total.credit_tips.toFixed(2)}</Td>
0387 |                   <Td right>${total.bar_from_servers.toFixed(2)}</Td>
0388 |                   <Td right>${total.lbw_sales.toFixed(2)}</Td>
0389 |                   <Td right>${total.bar_tip_out.toFixed(2)}</Td>
0390 |                   <Td right>${total.rb_tip_out.toFixed(2)}</Td>
0391 |                   <Td right>${total.rb_received.toFixed(2)}</Td>
0392 |                   <Td right>
0393 |                     ${total.takehome.toFixed(2)}
0394 |                     <span className="ml-1 text-xs font-normal text-muted-foreground">
0395 |                       ({takePct(total) === null ? "—" : `${takePct(total)!.toFixed(1)}%`})
0396 |                     </span>
0397 |                   </Td>
0398 |                 </tr>
0399 |               )}
0400 |             </tbody>
0401 |           </table>
0402 |         </section>
0403 |       </main>
0404 | 
0405 |       <style>{`
0406 |         @media print {
0407 |           @page { size: landscape; margin: 0.25in; }
0408 |           html, body { background: white !important; font-size: 9pt; }
0409 |           * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
0410 |           .print-header img { height: 1.35in !important; max-width: 2.8in !important; }
0411 |           .print-header { border: none !important; border-bottom: 2px solid ${brand.primary} !important; border-radius: 0 !important; padding: 0.15in 0 0.12in 0 !important; margin-bottom: 0.12in !important; }
0412 |           .print-header .rounded-full { border-radius: 9999px !important; padding: 0.08in 0.22in !important; margin-top: 0.08in !important; }
0413 |           .print-header .rounded-full span:first-child { font-size: 20pt !important; }
0414 |           .report-table { overflow: visible !important; border: none !important; border-radius: 0 !important; }
0415 |           .report-table table { width: 100% !important; table-layout: fixed; font-size: 8pt; border-collapse: collapse; }
0416 |           .report-table th, .report-table td { padding: 1px 3px !important; line-height: 1.2; word-break: break-word; overflow-wrap: anywhere; }
0417 |           .report-table thead { display: table-header-group; }
0418 |           .report-table tr { page-break-inside: avoid; break-inside: avoid; }
0419 |           main { max-width: none !important; padding: 0 !important; }
0420 |           main > * + * { margin-top: 0.12in !important; }
0421 |           section, .rounded-lg { border-radius: 0 !important; }
0422 |           section > div, section .p-4, .p-4 { padding: 0.06in !important; }
0423 |         }
0424 |       `}</style>
0425 |     </div>
0426 |   );
0427 | }
0428 | 
0429 | function Stat({ label, value }: { label: string; value: string }) {
0430 |   return (
0431 |     <div className="rounded-md border border-border p-3">
0432 |       <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
0433 |       <div className="text-lg font-medium tabular-nums">{value}</div>
0434 |     </div>
0435 |   );
0436 | }
0437 | function dayLabel(date: string) {
0438 |   const d = new Date(date + "T00:00:00");
0439 |   return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
0440 | }
0441 | function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
0442 |   return <th className={`px-3 py-2 text-xs uppercase tracking-wide font-medium whitespace-nowrap ${right ? "text-right" : "text-left"}`}>{children}</th>;
0443 | }
0444 | function Td({ children, right, className }: { children: React.ReactNode; right?: boolean; className?: string }) {
0445 |   return <td className={`px-3 py-2 whitespace-nowrap ${right ? "text-right tabular-nums" : ""} ${className ?? ""}`}>{children}</td>;
0446 | }
0447 | function csvEsc(s: string) {
0448 |   if (s == null) return "";
0449 |   return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
0450 | }
```

## `src/routes/_authenticated/trends.tsx`
```tsx
0001 | import { createFileRoute, Link } from "@tanstack/react-router";
0002 | import { useEffect, useMemo, useState } from "react";
0003 | import { supabase } from "@/integrations/supabase/client";
0004 | import {
0005 |   calcServer,
0006 |   calcBartender,
0007 |   calcSupportPool,
0008 |   poolFromShift,
0009 |   round2,
0010 |   splitBartenderShares,
0011 |   splitServerShares,
0012 |   type BartenderSplitMode,
0013 |   type Settings,
0014 |   type SupportRole,
0015 | } from "@/lib/calculations";
0016 | 
0017 | export const Route = createFileRoute("/_authenticated/trends")({
0018 |   head: () => ({
0019 |     meta: [
0020 |       { title: "Tip Trends · Tip Share" },
0021 |       { name: "description", content: "See historical tips by week or month and whether each person is trending up or down." },
0022 |       { property: "og:title", content: "Tip Trends · Tip Share" },
0023 |       { property: "og:description", content: "Week-over-week and month-over-month tip trends for your staff." },
0024 |       { property: "og:type", content: "website" },
0025 |       { name: "twitter:card", content: "summary" },
0026 |     ],
0027 |   }),
0028 |   component: TrendsPage,
0029 | });
0030 | 
0031 | type Staff = { id: string; name: string; server_number: string | null; role: string };
0032 | type ShiftRow = {
0033 |   id: string;
0034 |   shift_date: string;
0035 |   period: "AM" | "PM";
0036 |   shift_servers: { staff_id: string | null; cash_owed: number; credit_tips: number; lbw_sales: number; bar_tip_override: number | null; rb_tip_override: number | null; split_mode?: BartenderSplitMode | null; shift_server_members?: { staff_id: string; hours_worked: number }[] }[];
0037 |   shift_bartenders: {
0038 |     staff_id: string | null;
0039 |     cash_owed: number;
0040 |     credit_tips: number;
0041 |     rb_tip_override: number | null;
0042 |     split_mode: BartenderSplitMode;
0043 |     shift_bartender_members: { staff_id: string; hours_worked: number }[];
0044 |   }[];
0045 |   support_split_mode?: string | null;
0046 |   shift_support: { staff_id: string; hours_worked: number }[];
0047 | };
0048 | 
0049 | type Bucket = "week" | "month";
0050 | 
0051 | /** Monday-start week key, e.g. 2026-07-27 */
0052 | function weekKey(dateStr: string) {
0053 |   const d = new Date(dateStr + "T00:00:00");
0054 |   const dow = (d.getDay() + 6) % 7;
0055 |   d.setDate(d.getDate() - dow);
0056 |   return d.toISOString().slice(0, 10);
0057 | }
0058 | function monthKey(dateStr: string) {
0059 |   return dateStr.slice(0, 7);
0060 | }
0061 | function bucketLabel(key: string, bucket: Bucket) {
0062 |   if (bucket === "month") {
0063 |     const d = new Date(key + "-01T00:00:00");
0064 |     return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
0065 |   }
0066 |   const d = new Date(key + "T00:00:00");
0067 |   return `Wk of ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
0068 | }
0069 | 
0070 | function TrendsPage() {
0071 |   const [bucket, setBucket] = useState<Bucket>("week");
0072 |   const [periods, setPeriods] = useState(8);
0073 |   const [staff, setStaff] = useState<Staff[]>([]);
0074 |   const [settings, setSettings] = useState<Settings | null>(null);
0075 |   const [shifts, setShifts] = useState<ShiftRow[]>([]);
0076 |   const [loading, setLoading] = useState(true);
0077 |   const [selected, setSelected] = useState<string>("");
0078 | 
0079 |   const from = useMemo(() => {
0080 |     const d = new Date();
0081 |     if (bucket === "week") d.setDate(d.getDate() - 7 * periods);
0082 |     else d.setMonth(d.getMonth() - periods);
0083 |     return d.toISOString().slice(0, 10);
0084 |   }, [bucket, periods]);
0085 |   const to = new Date().toISOString().slice(0, 10);
0086 | 
0087 |   useEffect(() => {
0088 |     Promise.all([
0089 |       supabase.from("staff").select("id, name, server_number, role"),
0090 |       supabase.from("app_settings").select("*").limit(1).maybeSingle(),
0091 |     ]).then(([s, st]) => {
0092 |       setStaff((s.data ?? []) as Staff[]);
0093 |       setSettings(st.data as Settings | null);
0094 |     });
0095 |   }, []);
0096 | 
0097 |   useEffect(() => {
0098 |     setLoading(true);
0099 |     supabase
0100 |       .from("shifts")
0101 |       .select("id, shift_date, period, shift_servers(staff_id, cash_owed, credit_tips, lbw_sales, bar_tip_override, rb_tip_override, split_mode, shift_server_members(staff_id, hours_worked)), shift_bartenders(staff_id, cash_owed, credit_tips, rb_tip_override, split_mode, shift_bartender_members(staff_id, hours_worked)), shift_support(staff_id, hours_worked), support_split_mode")
0102 |       .gte("shift_date", from)
0103 |       .lte("shift_date", to)
0104 |       .order("shift_date")
0105 |       .then(({ data }) => {
0106 |         setShifts((data ?? []) as unknown as ShiftRow[]);
0107 |         setLoading(false);
0108 |       });
0109 |   }, [from, to]);
0110 | 
0111 |   const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
0112 | 
0113 |   /** staff_id -> bucketKey -> { takehome, shifts } */
0114 |   const series = useMemo(() => {
0115 |     const map = new Map<string, Map<string, { takehome: number; shifts: number }>>();
0116 |     const keys = new Set<string>();
0117 |     if (!settings) return { map, keys: [] as string[] };
0118 |     const bump = (id: string, key: string, takehome: number) => {
0119 |       const byKey = map.get(id) ?? new Map();
0120 |       const cur = byKey.get(key) ?? { takehome: 0, shifts: 0 };
0121 |       cur.takehome += takehome;
0122 |       byKey.set(key, cur);
0123 |       map.set(id, byKey);
0124 |     };
0125 |     const markShift = (id: string, key: string) => {
0126 |       const cur = map.get(id)?.get(key);
0127 |       if (cur) cur.shifts += 1;
0128 |     };
0129 | 
0130 |     for (const sh of shifts) {
0131 |       const key = bucket === "week" ? weekKey(sh.shift_date) : monthKey(sh.shift_date);
0132 |       keys.add(key);
0133 |       const seen = new Set<string>();
0134 | 
0135 |       for (const sv of sh.shift_servers) {
0136 |         const c = calcServer(sv, settings);
0137 |         const shares = splitServerShares(
0138 |           sv,
0139 |           { bar_tip: c.bar_tip, rb_tip: c.rb_tip, takehome: c.takehome },
0140 |           sv.split_mode ?? "single",
0141 |           sv.shift_server_members ?? [],
0142 |         );
0143 |         for (const share of shares) {
0144 |           bump(share.staff_id, key, share.takehome);
0145 |           seen.add(share.staff_id);
0146 |         }
0147 |       }
0148 | 
0149 |       const serverBarTotal = sh.shift_servers.reduce((s, sv) => s + calcServer(sv, settings).bar_tip, 0);
0150 |       const bartenderCount = Math.max(sh.shift_bartenders.length, 1);
0151 |       for (const bt of sh.shift_bartenders) {
0152 |         const collected = round2(serverBarTotal / bartenderCount);
0153 |         const c = calcBartender(bt, collected, settings);
0154 |         const shares = splitBartenderShares(
0155 |           bt,
0156 |           { rb_tip: c.rb_tip, takehome: c.takehome, collected_from_servers: collected },
0157 |           bt.split_mode ?? "single",
0158 |           bt.shift_bartender_members ?? [],
0159 |         );
0160 |         for (const share of shares) {
0161 |           bump(share.staff_id, key, share.takehome);
0162 |           seen.add(share.staff_id);
0163 |         }
0164 |       }
0165 | 
0166 |       const pool = poolFromShift(sh.shift_servers, sh.shift_bartenders, settings);
0167 |       const supportRows = sh.shift_support.map((sp) => ({
0168 |         staff_id: sp.staff_id,
0169 |         role: (staffById.get(sp.staff_id)?.role ?? "runner") as SupportRole,
0170 |         hours_worked: sp.hours_worked,
0171 |       }));
0172 |       const payouts = calcSupportPool(supportRows, pool, settings, (sh.support_split_mode === "shared" ? "shared" : "weighted"));
0173 |       for (const sp of sh.shift_support) {
0174 |         const payout = payouts.find((p) => p.staff_id === sp.staff_id)?.payout ?? 0;
0175 |         bump(sp.staff_id, key, payout);
0176 |         seen.add(sp.staff_id);
0177 |       }
0178 | 
0179 |       for (const id of seen) markShift(id, key);
0180 |     }
0181 |     return { map, keys: Array.from(keys).sort() };
0182 |   }, [shifts, settings, staffById, bucket]);
0183 | 
0184 |   const bucketKeys = series.keys;
0185 |   const lastKey = bucketKeys[bucketKeys.length - 1];
0186 |   const prevKey = bucketKeys[bucketKeys.length - 2];
0187 | 
0188 |   const rows = useMemo(() => {
0189 |     return Array.from(series.map.entries())
0190 |       .map(([id, byKey]) => {
0191 |         const cur = byKey.get(lastKey ?? "")?.takehome ?? 0;
0192 |         const prev = byKey.get(prevKey ?? "")?.takehome ?? 0;
0193 |         const delta = round2(cur - prev);
0194 |         const pct = prev > 0 ? (delta / prev) * 100 : null;
0195 |         return { staff: staffById.get(id), byKey, cur, prev, delta, pct };
0196 |       })
0197 |       .filter((r) => r.staff)
0198 |       .sort((a, b) => b.cur - a.cur);
0199 |   }, [series, staffById, lastKey, prevKey]);
0200 | 
0201 |   const houseTotals = useMemo(
0202 |     () =>
0203 |       bucketKeys.map((k) => ({
0204 |         key: k,
0205 |         total: round2(rows.reduce((s, r) => s + (r.byKey.get(k)?.takehome ?? 0), 0)),
0206 |       })),
0207 |     [bucketKeys, rows],
0208 |   );
0209 |   const maxHouse = Math.max(1, ...houseTotals.map((h) => h.total));
0210 | 
0211 |   const detail = rows.find((r) => r.staff!.id === selected);
0212 |   const detailPoints = detail ? bucketKeys.map((k) => detail.byKey.get(k)?.takehome ?? 0) : [];
0213 |   const detailMax = Math.max(1, ...detailPoints);
0214 | 
0215 |   const label = bucket === "week" ? "week over week" : "month over month";
0216 | 
0217 |   return (
0218 |     <div className="min-h-screen bg-background">
0219 |       <header className="sticky top-0 bg-background border-b border-border z-10">
0220 |         <div className="max-w-5xl mx-auto p-4 flex items-center gap-3">
0221 |           <Link to="/" className="text-sm text-muted-foreground">← Home</Link>
0222 |           <h1 className="text-lg font-serif flex-1">Tip Trends</h1>
0223 |         </div>
0224 |       </header>
0225 | 
0226 |       <main className="max-w-5xl mx-auto p-4 space-y-4">
0227 |         <section className="flex flex-wrap items-center gap-2">
0228 |           {(["week", "month"] as const).map((b) => (
0229 |             <button
0230 |               key={b}
0231 |               onClick={() => { setBucket(b); setSelected(""); }}
0232 |               className={`h-9 px-3 rounded-md text-sm border ${bucket === b ? "bg-primary text-primary-foreground border-transparent" : "border-input"}`}
0233 |             >
0234 |               {b === "week" ? "Weekly" : "Monthly"}
0235 |             </button>
0236 |           ))}
0237 |           <select
0238 |             value={periods}
0239 |             onChange={(e) => setPeriods(Number(e.target.value))}
0240 |             className="h-9 px-2 rounded-md border border-input bg-background text-sm"
0241 |           >
0242 |             {[4, 8, 12, 26].map((n) => (
0243 |               <option key={n} value={n}>Last {n} {bucket === "week" ? "weeks" : "months"}</option>
0244 |             ))}
0245 |           </select>
0246 |         </section>
0247 | 
0248 |         <section className="bg-card border border-border rounded-lg p-4">
0249 |           <h2 className="text-sm font-medium mb-3">Total take-home by {bucket}</h2>
0250 |           {houseTotals.length === 0 && <p className="text-sm text-muted-foreground">No shifts yet in this range.</p>}
0251 |           <div className="flex items-end gap-2 h-32">
0252 |             {houseTotals.map((h) => (
0253 |               <div key={h.key} className="flex-1 min-w-0 flex flex-col items-center justify-end gap-1">
0254 |                 <span className="text-[10px] tabular-nums text-muted-foreground">${h.total.toFixed(0)}</span>
0255 |                 <div className="w-full rounded-t bg-primary/70" style={{ height: `${(h.total / maxHouse) * 90}%` }} />
0256 |                 <span className="text-[10px] text-muted-foreground truncate w-full text-center">{bucketLabel(h.key, bucket)}</span>
0257 |               </div>
0258 |             ))}
0259 |           </div>
0260 |         </section>
0261 | 
0262 |         <section className="bg-card border border-border rounded-lg overflow-x-auto">
0263 |           <table className="w-full text-sm">
0264 |             <thead className="bg-secondary text-secondary-foreground">
0265 |               <tr>
0266 |                 <Th>Name</Th><Th>#</Th>
0267 |                 <Th right>Shifts ({bucket === "week" ? "this wk" : "this mo"})</Th>
0268 |                 <Th right>Latest</Th>
0269 |                 <Th right>Previous</Th>
0270 |                 <Th right>Change</Th>
0271 |                 <Th>Trend</Th>
0272 |               </tr>
0273 |             </thead>
0274 |             <tbody>
0275 |               {loading && <tr><td colSpan={7} className="text-center p-8 text-muted-foreground">Loading…</td></tr>}
0276 |               {!loading && rows.length === 0 && (
0277 |                 <tr><td colSpan={7} className="text-center p-8 text-muted-foreground">No tip history in this range.</td></tr>
0278 |               )}
0279 |               {rows.map((r) => {
0280 |                 const up = r.delta > 0.005;
0281 |                 const down = r.delta < -0.005;
0282 |                 return (
0283 |                   <tr
0284 |                     key={r.staff!.id}
0285 |                     onClick={() => setSelected(selected === r.staff!.id ? "" : r.staff!.id)}
0286 |                     className={`border-t border-border cursor-pointer hover:bg-secondary/40 ${selected === r.staff!.id ? "bg-secondary/50" : ""}`}
0287 |                   >
0288 |                     <Td>{r.staff!.name}</Td>
0289 |                     <Td className="text-muted-foreground">{r.staff!.server_number ?? "—"}</Td>
0290 |                     <Td right>{r.byKey.get(lastKey ?? "")?.shifts ?? 0}</Td>
0291 |                     <Td right>${r.cur.toFixed(2)}</Td>
0292 |                     <Td right className="text-muted-foreground">${r.prev.toFixed(2)}</Td>
0293 |                     <Td right className={up ? "text-emerald-600 font-medium" : down ? "text-destructive font-medium" : "text-muted-foreground"}>
0294 |                       {up ? "▲" : down ? "▼" : "–"} ${Math.abs(r.delta).toFixed(2)}
0295 |                       {r.pct !== null && (up || down) ? ` (${r.pct > 0 ? "+" : ""}${r.pct.toFixed(0)}%)` : ""}
0296 |                     </Td>
0297 |                     <Td>
0298 |                       <Spark values={bucketKeys.map((k) => r.byKey.get(k)?.takehome ?? 0)} />
0299 |                     </Td>
0300 |                   </tr>
0301 |                 );
0302 |               })}
0303 |             </tbody>
0304 |           </table>
0305 |         </section>
0306 | 
0307 |         <p className="text-xs text-muted-foreground">
0308 |           Change compares the two most recent {bucket === "week" ? "weeks" : "months"} with data ({label}). Tap a row for their full history.
0309 |         </p>
0310 | 
0311 |         {detail && (
0312 |           <section className="bg-card border border-border rounded-lg p-4">
0313 |             <h2 className="text-sm font-medium mb-3">{detail.staff!.name} — take-home history</h2>
0314 |             <div className="flex items-end gap-2 h-32">
0315 |               {bucketKeys.map((k, i) => (
0316 |                 <div key={k} className="flex-1 min-w-0 flex flex-col items-center justify-end gap-1">
0317 |                   <span className="text-[10px] tabular-nums text-muted-foreground">${detailPoints[i].toFixed(0)}</span>
0318 |                   <div className="w-full rounded-t bg-emerald-500/70" style={{ height: `${(detailPoints[i] / detailMax) * 90}%` }} />
0319 |                   <span className="text-[10px] text-muted-foreground truncate w-full text-center">{bucketLabel(k, bucket)}</span>
0320 |                 </div>
0321 |               ))}
0322 |             </div>
0323 |           </section>
0324 |         )}
0325 |       </main>
0326 |     </div>
0327 |   );
0328 | }
0329 | 
0330 | function Spark({ values }: { values: number[] }) {
0331 |   const max = Math.max(1, ...values);
0332 |   return (
0333 |     <span className="inline-flex items-end gap-[2px] h-6">
0334 |       {values.map((v, i) => (
0335 |         <span key={i} className="w-[4px] rounded-sm bg-primary/60" style={{ height: `${Math.max(6, (v / max) * 100)}%` }} />
0336 |       ))}
0337 |     </span>
0338 |   );
0339 | }
0340 | 
0341 | function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
0342 |   return <th className={`px-3 py-2 text-xs uppercase tracking-wide font-medium whitespace-nowrap ${right ? "text-right" : "text-left"}`}>{children}</th>;
0343 | }
0344 | function Td({ children, right, className }: { children: React.ReactNode; right?: boolean; className?: string }) {
0345 |   return <td className={`px-3 py-2 whitespace-nowrap ${right ? "text-right tabular-nums" : ""} ${className ?? ""}`}>{children}</td>;
0346 | }
```

## `src/routes/_authenticated/shift.new.tsx`
```tsx
0001 | import { createFileRoute, Link, useNavigate, useBlocker } from "@tanstack/react-router";
0002 | import { useEffect, useMemo, useRef, useState } from "react";
0003 | import { supabase } from "@/integrations/supabase/client";
0004 | import {
0005 |   calcServer,
0006 |   calcBartender,
0007 |   calcSupportPool,
0008 |   poolFromShift,
0009 |   splitBartenderShares,
0010 |   splitServerShares,
0011 |   type BartenderSplitMode,
0012 |   type Settings,
0013 |   type SupportRole,
0014 |   type SupportSplitMode,
0015 | } from "@/lib/calculations";
0016 | 
0017 | 
0018 | type NewShiftSearch = { date?: string; period?: "AM" | "PM" };
0019 | 
0020 | export const Route = createFileRoute("/_authenticated/shift/new")({
0021 |   head: () => ({ meta: [{ title: "New Shift · Tip Share" }] }),
0022 |   validateSearch: (search: Record<string, unknown>): NewShiftSearch => ({
0023 |     date: typeof search.date === "string" ? search.date : undefined,
0024 |     period: search.period === "AM" || search.period === "PM" ? search.period : undefined,
0025 |   }),
0026 |   component: NewShiftRoute,
0027 | });
0028 | 
0029 | function NewShiftRoute() {
0030 |   const { date, period } = Route.useSearch();
0031 |   return <ShiftForm key={`${date ?? ""}-${period ?? ""}`} prefillDate={date} prefillPeriod={period} />;
0032 | }
0033 | 
0034 | type Staff = { id: string; name: string; server_number: string | null; role: string; positions: string[] };
0035 | 
0036 | type BartenderMemberInput = { staff_id: string; hours_worked: string };
0037 | type ServerEntry = {
0038 |   staff_id: string;
0039 |   cash_owed: string;
0040 |   credit_tips: string;
0041 |   lbw_sales: string;
0042 |   total_sales: string;
0043 |   bar_tip_override: string;
0044 |   rb_tip_override: string;
0045 |   split_mode: BartenderSplitMode;
0046 |   members: BartenderMemberInput[];
0047 | };
0048 | type BartenderEntry = {
0049 |   staff_id: string;
0050 |   cash_owed: string;
0051 |   credit_tips: string;
0052 |   total_sales: string;
0053 |   rb_tip_override: string;
0054 |   split_mode: BartenderSplitMode;
0055 |   members: BartenderMemberInput[];
0056 | };
0057 | 
0058 | type SupportEntry = { staff_id: string; role: SupportRole | ""; hours_worked: string };
0059 | 
0060 | 
0061 | const SUPPORT_ROLES: SupportRole[] = ["runner", "busser", "bar_back", "hostess"];
0062 | const fmt = (n: number) => `$${n.toFixed(2)}`;
0063 | const pct = (take: number, total: number) => (total > 0 ? `${((take / total) * 100).toFixed(1)}% of tips` : "—");
0064 | 
0065 | 
0066 | export function ShiftForm({ initialShiftId, prefillDate, prefillPeriod }: { initialShiftId?: string; prefillDate?: string; prefillPeriod?: "AM" | "PM" } = {}) {
0067 | 
0068 |   const navigate = useNavigate();
0069 |   const [staff, setStaff] = useState<Staff[]>([]);
0070 |   const [settings, setSettings] = useState<Settings | null>(null);
0071 |   const [date, setDate] = useState(() => prefillDate ?? new Date().toISOString().slice(0, 10));
0072 |   const [period, setPeriod] = useState<"AM" | "PM">(prefillPeriod ?? "PM");
0073 |   const [notes, setNotes] = useState("");
0074 |   const [servers, setServers] = useState<ServerEntry[]>([]);
0075 |   const [bartenders, setBartenders] = useState<BartenderEntry[]>([]);
0076 |   const [support, setSupport] = useState<SupportEntry[]>([]);
0077 |   const [supportSplit, setSupportSplit] = useState<SupportSplitMode>("weighted");
0078 |   const [saving, setSaving] = useState(false);
0079 |   const [switchingPeriod, setSwitchingPeriod] = useState(false);
0080 |   const [err, setErr] = useState<string | null>(null);
0081 |   const [pendingDate, setPendingDate] = useState<string | null>(null);
0082 |   const [dayPeriods, setDayPeriods] = useState<{ AM: boolean; PM: boolean }>({ AM: false, PM: false });
0083 |   const [moveBusy, setMoveBusy] = useState(false);
0084 |   const [moveErr, setMoveErr] = useState<string | null>(null);
0085 |   const [confirmDelete, setConfirmDelete] = useState(false);
0086 |   const [deleting, setDeleting] = useState(false);
0087 |   const [deleteErr, setDeleteErr] = useState<string | null>(null);
0088 | 
0089 |   const [locationId, setLocationId] = useState<string | null>(null);
0090 |   const [amCash, setAmCash] = useState(0);
0091 |   const [amCashLoaded, setAmCashLoaded] = useState(false);
0092 |   const [amCashNonce, setAmCashNonce] = useState(0);
0093 | 
0094 |   // Keep the AM subtotal fresh: refetch whenever this tab regains focus.
0095 |   useEffect(() => {
0096 |     const bump = () => setAmCashNonce((n) => n + 1);
0097 |     const onVis = () => { if (document.visibilityState === "visible") bump(); };
0098 |     window.addEventListener("focus", bump);
0099 |     document.addEventListener("visibilitychange", onVis);
0100 |     return () => {
0101 |       window.removeEventListener("focus", bump);
0102 |       document.removeEventListener("visibilitychange", onVis);
0103 |     };
0104 |   }, []);
0105 | 
0106 |   useEffect(() => {
0107 |     if (period !== "PM" || !date || !locationId) {
0108 |       setAmCash(0);
0109 |       setAmCashLoaded(false);
0110 |       return;
0111 |     }
0112 | 
0113 |     let cancelled = false;
0114 |     (async () => {
0115 |       setAmCashLoaded(false);
0116 |       const { data: am, error: shiftError } = await supabase
0117 |         .from("shifts")
0118 |         .select("id")
0119 |         .eq("shift_date", date)
0120 |         .eq("period", "AM")
0121 |         .eq("location_id", locationId)
0122 |         .neq("id", initialShiftId ?? "00000000-0000-0000-0000-000000000000")
0123 |         .limit(1)
0124 |         .maybeSingle();
0125 |       if (cancelled) return;
0126 | 
0127 |       if (shiftError || !am?.id) {
0128 |         setAmCash(0);
0129 |         setAmCashLoaded(true);
0130 |         return;
0131 |       }
0132 | 
0133 |       const [serverCashRows, bartenderCashRows] = await Promise.all([
0134 |         supabase.from("shift_servers").select("cash_owed").eq("shift_id", am.id),
0135 |         supabase.from("shift_bartenders").select("cash_owed").eq("shift_id", am.id),
0136 |       ]);
0137 |       if (cancelled) return;
0138 | 
0139 |       const s = (serverCashRows.data ?? []).reduce((sum, r) => sum + Number(r.cash_owed ?? 0), 0);
0140 |       const b = (bartenderCashRows.data ?? []).reduce((sum, r) => sum + Number(r.cash_owed ?? 0), 0);
0141 |       setAmCash(s + b);
0142 |       setAmCashLoaded(true);
0143 |     })();
0144 |     return () => { cancelled = true; };
0145 |   }, [date, period, initialShiftId, locationId, amCashNonce]);
0146 | 
0147 | 
0148 |   useEffect(() => {
0149 |     (async () => {
0150 |       const { data: { user } } = await supabase.auth.getUser();
0151 |       if (!user) return;
0152 |       const { data: mem } = await supabase
0153 |         .from("location_members")
0154 |         .select("location_id")
0155 |         .eq("user_id", user.id)
0156 |         .limit(1)
0157 |         .maybeSingle();
0158 |       const loc = mem?.location_id ?? null;
0159 |       setLocationId(loc);
0160 | 
0161 |       const [s, st] = await Promise.all([
0162 |         supabase.from("staff").select("id, name, server_number, role, is_manager, staff_positions(position)").eq("active", true).order("server_number"),
0163 |         supabase.from("app_settings").select("*").limit(1).maybeSingle(),
0164 |       ]);
0165 |       const settingsRow = st.data as (Settings & { manager_exclusion_enabled?: boolean }) | null;
0166 |       const excludeManagers = !!settingsRow?.manager_exclusion_enabled;
0167 |       const rows = (s.data ?? []) as Array<Staff & { is_manager?: boolean; staff_positions: { position: string }[] }>;
0168 |       const filtered = excludeManagers ? rows.filter((r) => !r.is_manager) : rows;
0169 |       setStaff(filtered.map((r) => ({
0170 |         id: r.id, name: r.name, server_number: r.server_number, role: r.role,
0171 |         positions: r.staff_positions?.length ? r.staff_positions.map((p) => p.position) : [r.role],
0172 |       })));
0173 |       setSettings(settingsRow);
0174 | 
0175 |     })();
0176 |   }, []);
0177 | 
0178 | 
0179 |   const has = (s: Staff, pos: string) => s.positions.includes(pos);
0180 |   const serverList = staff.filter((s) => has(s, "server"));
0181 |   const bartenderList = staff.filter((s) => has(s, "bartender"));
0182 |   const supportList = staff.filter((s) => SUPPORT_ROLES.some((r) => has(s, r)));
0183 |   const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
0184 | 
0185 |   const num = (s: string) => Number(s) || 0;
0186 |   const optNum = (s: string) => (s.trim() === "" ? null : Number(s));
0187 |   const serverRows = servers.map((s) => ({
0188 |     staff_id: s.staff_id,
0189 |     cash_owed: num(s.cash_owed),
0190 |     credit_tips: num(s.credit_tips),
0191 |     lbw_sales: num(s.lbw_sales),
0192 |     total_sales: num(s.total_sales),
0193 |     bar_tip_override: optNum(s.bar_tip_override),
0194 |     rb_tip_override: optNum(s.rb_tip_override),
0195 |     split_mode: s.split_mode,
0196 |     members: s.members
0197 |       .filter((m) => m.staff_id)
0198 |       .map((m) => ({ staff_id: m.staff_id, hours_worked: num(m.hours_worked) })),
0199 |   }));
0200 |   const bartenderRows = bartenders.map((b) => ({
0201 |     staff_id: b.split_mode === "single" ? b.staff_id : null,
0202 |     cash_owed: num(b.cash_owed),
0203 |     credit_tips: num(b.credit_tips),
0204 |     total_sales: num(b.total_sales),
0205 |     rb_tip_override: optNum(b.rb_tip_override),
0206 |     split_mode: b.split_mode,
0207 |     members: b.members
0208 |       .filter((m) => m.staff_id)
0209 |       .map((m) => ({ staff_id: m.staff_id, hours_worked: num(m.hours_worked) })),
0210 |   }));
0211 | 
0212 | 
0213 | 
0214 |   const salesBasis = settings?.rb_basis === "sales";
0215 |   const pool = settings ? poolFromShift(serverRows, bartenderRows, settings) : 0;
0216 |   const supportRows = support.map((sp) => ({
0217 |     staff_id: sp.staff_id,
0218 |     role: (sp.role || (staffById.get(sp.staff_id)?.positions.find((p) => SUPPORT_ROLES.includes(p as SupportRole)) ?? "runner")) as SupportRole,
0219 |     hours_worked: num(sp.hours_worked),
0220 |   }));
0221 |   const supportPayouts = settings ? calcSupportPool(supportRows, pool, settings, supportSplit) : [];
0222 | 
0223 |   const [shiftId, setShiftId] = useState<string | null>(initialShiftId ?? null);
0224 |   const [savedAt, setSavedAt] = useState<Date | null>(null);
0225 |   const [dirty, setDirty] = useState(false);
0226 |   const hydratedRef = useRef<boolean>(!initialShiftId);
0227 |   const savingRef = useRef(false);
0228 |   const pendingRef = useRef(false);
0229 | 
0230 | 
0231 |   async function openPeriod(nextPeriod: "AM" | "PM") {
0232 |     if (nextPeriod === period || switchingPeriod) return;
0233 |     if (!date) {
0234 |       setPeriod(nextPeriod);
0235 |       return;
0236 |     }
0237 | 
0238 |     setErr(null);
0239 |     setSwitchingPeriod(true);
0240 |     try {
0241 |       let query = supabase
0242 |         .from("shifts")
0243 |         .select("id")
0244 |         .eq("shift_date", date)
0245 |         .eq("period", nextPeriod)
0246 |         .limit(1);
0247 | 
0248 |       if (locationId) query = query.eq("location_id", locationId);
0249 | 
0250 |       const { data, error } = await query.maybeSingle();
0251 |       if (error) throw error;
0252 | 
0253 |       if (data?.id) {
0254 |         navigate({ to: "/shift/$id/edit", params: { id: data.id } });
0255 |       } else {
0256 |         navigate({ to: "/shift/new", search: { date, period: nextPeriod } });
0257 |       }
0258 |     } catch (e) {
0259 |       setErr((e as Error).message);
0260 |       setPeriod(nextPeriod);
0261 |       setSwitchingPeriod(false);
0262 |     }
0263 |   }
0264 | 
0265 |   const hasEntries =
0266 |     servers.some((r) => r.staff_id || r.members.length > 0) ||
0267 |     bartenders.some((r) => r.staff_id || r.members.length > 0) ||
0268 |     support.some((r) => r.staff_id) ||
0269 |     notes.trim().length > 0;
0270 | 
0271 |   async function requestDateChange(next: string) {
0272 |     if (!next || next === date) return;
0273 |     if (!hasEntries && !shiftId) {
0274 |       setDate(next);
0275 |       return;
0276 |     }
0277 |     setMoveErr(null);
0278 |     const periods: { AM: boolean; PM: boolean } = { AM: false, PM: false };
0279 |     if (locationId) {
0280 |       const { data } = await supabase
0281 |         .from("shifts")
0282 |         .select("period")
0283 |         .eq("shift_date", date)
0284 |         .eq("location_id", locationId);
0285 |       for (const r of data ?? []) periods[r.period as "AM" | "PM"] = true;
0286 |     }
0287 |     periods[period] = true;
0288 |     setDayPeriods(periods);
0289 |     setPendingDate(next);
0290 |   }
0291 | 
0292 |   async function confirmDateChange() {
0293 |     const next = pendingDate;
0294 |     if (!next) return;
0295 |     setMoveBusy(true);
0296 |     setMoveErr(null);
0297 |     try {
0298 |       if (hasEntries || shiftId) await save();
0299 |       if (locationId) {
0300 |         const { data: clash } = await supabase
0301 |           .from("shifts")
0302 |           .select("period")
0303 |           .eq("shift_date", next)
0304 |           .eq("location_id", locationId);
0305 |         if ((clash ?? []).length) {
0306 |           setMoveErr(
0307 |             `${next} already has a ${(clash ?? []).map((c) => c.period).join(" and ")} shift. Move or delete it first.`,
0308 |           );
0309 |           setMoveBusy(false);
0310 |           return;
0311 |         }
0312 |         const { error } = await supabase
0313 |           .from("shifts")
0314 |           .update({ shift_date: next })
0315 |           .eq("shift_date", date)
0316 |           .eq("location_id", locationId);
0317 |         if (error) throw error;
0318 |       }
0319 |       setDate(next);
0320 |       setPendingDate(null);
0321 |     } catch (e) {
0322 |       setMoveErr((e as Error).message);
0323 |     } finally {
0324 |       setMoveBusy(false);
0325 |     }
0326 |   }
0327 | 
0328 |   async function deleteShift() {
0329 |     if (!shiftId) return;
0330 |     setDeleting(true);
0331 |     setDeleteErr(null);
0332 |     try {
0333 |       hydratedRef.current = false; // stop autosave from re-creating the shift
0334 |       savingRef.current = true;
0335 |       await Promise.all([
0336 |         supabase.from("shift_servers").delete().eq("shift_id", shiftId),
0337 |         supabase.from("shift_bartenders").delete().eq("shift_id", shiftId),
0338 |         supabase.from("shift_support").delete().eq("shift_id", shiftId),
0339 |       ]);
0340 |       const { error } = await supabase.from("shifts").delete().eq("id", shiftId);
0341 |       if (error) throw error;
0342 |       navigate({ to: "/shifts" });
0343 |     } catch (e) {
0344 |       hydratedRef.current = true;
0345 |       savingRef.current = false;
0346 |       setDeleteErr((e as Error).message);
0347 |       setDeleting(false);
0348 |     }
0349 |   }
0350 | 
0351 | 
0352 | 
0353 |   useEffect(() => {
0354 |     if (!initialShiftId) return;
0355 |     (async () => {
0356 |       const { data } = await supabase
0357 |         .from("shifts")
0358 |         .select("shift_date, period, notes, support_split_mode, shift_servers(*, shift_server_members(*)), shift_bartenders(*, shift_bartender_members(*)), shift_support(*)")
0359 |         .eq("id", initialShiftId)
0360 |         .maybeSingle();
0361 |       if (!data) return;
0362 |       setDate(data.shift_date);
0363 |       setPeriod(data.period as "AM" | "PM");
0364 |       setNotes(data.notes ?? "");
0365 |       setSupportSplit(((data as any).support_split_mode ?? "weighted") as SupportSplitMode);
0366 |       const str = (v: number | null | undefined) => (v == null ? "" : String(v));
0367 |       setServers((data.shift_servers ?? []).map((r: any) => ({
0368 |         staff_id: r.staff_id ?? "",
0369 |         cash_owed: str(r.cash_owed),
0370 |         credit_tips: str(r.credit_tips),
0371 |         lbw_sales: str(r.lbw_sales),
0372 |         total_sales: str(r.total_sales),
0373 |         bar_tip_override: str(r.bar_tip_override),
0374 |         rb_tip_override: str(r.rb_tip_override),
0375 |         split_mode: (r.split_mode ?? "single") as BartenderSplitMode,
0376 |         members: (r.shift_server_members ?? []).map((m: any) => ({
0377 |           staff_id: m.staff_id, hours_worked: str(m.hours_worked),
0378 |         })),
0379 |       })));
0380 |       setBartenders((data.shift_bartenders ?? []).map((r: any) => ({
0381 |         staff_id: r.staff_id ?? "",
0382 |         cash_owed: str(r.cash_owed),
0383 |         credit_tips: str(r.credit_tips),
0384 |         total_sales: str(r.total_sales),
0385 |         rb_tip_override: str(r.rb_tip_override),
0386 |         split_mode: (r.split_mode ?? "single") as BartenderSplitMode,
0387 |         members: (r.shift_bartender_members ?? []).map((m: any) => ({
0388 |           staff_id: m.staff_id, hours_worked: str(m.hours_worked),
0389 |         })),
0390 |       })));
0391 | 
0392 |       setSupport((data.shift_support ?? []).map((r: any) => ({
0393 |         staff_id: r.staff_id,
0394 |         role: (r.role ?? "") as SupportRole | "",
0395 |         hours_worked: str(r.hours_worked),
0396 |       })));
0397 |       // allow autosave after initial hydration completes
0398 |       setTimeout(() => { hydratedRef.current = true; }, 0);
0399 |     })();
0400 |   }, [initialShiftId]);
0401 | 
0402 | 
0403 |   async function save(opts: { close?: boolean } = {}): Promise<void> {
0404 |     if (!settings) return;
0405 |     if (!locationId) { setErr("No location found for your account."); return; }
0406 |     if (savingRef.current) {
0407 |       // A save is already running: remember that newer edits need another pass
0408 |       // instead of silently dropping them.
0409 |       pendingRef.current = true;
0410 |       return;
0411 |     }
0412 |     savingRef.current = true;
0413 |     setErr(null);
0414 |     setSaving(true);
0415 |     let rollback: (() => Promise<void>) | null = null;
0416 |     try {
0417 |       let id = shiftId;
0418 | 
0419 | 
0420 |       if (id) {
0421 |         const { error: eu } = await supabase
0422 |           .from("shifts")
0423 |           .update({ shift_date: date, period, notes, support_split_mode: supportSplit } as any)
0424 |           .eq("id", id);
0425 |         if (eu) throw eu;
0426 |         // Snapshot existing rows so a failed re-insert can be rolled back
0427 |         // instead of leaving the shift empty.
0428 |         const [oldSv, oldBt, oldSp] = await Promise.all([
0429 |           supabase.from("shift_servers").select("*, shift_server_members(*)" as any).eq("shift_id", id),
0430 |           supabase.from("shift_bartenders").select("*, shift_bartender_members(*)").eq("shift_id", id),
0431 |           supabase.from("shift_support").select("*").eq("shift_id", id),
0432 |         ]);
0433 |         rollback = async () => {
0434 |           const strip = (r: any) => { const { id: _i, created_at: _c, updated_at: _u, shift_bartender_members: _m, shift_server_members: _sm, ...rest } = r; return rest; };
0435 |           for (const sv of (oldSv.data ?? []) as any[]) {
0436 |             const { data: rec } = await supabase.from("shift_servers").insert(strip(sv) as any).select("id").single();
0437 |             const mems = (sv.shift_server_members ?? []).map((m: any) => ({
0438 |               shift_server_id: rec?.id, staff_id: m.staff_id, hours_worked: m.hours_worked,
0439 |             }));
0440 |             if (rec?.id && mems.length) await supabase.from("shift_server_members" as any).insert(mems);
0441 |           }
0442 |           if ((oldSp.data ?? []).length) await supabase.from("shift_support").insert((oldSp.data ?? []).map(strip) as any);
0443 |           for (const b of (oldBt.data ?? []) as any[]) {
0444 |             const { data: rec } = await supabase.from("shift_bartenders").insert(strip(b) as any).select("id").single();
0445 |             const mems = (b.shift_bartender_members ?? []).map((m: any) => ({
0446 |               shift_bartender_id: rec?.id, staff_id: m.staff_id, hours_worked: m.hours_worked,
0447 |             }));
0448 |             if (rec?.id && mems.length) await supabase.from("shift_bartender_members" as any).insert(mems);
0449 |           }
0450 |         };
0451 |         // Clear children so we can re-insert current state.
0452 |         await Promise.all([
0453 |           supabase.from("shift_servers").delete().eq("shift_id", id),
0454 |           supabase.from("shift_bartenders").delete().eq("shift_id", id),
0455 |           supabase.from("shift_support").delete().eq("shift_id", id),
0456 |         ]);
0457 | 
0458 |       } else {
0459 |         // Guard: if a shift already exists for this date/period/location, open it instead of creating a duplicate.
0460 |         const { data: existing } = await supabase
0461 |           .from("shifts")
0462 |           .select("id")
0463 |           .eq("shift_date", date)
0464 |           .eq("period", period)
0465 |           .eq("location_id", locationId)
0466 |           .limit(1)
0467 |           .maybeSingle();
0468 |         if (existing?.id) {
0469 |           savingRef.current = false;
0470 |           setSaving(false);
0471 |           setErr(`A ${period} shift already exists for ${date}. Opening it instead.`);
0472 |           navigate({ to: "/shift/$id/edit", params: { id: existing.id } });
0473 |           return;
0474 |         }
0475 |         const { data: shift, error: e1 } = await supabase
0476 |           .from("shifts")
0477 |           .insert({ shift_date: date, period, notes, location_id: locationId, support_split_mode: supportSplit } as any)
0478 |           .select("id")
0479 |           .single();
0480 |         if (e1 || !shift) throw e1 ?? new Error("Insert failed");
0481 |         id = shift.id;
0482 |         setShiftId(id);
0483 |       }
0484 | 
0485 |       const serverPayload = serverRows.filter((r) => (r.split_mode === "single" ? r.staff_id : r.members.length > 0));
0486 |       if (serverPayload.length) {
0487 |         const { data: insertedSv, error } = await supabase.from("shift_servers").insert(
0488 |           serverPayload.map((r) => ({
0489 |             shift_id: id, staff_id: r.split_mode === "single" ? r.staff_id : null,
0490 |             cash_owed: r.cash_owed, credit_tips: r.credit_tips, lbw_sales: r.lbw_sales, total_sales: r.total_sales,
0491 |             bar_tip_override: r.bar_tip_override, rb_tip_override: r.rb_tip_override,
0492 |             split_mode: r.split_mode,
0493 |           })) as any,
0494 |         ).select("id");
0495 |         if (error) throw error;
0496 |         const svMemberInserts: any[] = [];
0497 |         (insertedSv ?? []).forEach((rec, idx) => {
0498 |           const src = serverPayload[idx];
0499 |           if (src.split_mode !== "single") {
0500 |             for (const m of src.members) {
0501 |               svMemberInserts.push({ shift_server_id: rec.id, staff_id: m.staff_id, hours_worked: m.hours_worked });
0502 |             }
0503 |           }
0504 |         });
0505 |         if (svMemberInserts.length) {
0506 |           const { error: sme } = await supabase.from("shift_server_members" as any).insert(svMemberInserts);
0507 |           if (sme) throw sme;
0508 |         }
0509 |       }
0510 |       const bartenderPayload = bartenderRows.filter((r) => r.staff_id || r.members.length > 0);
0511 |       if (bartenderPayload.length) {
0512 |         const { data: inserted, error } = await supabase
0513 |           .from("shift_bartenders")
0514 |           .insert(
0515 |             bartenderPayload.map((r) => ({
0516 |               shift_id: id,
0517 |               staff_id: r.staff_id,
0518 |               cash_owed: r.cash_owed,
0519 |               credit_tips: r.credit_tips,
0520 |               total_sales: r.total_sales,
0521 |               rb_tip_override: r.rb_tip_override,
0522 |               split_mode: r.split_mode,
0523 |             })) as any,
0524 |           )
0525 |           .select("id");
0526 |         if (error) throw error;
0527 |         const memberInserts: any[] = [];
0528 |         (inserted ?? []).forEach((rec, idx) => {
0529 |           const src = bartenderPayload[idx];
0530 |           if (src.split_mode !== "single") {
0531 |             for (const m of src.members) {
0532 |               memberInserts.push({ shift_bartender_id: rec.id, staff_id: m.staff_id, hours_worked: m.hours_worked });
0533 |             }
0534 |           }
0535 |         });
0536 |         if (memberInserts.length) {
0537 |           const { error: me } = await supabase.from("shift_bartender_members" as any).insert(memberInserts);
0538 |           if (me) throw me;
0539 |         }
0540 |       }
0541 | 
0542 | 
0543 |       if (supportRows.length) {
0544 |         const { error } = await supabase.from("shift_support").insert(
0545 |           supportRows.filter((r) => r.staff_id).map((r) => ({
0546 |             shift_id: id, staff_id: r.staff_id, hours_worked: r.hours_worked, role: r.role,
0547 |           })) as any,
0548 |         );
0549 |         if (error) throw error;
0550 |       }
0551 |       setSavedAt(new Date());
0552 |       setSaving(false);
0553 |       savingRef.current = false;
0554 |       if (pendingRef.current) {
0555 |         // Edits arrived while this save was in flight — write them too.
0556 |         pendingRef.current = false;
0557 |         await save();
0558 |         return;
0559 |       }
0560 |       setDirty(false);
0561 |       setAmCashNonce((n) => n + 1);
0562 |       if (opts.close) navigate({ to: "/" });
0563 |     } catch (e) {
0564 |       if (rollback) await rollback().catch(() => {});
0565 |       setErr(`${(e as Error).message} — nothing was lost, please try saving again.`);
0566 |       setSaving(false);
0567 |       savingRef.current = false;
0568 |       pendingRef.current = false;
0569 |     }
0570 |   }
0571 | 
0572 |   // Always call the freshest save (avoids stale-closure saves on unmount).
0573 |   const saveRef = useRef(save);
0574 |   saveRef.current = save;
0575 | 
0576 |   // Auto-save: debounced save when form data changes after hydration.
0577 |   useEffect(() => {
0578 |     if (!hydratedRef.current) return;
0579 |     if (!date || !settings || !locationId) return;
0580 |     setDirty(true);
0581 |     const t = setTimeout(() => { saveRef.current().catch(() => {}); }, 1500);
0582 |     return () => clearTimeout(t);
0583 |     // eslint-disable-next-line react-hooks/exhaustive-deps
0584 |   }, [servers, bartenders, support, supportSplit, notes, date, period, settings, locationId]);
0585 | 
0586 |   // Best-effort save on tab close / navigation away.
0587 |   useEffect(() => {
0588 |     const handler = () => {
0589 |       if (hydratedRef.current) saveRef.current().catch(() => {});
0590 |     };
0591 |     window.addEventListener("pagehide", handler);
0592 |     return () => {
0593 | 
0594 |       window.removeEventListener("pagehide", handler);
0595 |       handler();
0596 |     };
0597 |     // eslint-disable-next-line react-hooks/exhaustive-deps
0598 |   }, []);
0599 | 
0600 |   // Warn on tab close / reload while there are unsaved edits.
0601 |   const dirtyRef = useRef(dirty);
0602 |   dirtyRef.current = dirty;
0603 |   useEffect(() => {
0604 |     const onBeforeUnload = (e: BeforeUnloadEvent) => {
0605 |       if (!dirtyRef.current) return;
0606 |       e.preventDefault();
0607 |       e.returnValue = "";
0608 |     };
0609 |     window.addEventListener("beforeunload", onBeforeUnload);
0610 |     return () => window.removeEventListener("beforeunload", onBeforeUnload);
0611 |   }, []);
0612 | 
0613 |   // Prompt to save before navigating away with unsaved edits.
0614 |   const { status: blockStatus, proceed, reset } = useBlocker({
0615 |     shouldBlockFn: () => dirtyRef.current && !savingRef.current,
0616 |     enableBeforeUnload: false,
0617 |     withResolver: true,
0618 |   });
0619 | 
0620 | 
0621 | 
0622 |   if (!settings) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
0623 | 
0624 |   return (
0625 |     <div className="min-h-screen bg-background pb-32">
0626 |       {blockStatus === "blocked" && (
0627 |         <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
0628 |           <div className="bg-card border border-border rounded-lg p-5 max-w-sm w-full space-y-3">
0629 |             <h2 className="font-serif text-lg">Unsaved changes</h2>
0630 |             <p className="text-sm text-muted-foreground">You have shift edits that haven’t been saved yet. Save before leaving?</p>
0631 |             <div className="flex flex-col gap-2 pt-1">
0632 |               <button
0633 |                 onClick={async () => { await saveRef.current(); proceed(); }}
0634 |                 className="h-11 rounded-md bg-primary text-primary-foreground font-medium"
0635 |               >
0636 |                 Save and leave
0637 |               </button>
0638 |               <button onClick={() => proceed()} className="h-11 rounded-md border border-input text-sm font-medium">
0639 |                 Leave without saving
0640 |               </button>
0641 |               <button onClick={() => reset()} className="h-11 rounded-md text-sm text-muted-foreground">
0642 |                 Stay on this page
0643 |               </button>
0644 |             </div>
0645 |           </div>
0646 |         </div>
0647 |       )}
0648 |       <header className="sticky top-0 bg-background border-b border-border z-10">
0649 |         <div className="max-w-2xl mx-auto p-4 flex items-center gap-3">
0650 |           <Link to="/" className="text-sm text-muted-foreground">← Home</Link>
0651 |           <h1 className="text-lg font-serif flex-1">{initialShiftId ? "Edit Shift" : "New Shift"}</h1>
0652 |           <button
0653 |             onClick={async () => { await save(); navigate({ to: "/daily", search: { date } }); }}
0654 |             disabled={saving}
0655 |             className="h-9 px-3 rounded-md border border-input text-sm font-medium disabled:opacity-60"
0656 |           >
0657 |             {saving ? "Saving…" : "Print now"}
0658 |           </button>
0659 |         </div>
0660 | 
0661 |       </header>
0662 | 
0663 |       <main className="max-w-2xl mx-auto p-4 space-y-6">
0664 |         <section className="bg-card border border-border rounded-lg p-4 grid grid-cols-2 gap-3">
0665 |           <div>
0666 |             <label className="text-xs uppercase tracking-wide text-muted-foreground">Date</label>
0667 |             <input type="date" value={pendingDate ?? date} onChange={(e) => requestDateChange(e.target.value)} className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3" />
0668 |             {hasEntries && <p className="mt-1 text-[11px] text-muted-foreground">Changing the date moves the whole day (AM + PM).</p>}
0669 |           </div>
0670 |           <div>
0671 |             <label className="text-xs uppercase tracking-wide text-muted-foreground">Period</label>
0672 |             <div className="mt-1 flex gap-2">
0673 |               {(["AM", "PM"] as const).map((p) => (
0674 |                 <button key={p} onClick={() => openPeriod(p)} disabled={switchingPeriod} className={`flex-1 h-11 rounded-md border disabled:opacity-60 ${period === p ? "bg-primary text-primary-foreground border-primary" : "border-input"}`}>{switchingPeriod && period !== p ? "Opening…" : p}</button>
0675 |               ))}
0676 |             </div>
0677 |           </div>
0678 |         </section>
0679 | 
0680 |         <Section title="Servers" onAdd={() => setServers([...servers, { staff_id: "", cash_owed: "", credit_tips: "", lbw_sales: "", total_sales: "", bar_tip_override: "", rb_tip_override: "", split_mode: "single", members: [] }])}>
0681 |           {servers.map((row, i) => {
0682 |             const shared = row.split_mode !== "single";
0683 |             const raw = { staff_id: row.staff_id, cash_owed: num(row.cash_owed), credit_tips: num(row.credit_tips), lbw_sales: num(row.lbw_sales), total_sales: num(row.total_sales) };
0684 |             const auto = calcServer(raw, settings);
0685 |             const calc = calcServer({ ...raw, bar_tip_override: optNum(row.bar_tip_override), rb_tip_override: optNum(row.rb_tip_override) }, settings);
0686 |             const memberInputs = row.members
0687 |               .filter((m) => m.staff_id)
0688 |               .map((m) => ({ staff_id: m.staff_id, hours_worked: num(m.hours_worked) }));
0689 |             const shares = shared
0690 |               ? splitServerShares(
0691 |                   { staff_id: null, cash_owed: raw.cash_owed, credit_tips: raw.credit_tips, lbw_sales: raw.lbw_sales },
0692 |                   { bar_tip: calc.bar_tip, rb_tip: calc.rb_tip, takehome: calc.takehome },
0693 |                   row.split_mode,
0694 |                   memberInputs,
0695 |                 )
0696 |               : [];
0697 |             const updateMember = (mi: number, patch: Partial<BartenderMemberInput>) => {
0698 |               updateAt(servers, setServers, i, { members: row.members.map((m, j) => (j === mi ? { ...m, ...patch } : m)) });
0699 |             };
0700 |             const removeMember = (mi: number) => {
0701 |               updateAt(servers, setServers, i, { members: row.members.filter((_, j) => j !== mi) });
0702 |             };
0703 |             const addMember = () => {
0704 |               updateAt(servers, setServers, i, { members: [...row.members, { staff_id: "", hours_worked: "" }] });
0705 |             };
0706 |             return (
0707 |               <div key={i} className="border border-border rounded-md p-3 space-y-2 bg-background">
0708 |                 <div className="flex gap-2">
0709 |                   {!shared ? (
0710 |                     <select value={row.staff_id} onChange={(e) => updateAt(servers, setServers, i, { staff_id: e.target.value })} className="flex-1 h-11 rounded-md border border-input bg-background px-2">
0711 |                       <option value="">Select server…</option>
0712 |                       {serverList.map((s) => (<option key={s.id} value={s.id}>{s.name}{s.server_number ? ` #${s.server_number}` : ""}</option>))}
0713 |                     </select>
0714 |                   ) : (
0715 |                     <div className="flex-1 h-11 rounded-md border border-input bg-secondary/40 px-3 flex items-center text-sm text-muted-foreground">
0716 |                       Split party — {memberInputs.length} server{memberInputs.length === 1 ? "" : "s"}
0717 |                     </div>
0718 |                   )}
0719 |                   <button onClick={() => setServers(servers.filter((_, j) => j !== i))} className="px-3 h-11 rounded-md border border-input text-muted-foreground">×</button>
0720 |                 </div>
0721 | 
0722 |                 <div className="flex flex-wrap items-center gap-2">
0723 |                   <span className="text-xs text-muted-foreground">Split:</span>
0724 |                   <div className="inline-flex rounded-md border border-input overflow-hidden">
0725 |                     {(["single", "equal", "hours"] as BartenderSplitMode[]).map((m) => (
0726 |                       <button
0727 |                         key={m}
0728 |                         type="button"
0729 |                         onClick={() => {
0730 |                           if (m === "single") {
0731 |                             updateAt(servers, setServers, i, { split_mode: "single" });
0732 |                             return;
0733 |                           }
0734 |                           const seed: BartenderMemberInput[] = row.staff_id
0735 |                             ? [{ staff_id: row.staff_id, hours_worked: "" }]
0736 |                             : [{ staff_id: "", hours_worked: "" }, { staff_id: "", hours_worked: "" }];
0737 |                           updateAt(servers, setServers, i, {
0738 |                             split_mode: m,
0739 |                             members: row.members.length ? row.members : seed,
0740 |                           });
0741 |                         }}
0742 |                         className={`h-9 px-3 text-sm ${row.split_mode === m ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
0743 |                       >
0744 |                         {m === "single" ? "Individual" : m === "equal" ? "Split party (even)" : "Split party (hours)"}
0745 |                       </button>
0746 |                     ))}
0747 |                   </div>
0748 |                   <span className="text-xs text-muted-foreground">
0749 |                     {row.split_mode === "single"
0750 |                       ? "One server on this cash-out."
0751 |                       : row.split_mode === "equal"
0752 |                       ? "Cash-out splits evenly across everyone listed."
0753 |                       : "Enter hours worked — cash-out weighted by hours."}
0754 |                   </span>
0755 |                 </div>
0756 | 
0757 |                 {shared && (
0758 |                   <div className="space-y-2 pl-1 border-l-2 border-secondary">
0759 |                     {row.members.map((m, mi) => {
0760 |                       const share = shares.find((s) => s.staff_id === m.staff_id);
0761 |                       return (
0762 |                         <div key={mi} className="grid grid-cols-[1fr_100px_auto] gap-2 items-center">
0763 |                           <select value={m.staff_id} onChange={(e) => updateMember(mi, { staff_id: e.target.value })} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
0764 |                             <option value="">Select server…</option>
0765 |                             {serverList.map((s) => (<option key={s.id} value={s.id}>{s.name}{s.server_number ? ` #${s.server_number}` : ""}</option>))}
0766 |                           </select>
0767 |                           {row.split_mode === "hours" ? (
0768 |                             <input type="number" inputMode="decimal" step="0.25" placeholder="Hrs" value={m.hours_worked} onChange={(e) => updateMember(mi, { hours_worked: e.target.value })} className="h-10 rounded-md border border-input bg-background px-2 text-sm" />
0769 |                           ) : (
0770 |                             <div className="text-xs text-muted-foreground text-right">Even share</div>
0771 |                           )}
0772 |                           <div className="flex items-center gap-2">
0773 |                             <span className="text-sm tabular-nums text-emerald-700 font-semibold min-w-[64px] text-right">{share ? fmt(share.takehome) : "$0.00"}</span>
0774 |                             <button onClick={() => removeMember(mi)} className="px-2 h-10 rounded-md border border-input text-muted-foreground text-sm">×</button>
0775 |                           </div>
0776 |                         </div>
0777 |                       );
0778 |                     })}
0779 |                     <button type="button" onClick={addMember} className="text-xs px-3 h-8 rounded-md border border-input">+ Add server</button>
0780 |                   </div>
0781 |                 )}
0782 | 
0783 |                 <div className="grid grid-cols-3 gap-2">
0784 |                   <Money label="Cash owed" value={row.cash_owed} onChange={(v) => updateAt(servers, setServers, i, { cash_owed: v })} />
0785 |                   <Money label="Credit tips" value={row.credit_tips} onChange={(v) => updateAt(servers, setServers, i, { credit_tips: v })} />
0786 |                   <Money label="LBW sales" value={row.lbw_sales} onChange={(v) => updateAt(servers, setServers, i, { lbw_sales: v })} />
0787 |                 </div>
0788 |                 {salesBasis && (
0789 |                   <Money label="Total sales" value={row.total_sales} onChange={(v) => updateAt(servers, setServers, i, { total_sales: v })} />
0790 |                 )}
0791 |                 <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border">
0792 |                   <TipOut label="Bar tip" auto={auto.bar_tip} override={row.bar_tip_override} onSet={(v) => updateAt(servers, setServers, i, { bar_tip_override: v })} />
0793 |                   <TipOut label="R/B tip" auto={auto.rb_tip} override={row.rb_tip_override} onSet={(v) => updateAt(servers, setServers, i, { rb_tip_override: v })} />
0794 |                   <div className="self-end rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-center">
0795 |                     <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold">{shared ? "Combined take-home" : "Take-home"}</div>
0796 |                     <div className="text-xl font-bold text-emerald-700 tabular-nums leading-tight">{fmt(calc.takehome)}</div>
0797 |                     <div className="text-[11px] text-emerald-700/80 tabular-nums">{pct(calc.takehome, raw.credit_tips)}</div>
0798 |                   </div>
0799 | 
0800 |                 </div>
0801 | 
0802 |               </div>
0803 |             );
0804 |           })}
0805 | 
0806 | 
0807 |         </Section>
0808 | 
0809 |         <Section title="Bartenders" onAdd={() => setBartenders([...bartenders, { staff_id: "", cash_owed: "", credit_tips: "", total_sales: "", rb_tip_override: "", split_mode: "single", members: [] }])}>
0810 |           {(() => {
0811 |             const totalServerBar = serverRows.reduce((sum, r) => sum + calcServer(r, settings).bar_tip, 0);
0812 |             const perBartender = bartenders.length > 0 ? totalServerBar / bartenders.length : 0;
0813 |             return bartenders.map((row, i) => {
0814 |               const shared = row.split_mode !== "single";
0815 |               const rawB = { staff_id: shared ? null : row.staff_id, cash_owed: num(row.cash_owed), credit_tips: num(row.credit_tips), total_sales: num(row.total_sales) };
0816 |               const auto = calcBartender(rawB, perBartender, settings);
0817 |               const calc = calcBartender({ ...rawB, rb_tip_override: optNum(row.rb_tip_override) }, perBartender, settings);
0818 |               const memberInputs = row.members.map((m) => ({ staff_id: m.staff_id, hours_worked: num(m.hours_worked) }));
0819 |               const shares = shared
0820 |                 ? splitBartenderShares(rawB, { rb_tip: calc.rb_tip, takehome: calc.takehome, collected_from_servers: perBartender }, row.split_mode, memberInputs.filter((m) => m.staff_id))
0821 |                 : [];
0822 |               const updateMember = (mi: number, patch: Partial<BartenderMemberInput>) => {
0823 |                 const next = row.members.map((m, j) => (j === mi ? { ...m, ...patch } : m));
0824 |                 updateAt(bartenders, setBartenders, i, { members: next });
0825 |               };
0826 |               const removeMember = (mi: number) => {
0827 |                 updateAt(bartenders, setBartenders, i, { members: row.members.filter((_, j) => j !== mi) });
0828 |               };
0829 |               const addMember = () => {
0830 |                 updateAt(bartenders, setBartenders, i, { members: [...row.members, { staff_id: "", hours_worked: "" }] });
0831 |               };
0832 |               return (
0833 |                 <div key={i} className="border border-border rounded-md p-3 space-y-2 bg-background">
0834 |                   <div className="flex gap-2">
0835 |                     {!shared ? (
0836 |                       <select value={row.staff_id} onChange={(e) => updateAt(bartenders, setBartenders, i, { staff_id: e.target.value })} className="flex-1 h-11 rounded-md border border-input bg-background px-2">
0837 |                         <option value="">Select bartender…</option>
0838 |                         {bartenderList.map((s) => (<option key={s.id} value={s.id}>{s.name}{s.server_number ? ` #${s.server_number}` : ""}</option>))}
0839 |                       </select>
0840 |                     ) : (
0841 |                       <div className="flex-1 h-11 rounded-md border border-input bg-secondary/40 px-3 flex items-center text-sm text-muted-foreground">
0842 |                         Shared cash-out — {row.members.filter((m) => m.staff_id).length} bartender{row.members.filter((m) => m.staff_id).length === 1 ? "" : "s"}
0843 |                       </div>
0844 |                     )}
0845 |                     <button onClick={() => setBartenders(bartenders.filter((_, j) => j !== i))} className="px-3 h-11 rounded-md border border-input text-muted-foreground">×</button>
0846 |                   </div>
0847 | 
0848 |                   <div className="flex flex-wrap items-center gap-2">
0849 |                     <span className="text-xs text-muted-foreground">Split:</span>
0850 |                     <div className="inline-flex rounded-md border border-input overflow-hidden">
0851 |                       {(["single", "equal", "hours"] as BartenderSplitMode[]).map((m) => (
0852 |                         <button
0853 |                           key={m}
0854 |                           type="button"
0855 |                           onClick={() => {
0856 |                             if (m === "single") {
0857 |                               updateAt(bartenders, setBartenders, i, { split_mode: "single" });
0858 |                               return;
0859 |                             }
0860 |                             const seed: BartenderMemberInput[] = row.staff_id
0861 |                               ? [{ staff_id: row.staff_id, hours_worked: "" }]
0862 |                               : [{ staff_id: "", hours_worked: "" }, { staff_id: "", hours_worked: "" }];
0863 |                             updateAt(bartenders, setBartenders, i, {
0864 |                               split_mode: m,
0865 |                               members: row.members.length ? row.members : seed,
0866 |                             });
0867 |                           }}
0868 |                           className={`h-9 px-3 text-sm ${row.split_mode === m ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
0869 |                         >
0870 |                           {m === "single" ? "Individual" : m === "equal" ? "Shared (even)" : "Weighted (hours)"}
0871 |                         </button>
0872 |                       ))}
0873 |                     </div>
0874 |                     <span className="text-xs text-muted-foreground">
0875 |                       {row.split_mode === "single"
0876 |                         ? "One bartender on this cash-out."
0877 |                         : row.split_mode === "equal"
0878 |                         ? "Cash-out splits evenly across everyone listed."
0879 |                         : "Enter hours worked — cash-out weighted by hours."}
0880 |                     </span>
0881 |                   </div>
0882 | 
0883 |                   {shared && (
0884 |                     <div className="space-y-2 pl-1 border-l-2 border-secondary">
0885 |                       {row.members.map((m, mi) => {
0886 |                         const share = shares.find((s) => s.staff_id === m.staff_id);
0887 |                         return (
0888 |                           <div key={mi} className="grid grid-cols-[1fr_100px_auto] gap-2 items-center">
0889 |                             <select value={m.staff_id} onChange={(e) => updateMember(mi, { staff_id: e.target.value })} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
0890 |                               <option value="">Select bartender…</option>
0891 |                               {bartenderList.map((s) => (<option key={s.id} value={s.id}>{s.name}{s.server_number ? ` #${s.server_number}` : ""}</option>))}
0892 |                             </select>
0893 |                             {row.split_mode === "hours" ? (
0894 |                               <input type="number" inputMode="decimal" step="0.25" placeholder="Hrs" value={m.hours_worked} onChange={(e) => updateMember(mi, { hours_worked: e.target.value })} className="h-10 rounded-md border border-input bg-background px-2 text-sm" />
0895 |                             ) : (
0896 |                               <div className="text-xs text-muted-foreground text-right">Even share</div>
0897 |                             )}
0898 |                             <div className="flex items-center gap-2">
0899 |                               <span className="text-sm tabular-nums text-emerald-700 font-semibold min-w-[64px] text-right">{share ? fmt(share.takehome) : "$0.00"}</span>
0900 |                               <button onClick={() => removeMember(mi)} className="px-2 h-10 rounded-md border border-input text-muted-foreground text-sm">×</button>
0901 |                             </div>
0902 |                           </div>
0903 |                         );
0904 |                       })}
0905 |                       <button type="button" onClick={addMember} className="text-xs px-3 h-8 rounded-md border border-input">+ Add bartender</button>
0906 |                     </div>
0907 |                   )}
0908 | 
0909 | 
0910 |                   <div className="grid grid-cols-2 gap-2">
0911 |                     <Money label="Cash owed" value={row.cash_owed} onChange={(v) => updateAt(bartenders, setBartenders, i, { cash_owed: v })} />
0912 |                     <Money label="Credit tips" value={row.credit_tips} onChange={(v) => updateAt(bartenders, setBartenders, i, { credit_tips: v })} />
0913 |                     {salesBasis && (
0914 |                       <Money label="Total sales" value={row.total_sales} onChange={(v) => updateAt(bartenders, setBartenders, i, { total_sales: v })} />
0915 |                     )}
0916 |                   </div>
0917 |                   <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border items-end">
0918 |                     <div className="text-xs text-muted-foreground pb-2">From servers: <span className="text-foreground font-medium">{fmt(perBartender)}</span></div>
0919 |                     <TipOut label="R/B tip out" auto={auto.rb_tip} override={row.rb_tip_override} onSet={(v) => updateAt(bartenders, setBartenders, i, { rb_tip_override: v })} />
0920 |                     <div className="self-end rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-center">
0921 |                       <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold">
0922 |                         {shared ? "Combined take-home" : "Take-home"}
0923 |                       </div>
0924 |                       <div className="text-xl font-bold text-emerald-700 tabular-nums leading-tight">{fmt(calc.takehome)}</div>
0925 |                       <div className="text-[11px] text-emerald-700/80 tabular-nums">{pct(calc.takehome, rawB.credit_tips + perBartender)}</div>
0926 |                     </div>
0927 | 
0928 |                   </div>
0929 |                   {row.rb_tip_override.trim() !== "" && (
0930 |                     <button type="button" onClick={() => updateAt(bartenders, setBartenders, i, { rb_tip_override: "" })} className="text-xs text-muted-foreground underline">
0931 |                       Reset tip-out to calculated
0932 |                     </button>
0933 |                   )}
0934 |                 </div>
0935 |               );
0936 |             });
0937 |           })()}
0938 |         </Section>
0939 | 
0940 | 
0941 |         <Section title="Support staff (Runners / Bussers / Bar Backs / Hostesses)" onAdd={() => setSupport([...support, { staff_id: "", role: "", hours_worked: "" }])}>
0942 |           <div className="flex flex-wrap items-center gap-2 pb-1">
0943 |             <span className="text-xs text-muted-foreground">Split:</span>
0944 |             <div className="inline-flex rounded-md border border-input overflow-hidden">
0945 |               {(["shared", "weighted"] as SupportSplitMode[]).map((m) => (
0946 |                 <button
0947 |                   key={m}
0948 |                   type="button"
0949 |                   onClick={() => setSupportSplit(m)}
0950 |                   className={`h-9 px-3 text-sm ${supportSplit === m ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
0951 |                 >
0952 |                   {m === "shared" ? "Shared (even)" : "Weighted (hours)"}
0953 |                 </button>
0954 |               ))}
0955 |             </div>
0956 |             <span className="text-xs text-muted-foreground">
0957 |               {supportSplit === "shared" ? "Pool splits evenly across everyone listed." : "Enter hours worked — payout weighted by position and hours."}
0958 |             </span>
0959 |           </div>
0960 |           {support.map((row, i) => {
0961 |             const person = staffById.get(row.staff_id);
0962 |             const qualified = person ? SUPPORT_ROLES.filter((r) => person.positions.includes(r)) : SUPPORT_ROLES;
0963 |             const payout = supportPayouts.find((p) => p.staff_id === row.staff_id)?.payout ?? 0;
0964 |             return (
0965 |               <div key={i} className="border border-border rounded-md p-3 space-y-2 bg-background">
0966 |                 <div className="flex gap-2">
0967 |                   <select value={row.staff_id} onChange={(e) => {
0968 |                     const id = e.target.value;
0969 |                     const p = staff.find((x) => x.id === id);
0970 |                     const def = p ? (SUPPORT_ROLES.find((r) => p.positions.includes(r)) ?? "") : "";
0971 |                     updateAt(support, setSupport, i, { staff_id: id, role: def as SupportRole | "" });
0972 |                   }} className="flex-1 h-11 rounded-md border border-input bg-background px-2">
0973 |                     <option value="">Select…</option>
0974 |                     {supportList.map((s) => (<option key={s.id} value={s.id}>{s.name}{s.server_number ? ` #${s.server_number}` : ""}</option>))}
0975 |                   </select>
0976 |                   <select value={row.role} onChange={(e) => updateAt(support, setSupport, i, { role: e.target.value as SupportRole })} className="h-11 rounded-md border border-input bg-background px-2" disabled={!row.staff_id}>
0977 |                     <option value="">Position…</option>
0978 |                     {qualified.map((r) => (<option key={r} value={r}>{r.replace("_", " ")}</option>))}
0979 |                   </select>
0980 |                   <button onClick={() => setSupport(support.filter((_, j) => j !== i))} className="px-3 h-11 rounded-md border border-input text-muted-foreground">×</button>
0981 |                 </div>
0982 |                 <div className="grid grid-cols-2 gap-2">
0983 |                   {supportSplit === "weighted" ? (
0984 |                     <div>
0985 |                       <label className="text-xs text-muted-foreground">Hours</label>
0986 |                       <input type="number" inputMode="decimal" step="0.25" value={row.hours_worked} onChange={(e) => updateAt(support, setSupport, i, { hours_worked: e.target.value })} className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3" />
0987 |                     </div>
0988 |                   ) : (
0989 |                     <div className="flex items-end text-sm text-muted-foreground">Even share</div>
0990 |                   )}
0991 |                   <div className="flex items-end text-sm">
0992 |                     <div className="text-muted-foreground">Payout: <span className="text-foreground font-medium">{fmt(payout)}</span></div>
0993 |                   </div>
0994 |                 </div>
0995 |               </div>
0996 |             );
0997 |           })}
0998 |           <div className="text-xs text-muted-foreground pt-2">Pool from tonight: <span className="font-medium text-foreground">{fmt(pool)}</span></div>
0999 |         </Section>
1000 | 
1001 | 
1002 |         {(() => {
1003 |           const serverCash = serverRows.reduce((s, r) => s + r.cash_owed, 0);
1004 |           const bartenderCash = bartenderRows.reduce((s, r) => s + r.cash_owed, 0);
1005 |           const currentSubtotal = serverCash + bartenderCash;
1006 |           const includeAm = period === "PM";
1007 |           const total = currentSubtotal + (includeAm ? amCash : 0);
1008 |           const currentLabel = period === "PM" ? "PM owed to house" : "AM owed to house";
1009 |           return (
1010 |             <section className="bg-card border border-border rounded-lg p-4 space-y-3">
1011 |               <h2 className="font-serif text-lg text-foreground">Cash Deposit (House)</h2>
1012 | 
1013 |               {includeAm && (
1014 |                 <div className="space-y-1">
1015 |                   <div className="text-xs uppercase tracking-wide text-muted-foreground">AM owed to house</div>
1016 |                   <div className="flex justify-between text-sm"><span className="text-muted-foreground">AM shift subtotal</span><span className="font-medium">{amCashLoaded ? fmt(amCash) : "Loading…"}</span></div>
1017 |                 </div>
1018 |               )}
1019 | 
1020 |               <div className="space-y-1 pt-1 border-t border-border">
1021 |                 <div className="text-xs uppercase tracking-wide text-muted-foreground">{currentLabel}</div>
1022 |                 <div className="flex justify-between text-sm"><span className="text-muted-foreground">Servers cash owed</span><span className="font-medium">{fmt(serverCash)}</span></div>
1023 |                 <div className="flex justify-between text-sm"><span className="text-muted-foreground">Bartenders cash owed</span><span className="font-medium">{fmt(bartenderCash)}</span></div>
1024 |                 <div className="flex justify-between text-sm"><span className="text-muted-foreground">{period} subtotal</span><span className="font-medium">{fmt(currentSubtotal)}</span></div>
1025 |               </div>
1026 | 
1027 |               <div className="flex justify-between pt-2 border-t border-border"><span className="font-medium">Total deposit</span><span className="font-serif text-lg">{fmt(total)}</span></div>
1028 |             </section>
1029 |           );
1030 |         })()}
1031 | 
1032 | 
1033 |         <section>
1034 |           <label className="text-xs uppercase tracking-wide text-muted-foreground">Notes</label>
1035 |           <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" />
1036 |         </section>
1037 | 
1038 |         {err && <p className="text-sm text-destructive">{err}</p>}
1039 |       </main>
1040 | 
1041 |       <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4">
1042 |         <div className="max-w-2xl mx-auto flex gap-2 items-center">
1043 |           <span className="text-xs text-muted-foreground flex-1">
1044 |             {saving ? "Auto-saving…" : savedAt ? `Auto-saved ${savedAt.toLocaleTimeString()}` : "Auto-save on"}
1045 |           </span>
1046 |           <button onClick={() => save()} disabled={saving} className="flex-1 h-12 rounded-md border border-input font-medium disabled:opacity-50">
1047 |             {saving ? "Saving…" : shiftId ? "Save Progress" : "Save"}
1048 |           </button>
1049 |           <button onClick={() => save({ close: true })} disabled={saving} className="flex-1 h-12 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50">
1050 |             Save & Close
1051 |           </button>
1052 |         </div>
1053 |         {shiftId && (
1054 |           <div className="max-w-2xl mx-auto mt-2 flex justify-end">
1055 |             <button
1056 |               onClick={() => { setDeleteErr(null); setConfirmDelete(true); }}
1057 |               className="h-9 px-4 rounded-md border border-destructive text-destructive text-sm font-medium"
1058 |             >
1059 |               Delete shift
1060 |             </button>
1061 |           </div>
1062 |         )}
1063 |       </div>
1064 | 
1065 |       {confirmDelete && (
1066 |         <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
1067 |           <div className="w-full max-w-sm bg-card border border-border rounded-lg p-5 space-y-3">
1068 |             <h2 className="text-lg font-serif">Delete this shift?</h2>
1069 |             <p className="text-sm text-muted-foreground">
1070 |               The {period} shift for <span className="font-medium text-foreground">{date}</span> and all of its server,
1071 |               bartender and support entries will be permanently deleted. This cannot be undone.
1072 |             </p>
1073 |             {deleteErr && <p className="text-sm text-destructive">{deleteErr}</p>}
1074 |             <div className="flex gap-2 pt-1">
1075 |               <button
1076 |                 onClick={() => setConfirmDelete(false)}
1077 |                 disabled={deleting}
1078 |                 className="flex-1 h-11 rounded-md border border-input font-medium disabled:opacity-50"
1079 |               >
1080 |                 Cancel
1081 |               </button>
1082 |               <button
1083 |                 onClick={() => deleteShift()}
1084 |                 disabled={deleting}
1085 |                 className="flex-1 h-11 rounded-md bg-destructive text-destructive-foreground font-medium disabled:opacity-50"
1086 |               >
1087 |                 {deleting ? "Deleting…" : "Delete shift"}
1088 |               </button>
1089 |             </div>
1090 |           </div>
1091 |         </div>
1092 |       )}
1093 | 
1094 | 
1095 |       {pendingDate && (
1096 |         <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
1097 |           <div className="w-full max-w-sm bg-card border border-border rounded-lg p-5 space-y-3">
1098 |             <h2 className="text-lg font-serif">Change shift date?</h2>
1099 |             <p className="text-sm text-muted-foreground">
1100 |               You picked <span className="font-medium text-foreground">{pendingDate}</span> instead of{" "}
1101 |               <span className="font-medium text-foreground">{date}</span>. If that was a mistake, cancel and the date stays as it is.
1102 |             </p>
1103 |             <p className="text-sm text-muted-foreground">
1104 |               If it's correct, this shift's entries are saved first, then{" "}
1105 |               <span className="font-medium text-foreground">
1106 |                 {dayPeriods.AM && dayPeriods.PM ? "both the AM and PM shifts" : dayPeriods.AM ? "the AM shift" : "the PM shift"}
1107 |               </span>{" "}
1108 |               for {date} moves to {pendingDate} with all entries.
1109 |             </p>
1110 |             {moveErr && <p className="text-sm text-destructive">{moveErr}</p>}
1111 |             <div className="flex flex-col gap-2 pt-1">
1112 |               <button
1113 |                 onClick={() => confirmDateChange()}
1114 |                 disabled={moveBusy}
1115 |                 className="h-11 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50"
1116 |               >
1117 |                 {moveBusy ? "Saving & moving…" : `Save & move day to ${pendingDate}`}
1118 |               </button>
1119 |               <button
1120 |                 onClick={() => { setPendingDate(null); setMoveErr(null); }}
1121 |                 disabled={moveBusy}
1122 |                 className="h-11 rounded-md border border-input font-medium disabled:opacity-50"
1123 |               >
1124 |                 Cancel — wrong date, keep {date}
1125 |               </button>
1126 |             </div>
1127 | 
1128 |           </div>
1129 |         </div>
1130 |       )}
1131 |     </div>
1132 | 
1133 |   );
1134 | }
1135 | 
1136 | function updateAt<T>(arr: T[], set: (a: T[]) => void, i: number, patch: Partial<T>) {
1137 |   set(arr.map((row, j) => (j === i ? { ...row, ...patch } : row)));
1138 | }
1139 | 
1140 | function Section({ title, onAdd, children }: { title: string; onAdd: () => void; children: React.ReactNode }) {
1141 |   return (
1142 |     <section className="space-y-3">
1143 |       <div className="flex items-center justify-between">
1144 |         <h2 className="font-serif text-lg text-foreground">{title}</h2>
1145 |         <button onClick={onAdd} className="text-sm px-3 h-9 rounded-md border border-input text-foreground">+ Add</button>
1146 |       </div>
1147 |       {children}
1148 |     </section>
1149 |   );
1150 | }
1151 | 
1152 | function Money({ label, value, onChange, tone }: { label: string; value: string; onChange: (v: string) => void; tone?: "tipout" }) {
1153 |   const isTip = tone === "tipout";
1154 |   return (
1155 |     <div>
1156 |       <label className={`text-xs ${isTip ? "text-red-600 font-medium" : "text-muted-foreground"}`}>{label}</label>
1157 |       <div className="relative">
1158 |         <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${isTip ? "text-red-600" : "text-muted-foreground"}`}>$</span>
1159 |         <input type="number" inputMode="decimal" step="0.01" value={value} onChange={(e) => onChange(e.target.value)} className={`mt-1 w-full rounded-md border border-input bg-background pl-7 pr-2 ${isTip ? "h-12 text-lg font-semibold text-red-600" : "h-11"}`} />
1160 |       </div>
1161 |     </div>
1162 |   );
1163 | }
1164 | 
1165 | function TipOut({ label, auto, override, onSet }: { label: string; auto: number; override: string; onSet: (v: string) => void }) {
1166 |   const isOverride = override.trim() !== "";
1167 |   const effective = isOverride ? Number(override) || 0 : auto;
1168 |   const [editing, setEditing] = useState(false);
1169 |   const [draft, setDraft] = useState("");
1170 |   const startEdit = () => {
1171 |     setDraft(isOverride ? override : auto.toFixed(2));
1172 |     setEditing(true);
1173 |   };
1174 |   const commit = () => {
1175 |     const trimmed = draft.trim();
1176 |     if (trimmed === "") { onSet(""); setEditing(false); return; }
1177 |     const n = Number(trimmed);
1178 |     if (!isFinite(n) || n < 0) { setEditing(false); return; }
1179 |     onSet(trimmed);
1180 |     setEditing(false);
1181 |   };
1182 |   const clearOverride = () => { onSet(""); setEditing(false); };
1183 |   if (editing) {
1184 |     return (
1185 |       <div>
1186 |         <label className="text-xs text-red-600 font-medium">{label}</label>
1187 |         <div className="mt-1 flex gap-1">
1188 |           <input
1189 |             type="number"
1190 |             inputMode="decimal"
1191 |             step="0.01"
1192 |             autoFocus
1193 |             value={draft}
1194 |             onChange={(e) => setDraft(e.target.value)}
1195 |             onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
1196 |             onBlur={(e) => {
1197 |               const next = e.relatedTarget as HTMLElement | null;
1198 |               if (next?.dataset?.tipoutAction) return; // let Save/Reset handle it
1199 |               commit();
1200 |             }}
1201 |             className="flex-1 h-12 rounded-md border border-input bg-background px-3 text-lg font-semibold text-red-600 tabular-nums"
1202 |           />
1203 |           <button type="button" data-tipout-action="save" onMouseDown={(e) => e.preventDefault()} onClick={commit} className="h-12 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium">Save</button>
1204 |           {isOverride && (
1205 |             <button type="button" data-tipout-action="reset" onMouseDown={(e) => e.preventDefault()} onClick={clearOverride} className="h-12 px-2 rounded-md border border-input text-xs">Reset</button>
1206 |           )}
1207 |         </div>
1208 |       </div>
1209 |     );
1210 |   }
1211 |   return (
1212 |     <div>
1213 |       <label className="text-xs text-red-600 font-medium">{label}</label>
1214 |       <button
1215 |         type="button"
1216 |         onClick={startEdit}
1217 |         className="mt-1 w-full h-12 rounded-md border border-input bg-background px-3 flex items-center justify-between text-red-600 hover:bg-red-50"
1218 |       >
1219 |         <span className="text-lg font-semibold tabular-nums">{fmt(effective)}</span>
1220 |         <span className="text-xs uppercase tracking-wide font-medium underline">{isOverride ? "Edit ✱" : "Edit"}</span>
1221 |       </button>
1222 |     </div>
1223 |   );
1224 | }
```

## `src/lib/print.ts`
```tsx
0001 | /** Printing helpers.
0002 |  *
0003 |  *  Inside the Lovable preview the app runs in an iframe, where window.print()
0004 |  *  prints the surrounding editor chrome. To keep printing reliable we render the
0005 |  *  report markup into a hidden same-document iframe and print that iframe, which
0006 |  *  needs no popup permission.
0007 |  *
0008 |  *  Important: the print call must happen while the click is still an active user
0009 |  *  gesture. Waiting on font/image promises before calling print() makes browsers
0010 |  *  silently drop the request, so we inline the styles (no async stylesheet load)
0011 |  *  and print straight away, only waiting when an image has not loaded yet. */
0012 | 
0013 | /** Copy styles into the print document, inlining rules where we can so the
0014 |  *  print document needs no async network fetch. */
0015 | function collectStyles() {
0016 |   const parts: string[] = [];
0017 |   for (const node of Array.from(
0018 |     document.querySelectorAll('style, link[rel="stylesheet"]'),
0019 |   )) {
0020 |     if (node.tagName === "STYLE") {
0021 |       parts.push(node.outerHTML);
0022 |       continue;
0023 |     }
0024 |     const sheet = (node as HTMLLinkElement).sheet;
0025 |     let inlined = "";
0026 |     try {
0027 |       if (sheet) {
0028 |         inlined = Array.from(sheet.cssRules)
0029 |           .map((r) => r.cssText)
0030 |           .join("\n");
0031 |       }
0032 |     } catch {
0033 |       inlined = "";
0034 |     }
0035 |     if (inlined) parts.push(`<style>${inlined}</style>`);
0036 |     else parts.push(node.outerHTML);
0037 |   }
0038 |   return parts.join("\n");
0039 | }
0040 | 
0041 | function buildDoc(bodyHtml: string, title: string) {
0042 |   return (
0043 |     `<!doctype html><html><head><meta charset="utf-8"><base href="${window.location.origin}/"><title>${title}</title>${collectStyles()}` +
0044 |     `<style>body{background:#fff;margin:0;padding:0}.no-print{display:none!important}` +
0045 |     `.print\\:hidden{display:none!important}</style>` +
0046 |     `</head><body>${bodyHtml}</body></html>`
0047 |   );
0048 | }
0049 | 
0050 | /** True when every image in the print document has finished loading. */
0051 | function imagesReady(doc: Document) {
0052 |   return Array.from(doc.images).every((img) => img.complete);
0053 | }
0054 | 
0055 | /** Print markup inside a hidden iframe. Returns false if it could not start. */
0056 | function printViaIframe(bodyHtml: string, title: string) {
0057 |   try {
0058 |     const frame = document.createElement("iframe");
0059 |     frame.setAttribute("aria-hidden", "true");
0060 |     frame.style.cssText =
0061 |       "position:fixed;left:0;top:0;width:1024px;height:768px;border:0;opacity:0;pointer-events:none;z-index:-1";
0062 |     document.body.appendChild(frame);
0063 |     const doc = frame.contentDocument;
0064 |     const win = frame.contentWindow;
0065 |     if (!doc || !win) {
0066 |       frame.remove();
0067 |       return false;
0068 |     }
0069 |     doc.open();
0070 |     doc.write(buildDoc(bodyHtml, title));
0071 |     doc.close();
0072 | 
0073 |     let cleaned = false;
0074 |     const cleanup = () => {
0075 |       if (cleaned) return;
0076 |       cleaned = true;
0077 |       frame.remove();
0078 |     };
0079 |     const go = () => {
0080 |       try {
0081 |         win.focus();
0082 |         win.print();
0083 |       } catch {
0084 |         cleanup();
0085 |         return false;
0086 |       }
0087 |       return true;
0088 |     };
0089 |     // Keep the frame alive until printing really finishes. Removing it on a
0090 |     // short timer causes blank print previews in Safari and iframe previews.
0091 |     win.addEventListener("afterprint", cleanup, { once: true });
0092 |     setTimeout(cleanup, 60_000);
0093 | 
0094 |     // Print immediately (still inside the user gesture) when the document is
0095 |     // already renderable; otherwise give pending images a brief moment.
0096 |     if (imagesReady(doc)) go();
0097 |     else {
0098 |       let printed = false;
0099 |       const attempt = () => {
0100 |         if (printed) return;
0101 |         printed = true;
0102 |         go();
0103 |       };
0104 |       for (const img of Array.from(doc.images)) {
0105 |         img.addEventListener("load", () => imagesReady(doc) && attempt(), { once: true });
0106 |         img.addEventListener("error", () => imagesReady(doc) && attempt(), { once: true });
0107 |       }
0108 |       setTimeout(attempt, 800);
0109 |     }
0110 |     return true;
0111 |   } catch {
0112 |     return false;
0113 |   }
0114 | }
0115 | 
0116 | /** Open a printable document in a popup and print it right away. */
0117 | function printViaPopup(bodyHtml: string, title: string) {
0118 |   const win = window.open("", "_blank", "width=1024,height=768");
0119 |   if (!win) return false;
0120 | 
0121 |   win.document.open();
0122 |   win.document.write(buildDoc(bodyHtml, title));
0123 |   win.document.close();
0124 |   try {
0125 |     win.focus();
0126 |     win.print();
0127 |   } catch {
0128 |     return false;
0129 |   }
0130 |   return true;
0131 | }
0132 | 
0133 | /** Print markup in the current page: mount it in a print-only root, hide
0134 |  *  everything else while printing. Works on iPhone/iPad (where printing a
0135 |  *  hidden iframe prints the parent page, yielding blank sheets) and desktop. */
0136 | function printInPage(bodyHtml: string, title: string) {
0137 |   try {
0138 |     document.getElementById("__print_root")?.remove();
0139 |     document.getElementById("__print_style")?.remove();
0140 |     const root = document.createElement("div");
0141 |     root.id = "__print_root";
0142 |     root.innerHTML = bodyHtml;
0143 |     const style = document.createElement("style");
0144 |     style.id = "__print_style";
0145 |     style.textContent =
0146 |       "#__print_root{display:none}" +
0147 |       "@media print{body>*:not(#__print_root){display:none!important}" +
0148 |       "#__print_root{display:block!important;background:#fff}" +
0149 |       "#__print_root .no-print,#__print_root .print\\:hidden{display:none!important}}";
0150 |     document.head.appendChild(style);
0151 |     document.body.appendChild(root);
0152 |     const prevTitle = document.title;
0153 |     document.title = title;
0154 |     let cleaned = false;
0155 |     const cleanup = () => {
0156 |       if (cleaned) return;
0157 |       cleaned = true;
0158 |       root.remove();
0159 |       style.remove();
0160 |       document.title = prevTitle;
0161 |     };
0162 |     window.addEventListener("afterprint", () => setTimeout(cleanup, 500), { once: true });
0163 |     setTimeout(cleanup, 120_000);
0164 |     window.print();
0165 |     return true;
0166 |   } catch {
0167 |     return false;
0168 |   }
0169 | }
0170 | 
0171 | void printViaIframe;
0172 | void printViaPopup;
0173 | 
0174 | /** Print the given markup (in-page print-only root, popup fallback). */
0175 | export function printHtml(bodyHtml: string, title = document.title) {
0176 |   if (printInPage(bodyHtml, title)) return true;
0177 |   if (printViaPopup(bodyHtml, title)) return true;
0178 |   window.print();
0179 |   return false;
0180 | }
0181 | 
0182 | /** Print directly from a click handler. The hidden iframe needs no popup
0183 |  *  permission, so it is the primary path here too. */
0184 | export function printHtmlFromClick(bodyHtml: string, title = document.title) {
0185 |   return printHtml(bodyHtml, title);
0186 | }
0187 | 
0188 | /** Print a specific element's markup. */
0189 | export function printElement(el: HTMLElement | null, title?: string) {
0190 |   if (!el) return;
0191 |   printHtml(el.innerHTML, title ?? document.title);
0192 | }
0193 | 
0194 | export function printElementFromClick(el: HTMLElement | null, title?: string) {
0195 |   if (!el) return;
0196 |   printHtml(el.innerHTML, title ?? document.title);
0197 | }
```

## `src/lib/download.ts`
```tsx
0001 | /** File download helper.
0002 |  *
0003 |  *  A detached <a> element with an object URL that is revoked on the very next
0004 |  *  line gets cancelled by most browsers (and always inside a sandboxed preview
0005 |  *  iframe). Attach the link to the document, click it, then clean up on a
0006 |  *  timer so the browser can start the download. */
0007 | export function downloadTextFile(
0008 |   content: string,
0009 |   filename: string,
0010 |   mime = "text/csv;charset=utf-8",
0011 | ) {
0012 |   const blob = new Blob([content], { type: mime });
0013 |   const url = URL.createObjectURL(blob);
0014 |   const a = document.createElement("a");
0015 |   a.href = url;
0016 |   a.download = filename;
0017 |   a.rel = "noopener";
0018 |   a.style.display = "none";
0019 |   document.body.appendChild(a);
0020 |   a.click();
0021 |   setTimeout(() => {
0022 |     a.remove();
0023 |     URL.revokeObjectURL(url);
0024 |   }, 2000);
0025 | }
```

## `src/components/audit-panel.tsx`
```tsx
0001 | import { useEffect, useMemo, useState } from "react";
0002 | import { supabase } from "@/integrations/supabase/client";
0003 | import { downloadTextFile } from "@/lib/download";
0004 | 
0005 | type TipRow = {
0006 |   id: string;
0007 |   shift_date: string | null;
0008 |   period: string | null;
0009 |   entry_kind: string;
0010 |   staff_id: string | null;
0011 |   field: string;
0012 |   old_amount: number | null;
0013 |   new_amount: number | null;
0014 |   action: string;
0015 |   changed_by_email: string | null;
0016 |   created_at: string;
0017 | };
0018 | type SettingRow = {
0019 |   id: string;
0020 |   field: string;
0021 |   old_value: string | null;
0022 |   new_value: string | null;
0023 |   changed_by_email: string | null;
0024 |   created_at: string;
0025 | };
0026 | 
0027 | const SETTING_LABELS: Record<string, string> = {
0028 |   bar_tip_pct: "Bar tip-out %",
0029 |   runner_busser_tip_pct: "Runner/Busser tip-out %",
0030 |   bartender_tip_pct: "Bartender → support %",
0031 |   max_tipout_pct: "Max total tip-out %",
0032 |   rb_basis: "Tip-out basis",
0033 |   weight_runner: "Runner weight",
0034 |   weight_busser: "Busser weight",
0035 |   weight_bar_back: "Bar back weight",
0036 |   weight_hostess: "Hostess weight",
0037 |   rounding_mode: "Rounding mode",
0038 |   use_net_sales: "Use net sales",
0039 |   sales_tax_pct: "Sales tax %",
0040 |   cc_fee_enabled: "CC fee recovery",
0041 |   cc_fee_pct: "CC fee %",
0042 |   manager_exclusion_enabled: "Exclude managers",
0043 |   pay_period_type: "Pay period",
0044 |   pay_period_anchor: "Pay period start",
0045 |   establishment_name: "Establishment name",
0046 |   logo_url: "Logo",
0047 |   sms_enabled: "SMS enabled",
0048 |   sms_from_number: "SMS from number",
0049 |   sms_include_breakdown: "SMS breakdown",
0050 | };
0051 | 
0052 | const PCT_FIELDS = new Set([
0053 |   "bar_tip_pct", "runner_busser_tip_pct", "bartender_tip_pct", "max_tipout_pct", "sales_tax_pct", "cc_fee_pct",
0054 | ]);
0055 | 
0056 | function fmtSetting(field: string, value: string | null) {
0057 |   if (value === null || value === "") return "—";
0058 |   if (PCT_FIELDS.has(field)) {
0059 |     const n = Number(value);
0060 |     return Number.isFinite(n) ? `${(n * 100).toFixed(2).replace(/\.?0+$/, "")}%` : value;
0061 |   }
0062 |   if (value === "true") return "On";
0063 |   if (value === "false") return "Off";
0064 |   return value;
0065 | }
0066 | const money = (n: number | null) => (n == null ? "—" : `$${n.toFixed(2)}`);
0067 | const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
0068 | 
0069 | export function AuditPanel() {
0070 |   const [tab, setTab] = useState<"tips" | "settings">("tips");
0071 |   const [staffNames, setStaffNames] = useState<Map<string, string>>(new Map());
0072 |   const [tips, setTips] = useState<TipRow[]>([]);
0073 |   const [settings, setSettings] = useState<SettingRow[]>([]);
0074 |   const [loading, setLoading] = useState(true);
0075 | 
0076 |   const today = new Date().toISOString().slice(0, 10);
0077 |   const monthAgo = useMemo(() => {
0078 |     const d = new Date();
0079 |     d.setDate(d.getDate() - 30);
0080 |     return d.toISOString().slice(0, 10);
0081 |   }, []);
0082 |   const [from, setFrom] = useState(monthAgo);
0083 |   const [to, setTo] = useState(today);
0084 | 
0085 |   useEffect(() => {
0086 |     (async () => {
0087 |       const { data: staff } = await supabase.from("staff").select("id, name, server_number");
0088 |       setStaffNames(new Map((staff ?? []).map((s) => [s.id, s.server_number ? `${s.name} (#${s.server_number})` : s.name])));
0089 |     })();
0090 |   }, []);
0091 | 
0092 |   useEffect(() => {
0093 |     setLoading(true);
0094 |     const start = `${from}T00:00:00.000Z`;
0095 |     const end = `${to}T23:59:59.999Z`;
0096 |     Promise.all([
0097 |       supabase
0098 |         .from("tip_override_audit")
0099 |         .select("id, shift_date, period, entry_kind, staff_id, field, old_amount, new_amount, action, changed_by_email, created_at")
0100 |         .gte("created_at", start)
0101 |         .lte("created_at", end)
0102 |         .order("created_at", { ascending: false })
0103 |         .limit(500),
0104 |       supabase
0105 |         .from("settings_audit")
0106 |         .select("id, field, old_value, new_value, changed_by_email, created_at")
0107 |         .gte("created_at", start)
0108 |         .lte("created_at", end)
0109 |         .order("created_at", { ascending: false })
0110 |         .limit(500),
0111 |     ]).then(([t, s]) => {
0112 |       setTips((t.data ?? []) as TipRow[]);
0113 |       setSettings((s.data ?? []) as SettingRow[]);
0114 |       setLoading(false);
0115 |     });
0116 |   }, [from, to]);
0117 | 
0118 |   const exportCsv = () => {
0119 |     const rows = tab === "tips"
0120 |       ? [
0121 |           ["When", "Shift date", "Period", "Type", "Staff", "Field", "Action", "Previous", "New", "Changed by"],
0122 |           ...tips.map((r) => [
0123 |             when(r.created_at), r.shift_date ?? "", r.period ?? "", r.entry_kind,
0124 |             r.staff_id ? staffNames.get(r.staff_id) ?? "" : "",
0125 |             r.field === "bar_tip" ? "Bar tip-out" : "Runner/Busser tip-out",
0126 |             r.action, r.old_amount ?? "", r.new_amount ?? "", r.changed_by_email ?? "",
0127 |           ]),
0128 |         ]
0129 |       : [
0130 |           ["When", "Setting", "Previous", "New", "Changed by"],
0131 |           ...settings.map((r) => [
0132 |             when(r.created_at), SETTING_LABELS[r.field] ?? r.field,
0133 |             fmtSetting(r.field, r.old_value), fmtSetting(r.field, r.new_value), r.changed_by_email ?? "",
0134 |           ]),
0135 |         ];
0136 |     const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
0137 |     downloadTextFile(csv, `audit-${tab}-${from}-to-${to}.csv`);
0138 |   };
0139 | 
0140 |   return (
0141 |     <div className="space-y-4">
0142 |       <section className="flex flex-wrap items-center gap-2 print:hidden">
0143 |         <div className="inline-flex rounded-md border border-input overflow-hidden">
0144 |           {(["tips", "settings"] as const).map((t) => (
0145 |             <button
0146 |               key={t}
0147 |               onClick={() => setTab(t)}
0148 |               className={`h-9 px-3 text-sm ${tab === t ? "bg-primary text-primary-foreground" : "bg-background"}`}
0149 |             >
0150 |               {t === "tips" ? "Tip adjustments" : "Setting changes"}
0151 |             </button>
0152 |           ))}
0153 |         </div>
0154 |         <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 px-2 rounded-md border border-input bg-background text-sm" />
0155 |         <span className="text-muted-foreground text-sm">to</span>
0156 |         <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 px-2 rounded-md border border-input bg-background text-sm" />
0157 |         <div className="flex-1" />
0158 |         <button onClick={exportCsv} className="h-9 px-3 rounded-md border border-input text-sm">CSV</button>
0159 |         <button onClick={() => window.print()} className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm">Print</button>
0160 |       </section>
0161 | 
0162 |       <p className="text-xs text-muted-foreground">
0163 |         {tab === "tips"
0164 |           ? "Every manual tip-out edit made after the shift entry was created — who changed it, the calculated amount it replaced, and the new amount."
0165 |           : "Every change to the establishment's default tip-share settings."}
0166 |       </p>
0167 | 
0168 |       <section className="bg-card border border-border rounded-lg overflow-x-auto">
0169 |         {tab === "tips" ? (
0170 |           <table className="w-full text-sm">
0171 |             <thead className="bg-secondary text-secondary-foreground">
0172 |               <tr>
0173 |                 <Th>When</Th><Th>Shift</Th><Th>Staff</Th><Th>Adjusted</Th><Th right>Previous</Th><Th right>New</Th><Th>By</Th>
0174 |               </tr>
0175 |             </thead>
0176 |             <tbody>
0177 |               {loading && <tr><td colSpan={7} className="text-center p-8 text-muted-foreground">Loading…</td></tr>}
0178 |               {!loading && tips.length === 0 && (
0179 |                 <tr><td colSpan={7} className="text-center p-8 text-muted-foreground">No manual tip adjustments in this range.</td></tr>
0180 |               )}
0181 |               {tips.map((r) => (
0182 |                 <tr key={r.id} className="border-t border-border">
0183 |                   <Td>{when(r.created_at)}</Td>
0184 |                   <Td>{r.shift_date ?? "—"}{r.period ? ` ${r.period}` : ""}</Td>
0185 |                   <Td>{r.staff_id ? staffNames.get(r.staff_id) ?? "—" : "—"} <span className="text-muted-foreground">({r.entry_kind})</span></Td>
0186 |                   <Td>{r.field === "bar_tip" ? "Bar tip-out" : "Runner/Busser tip-out"} <span className="text-muted-foreground">{r.action}</span></Td>
0187 |                   <Td right className="text-muted-foreground">{money(r.old_amount)}</Td>
0188 |                   <Td right className="font-medium">{money(r.new_amount)}</Td>
0189 |                   <Td className="text-muted-foreground">{r.changed_by_email ?? "—"}</Td>
0190 |                 </tr>
0191 |               ))}
0192 |             </tbody>
0193 |           </table>
0194 |         ) : (
0195 |           <table className="w-full text-sm">
0196 |             <thead className="bg-secondary text-secondary-foreground">
0197 |               <tr><Th>When</Th><Th>Setting</Th><Th>Previous</Th><Th>New</Th><Th>By</Th></tr>
0198 |             </thead>
0199 |             <tbody>
0200 |               {loading && <tr><td colSpan={5} className="text-center p-8 text-muted-foreground">Loading…</td></tr>}
0201 |               {!loading && settings.length === 0 && (
0202 |                 <tr><td colSpan={5} className="text-center p-8 text-muted-foreground">No setting changes in this range.</td></tr>
0203 |               )}
0204 |               {settings.map((r) => (
0205 |                 <tr key={r.id} className="border-t border-border">
0206 |                   <Td>{when(r.created_at)}</Td>
0207 |                   <Td>{SETTING_LABELS[r.field] ?? r.field}</Td>
0208 |                   <Td className="text-muted-foreground">{fmtSetting(r.field, r.old_value)}</Td>
0209 |                   <Td className="font-medium">{fmtSetting(r.field, r.new_value)}</Td>
0210 |                   <Td className="text-muted-foreground">{r.changed_by_email ?? "—"}</Td>
0211 |                 </tr>
0212 |               ))}
0213 |             </tbody>
0214 |           </table>
0215 |         )}
0216 |       </section>
0217 |     </div>
0218 |   );
0219 | }
0220 | 
0221 | 
0222 | function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
0223 |   return <th className={`px-3 py-2 text-xs uppercase tracking-wide font-medium whitespace-nowrap ${right ? "text-right" : "text-left"}`}>{children}</th>;
0224 | }
0225 | function Td({ children, right, className }: { children: React.ReactNode; right?: boolean; className?: string }) {
0226 |   return <td className={`px-3 py-2 ${right ? "text-right tabular-nums" : ""} ${className ?? ""}`}>{children}</td>;
0227 | }
```
