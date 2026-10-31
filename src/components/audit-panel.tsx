import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { downloadTextFile } from "@/lib/download";

type TipRow = {
  id: string;
  shift_date: string | null;
  period: string | null;
  entry_kind: string;
  staff_id: string | null;
  field: string;
  old_amount: number | null;
  new_amount: number | null;
  action: string;
  changed_by_email: string | null;
  created_at: string;
};
type SettingRow = {
  id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_by_email: string | null;
  created_at: string;
};

const SETTING_LABELS: Record<string, string> = {
  bar_tip_pct: "Bar tip-out %",
  runner_busser_tip_pct: "Runner/Busser tip-out %",
  bartender_tip_pct: "Bartender → support %",
  max_tipout_pct: "Max total tip-out %",
  rb_basis: "Tip-out basis",
  weight_runner: "Runner weight",
  weight_busser: "Busser weight",
  weight_bar_back: "Bar back weight",
  weight_hostess: "Hostess weight",
  rounding_mode: "Rounding mode",
  use_net_sales: "Use net sales",
  sales_tax_pct: "Sales tax %",
  cc_fee_enabled: "CC fee recovery",
  cc_fee_pct: "CC fee %",
  manager_exclusion_enabled: "Exclude managers",
  pay_period_type: "Pay period",
  pay_period_anchor: "Pay period start",
  establishment_name: "Establishment name",
  logo_url: "Logo",
  sms_enabled: "SMS enabled",
  sms_from_number: "SMS from number",
  sms_include_breakdown: "SMS breakdown",
};

const PCT_FIELDS = new Set([
  "bar_tip_pct", "runner_busser_tip_pct", "bartender_tip_pct", "max_tipout_pct", "sales_tax_pct", "cc_fee_pct",
]);

function fmtSetting(field: string, value: string | null) {
  if (value === null || value === "") return "—";
  if (PCT_FIELDS.has(field)) {
    const n = Number(value);
    return Number.isFinite(n) ? `${(n * 100).toFixed(2).replace(/\.?0+$/, "")}%` : value;
  }
  if (value === "true") return "On";
  if (value === "false") return "Off";
  return value;
}
const money = (n: number | null) => (n == null ? "—" : `$${n.toFixed(2)}`);
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

export function AuditPanel() {
  const [tab, setTab] = useState<"tips" | "settings">("tips");
  const [staffNames, setStaffNames] = useState<Map<string, string>>(new Map());
  const [tips, setTips] = useState<TipRow[]>([]);
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }, []);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);

  useEffect(() => {
    (async () => {
      const { data: staff } = await supabase.from("staff").select("id, name, server_number");
      setStaffNames(new Map((staff ?? []).map((s) => [s.id, s.server_number ? `${s.name} (#${s.server_number})` : s.name])));
    })();
  }, []);

  useEffect(() => {
    setLoading(true);
    const start = `${from}T00:00:00.000Z`;
    const end = `${to}T23:59:59.999Z`;
    Promise.all([
      supabase
        .from("tip_override_audit")
        .select("id, shift_date, period, entry_kind, staff_id, field, old_amount, new_amount, action, changed_by_email, created_at")
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("settings_audit")
        .select("id, field, old_value, new_value, changed_by_email, created_at")
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false })
        .limit(500),
    ]).then(([t, s]) => {
      setTips((t.data ?? []) as TipRow[]);
      setSettings((s.data ?? []) as SettingRow[]);
      setLoading(false);
    });
  }, [from, to]);

  const exportCsv = () => {
    const rows = tab === "tips"
      ? [
          ["When", "Shift date", "Period", "Type", "Staff", "Field", "Action", "Previous", "New", "Changed by"],
          ...tips.map((r) => [
            when(r.created_at), r.shift_date ?? "", r.period ?? "", r.entry_kind,
            r.staff_id ? staffNames.get(r.staff_id) ?? "" : "",
            r.field === "bar_tip" ? "Bar tip-out" : "Runner/Busser tip-out",
            r.action, r.old_amount ?? "", r.new_amount ?? "", r.changed_by_email ?? "",
          ]),
        ]
      : [
          ["When", "Setting", "Previous", "New", "Changed by"],
          ...settings.map((r) => [
            when(r.created_at), SETTING_LABELS[r.field] ?? r.field,
            fmtSetting(r.field, r.old_value), fmtSetting(r.field, r.new_value), r.changed_by_email ?? "",
          ]),
        ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    downloadTextFile(csv, `audit-${tab}-${from}-to-${to}.csv`);
  };

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center gap-2 print:hidden">
        <div className="inline-flex rounded-md border border-input overflow-hidden">
          {(["tips", "settings"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`h-9 px-3 text-sm ${tab === t ? "bg-primary text-primary-foreground" : "bg-background"}`}
            >
              {t === "tips" ? "Tip adjustments" : "Setting changes"}
            </button>
          ))}
        </div>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 px-2 rounded-md border border-input bg-background text-sm" />
        <span className="text-muted-foreground text-sm">to</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 px-2 rounded-md border border-input bg-background text-sm" />
        <div className="flex-1" />
        <button onClick={exportCsv} className="h-9 px-3 rounded-md border border-input text-sm">CSV</button>
        <button onClick={() => window.print()} className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm">Print</button>
      </section>

      <p className="text-xs text-muted-foreground">
        {tab === "tips"
          ? "Every manual tip-out edit made after the shift entry was created — who changed it, the calculated amount it replaced, and the new amount."
          : "Every change to the establishment's default tip-share settings."}
      </p>

      <section className="bg-card border border-border rounded-lg overflow-x-auto">
        {tab === "tips" ? (
          <table className="w-full text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>
                <Th>When</Th><Th>Shift</Th><Th>Staff</Th><Th>Adjusted</Th><Th right>Previous</Th><Th right>New</Th><Th>By</Th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="text-center p-8 text-muted-foreground">Loading…</td></tr>}
              {!loading && tips.length === 0 && (
                <tr><td colSpan={7} className="text-center p-8 text-muted-foreground">No manual tip adjustments in this range.</td></tr>
              )}
              {tips.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <Td>{when(r.created_at)}</Td>
                  <Td>{r.shift_date ?? "—"}{r.period ? ` ${r.period}` : ""}</Td>
                  <Td>{r.staff_id ? staffNames.get(r.staff_id) ?? "—" : "—"} <span className="text-muted-foreground">({r.entry_kind})</span></Td>
                  <Td>{r.field === "bar_tip" ? "Bar tip-out" : "Runner/Busser tip-out"} <span className="text-muted-foreground">{r.action}</span></Td>
                  <Td right className="text-muted-foreground">{money(r.old_amount)}</Td>
                  <Td right className="font-medium">{money(r.new_amount)}</Td>
                  <Td className="text-muted-foreground">{r.changed_by_email ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr><Th>When</Th><Th>Setting</Th><Th>Previous</Th><Th>New</Th><Th>By</Th></tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="text-center p-8 text-muted-foreground">Loading…</td></tr>}
              {!loading && settings.length === 0 && (
                <tr><td colSpan={5} className="text-center p-8 text-muted-foreground">No setting changes in this range.</td></tr>
              )}
              {settings.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <Td>{when(r.created_at)}</Td>
                  <Td>{SETTING_LABELS[r.field] ?? r.field}</Td>
                  <Td className="text-muted-foreground">{fmtSetting(r.field, r.old_value)}</Td>
                  <Td className="font-medium">{fmtSetting(r.field, r.new_value)}</Td>
                  <Td className="text-muted-foreground">{r.changed_by_email ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}


function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-3 py-2 text-xs uppercase tracking-wide font-medium whitespace-nowrap ${right ? "text-right" : "text-left"}`}>{children}</th>;
}
function Td({ children, right, className }: { children: React.ReactNode; right?: boolean; className?: string }) {
  return <td className={`px-3 py-2 ${right ? "text-right tabular-nums" : ""} ${className ?? ""}`}>{children}</td>;
}
