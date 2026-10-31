import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { printElementFromClick } from "@/lib/print";
import { downloadTextFile } from "@/lib/download";
import { type PayPeriodType, payPeriodRange, previousPayPeriod } from "@/lib/location";
import { useBrand } from "@/lib/brand";
import {
  calcServer,
  calcBartender,
  calcSupportPool,
  poolFromShift,
  round2,
  splitBartenderShares,
  splitServerShares,
  type BartenderSplitMode,
  type Settings,
  type SupportRole,
  resolveSupportRole,
} from "@/lib/calculations";

export const Route = createFileRoute("/_authenticated/individual")({
  head: () => ({
    meta: [
      { title: "Individual Tip Summary · Tip Share" },
      { name: "description", content: "Pick a staff member and date range to see day-by-day tips with a summary total." },
      { property: "og:title", content: "Individual Tip Summary · Tip Share" },
      { property: "og:description", content: "Day-by-day tip detail and totals for one staff member over any date range." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IndividualPage,
});

type Staff = { id: string; name: string; server_number: string | null; role: string };
type ShiftRow = {
  id: string;
  shift_date: string;
  period: "AM" | "PM";
  shift_servers: { staff_id: string | null; cash_owed: number; credit_tips: number; lbw_sales: number; bar_tip_override: number | null; rb_tip_override: number | null; split_mode?: BartenderSplitMode | null; shift_server_members?: { staff_id: string; hours_worked: number }[] }[];
  shift_bartenders: {
    staff_id: string | null;
    cash_owed: number;
    credit_tips: number;
    rb_tip_override: number | null;
    split_mode: BartenderSplitMode;
    shift_bartender_members: { staff_id: string; hours_worked: number }[];
  }[];
  support_split_mode?: string | null;
  shift_support: { staff_id: string; hours_worked: number; role?: string | null }[];
};

type Line = {
  key: string;
  date: string;
  period: "AM" | "PM";
  roles: string[];
  hours: number;
  cash_owed: number;
  credit_tips: number;
  bar_from_servers: number;
  lbw_sales: number;
  bar_tip_out: number;
  rb_tip_out: number;
  rb_received: number;
  takehome: number;
};

const emptyLine = (key: string, date: string, period: "AM" | "PM"): Line => ({
  key, date, period, roles: [], hours: 0, cash_owed: 0, credit_tips: 0,
  bar_from_servers: 0, lbw_sales: 0, bar_tip_out: 0, rb_tip_out: 0, rb_received: 0, takehome: 0,
});

const totalTips = (l: { credit_tips: number; bar_from_servers: number; rb_received: number }) =>
  l.credit_tips + l.bar_from_servers + l.rb_received;

const takePct = (l: Line) => {
  const tips = totalTips(l);
  return tips > 0 ? (l.takehome / tips) * 100 : null;
};

type SettingsWithPeriod = Settings & {
  pay_period_type?: PayPeriodType;
  pay_period_anchor?: string | null;
  establishment_name?: string;
  logo_url?: string | null;
};

function IndividualPage() {
  const today = new Date().toISOString().slice(0, 10);
  const fourteen = new Date(Date.now() - 13 * 86400_000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(fourteen);
  const [to, setTo] = useState(today);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [settings, setSettings] = useState<SettingsWithPeriod | null>(null);
  const brand = useBrand(settings?.logo_url);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("staff").select("id, name, server_number, role").order("name"),
      supabase.from("app_settings").select("*").limit(1).maybeSingle(),
    ]).then(([s, st]) => {
      const list = (s.data ?? []) as Staff[];
      setStaff(list);
      setSelected((cur) => cur || (list[0]?.id ?? ""));
      setSettings(st.data as SettingsWithPeriod | null);
    });
  }, []);

  const mainRef = useRef<HTMLElement>(null);
  const reqSeq = useRef(0);
  useEffect(() => {
    const valid = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number(d.slice(0, 4)) > 1900;
    if (!valid(from) || !valid(to) || from > to) return;
    const seq = ++reqSeq.current;
    setLoading(true);
    supabase
      .from("shifts")
      .select("id, shift_date, period, shift_servers(staff_id, cash_owed, credit_tips, lbw_sales, bar_tip_override, rb_tip_override, split_mode, shift_server_members(staff_id, hours_worked)), shift_bartenders(staff_id, cash_owed, credit_tips, rb_tip_override, split_mode, shift_bartender_members(staff_id, hours_worked)), shift_support(staff_id, hours_worked, role), support_split_mode")
      .gte("shift_date", from)
      .lte("shift_date", to)
      .order("shift_date")
      .then(({ data }) => {
        if (seq !== reqSeq.current) return;
        setShifts((data ?? []) as unknown as ShiftRow[]);
        setLoading(false);
      });
  }, [from, to]);

  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
  const person = staffById.get(selected);

  const lines = useMemo(() => {
    const out: Line[] = [];
    if (!settings || !selected) return out;

    for (const sh of shifts) {
      const line = emptyLine(sh.id, sh.shift_date, sh.period);
      let touched = false;

      for (const sv of sh.shift_servers) {
        const c = calcServer(sv, settings);
        const shares = splitServerShares(
          sv,
          { bar_tip: c.bar_tip, rb_tip: c.rb_tip, takehome: c.takehome },
          sv.split_mode ?? "single",
          sv.shift_server_members ?? [],
        );
        for (const share of shares) {
          if (share.staff_id !== selected) continue;
          line.cash_owed += share.cash_owed;
          line.credit_tips += share.credit_tips;
          line.lbw_sales += share.lbw_sales;
          line.bar_tip_out += share.bar_tip;
          line.rb_tip_out += share.rb_tip;
          line.takehome += share.takehome;
          line.roles.push("server");
          touched = true;
        }
      }

      const serverBarTotal = sh.shift_servers.reduce((s, sv) => s + calcServer(sv, settings).bar_tip, 0);
      const bartenderCount = Math.max(sh.shift_bartenders.length, 1);
      for (const bt of sh.shift_bartenders) {
        const collected = round2(serverBarTotal / bartenderCount);
        const c = calcBartender(bt, collected, settings);
        const shares = splitBartenderShares(
          bt,
          { rb_tip: c.rb_tip, takehome: c.takehome, collected_from_servers: collected },
          bt.split_mode ?? "single",
          bt.shift_bartender_members ?? [],
        );
        for (const share of shares) {
          if (share.staff_id !== selected) continue;
          line.credit_tips += share.credit_tips;
          line.bar_from_servers += share.bar_from_servers;
          line.rb_tip_out += share.rb_tip;
          line.takehome += share.takehome;
          if (share.hours_worked) line.hours += share.hours_worked;
          line.roles.push("bartender");
          touched = true;
        }
      }

      const mine = sh.shift_support.filter((sp) => sp.staff_id === selected);
      if (mine.length > 0) {
        const pool = poolFromShift(sh.shift_servers, sh.shift_bartenders, settings);
        const supportRows = sh.shift_support.map((sp) => ({
          staff_id: sp.staff_id,
          role: resolveSupportRole(sp.role, staffById.get(sp.staff_id)?.role),
          hours_worked: sp.hours_worked,
        }));
        const payouts = calcSupportPool(supportRows, pool, settings, sh.support_split_mode === "shared" ? "shared" : "weighted");
        for (const sp of mine) {
          const payout = payouts.find((p) => p.staff_id === sp.staff_id)?.payout ?? 0;
          line.hours += sp.hours_worked;
          line.rb_received += payout;
          line.takehome += payout;
          line.roles.push((staffById.get(sp.staff_id)?.role ?? "support").replace("_", " "));
          touched = true;
        }
      }

      if (touched) {
        line.roles = Array.from(new Set(line.roles));
        out.push(line);
      }
    }
    return out.sort((a, b) => (a.date === b.date ? a.period.localeCompare(b.period) : a.date.localeCompare(b.date)));
  }, [shifts, settings, selected, staffById]);

  const total = useMemo(() => {
    const t = emptyLine("total", "", "AM");
    for (const l of lines) {
      t.hours += l.hours;
      t.cash_owed += l.cash_owed;
      t.credit_tips += l.credit_tips;
      t.bar_from_servers += l.bar_from_servers;
      t.lbw_sales += l.lbw_sales;
      t.bar_tip_out += l.bar_tip_out;
      t.rb_tip_out += l.rb_tip_out;
      t.rb_received += l.rb_received;
      t.takehome += l.takehome;
    }
    return t;
  }, [lines]);

  const avg = lines.length > 0 ? total.takehome / lines.length : 0;

  function downloadCSV() {
    if (!person) return;
    const headers = [
      "Name", "Server #", "Date", "Period", "Roles", "Hours", "Cash Owed",
      "Credit Tips", "Tips From Servers (Bar)", "LBW Sales",
      "Bar Tip Out", "R/B Tip Out", "R/B Received", "Take-Home", "Total Tips", "Take-Home %",
    ];
    const lineFor = (l: Line, dateLabel: string, periodLabel: string) => {
      const p = takePct(l);
      return [
        csvEsc(person.name), person.server_number ?? "",
        dateLabel, periodLabel, csvEsc(l.roles.join(" / ")),
        l.hours.toFixed(2), l.cash_owed.toFixed(2), l.credit_tips.toFixed(2),
        l.bar_from_servers.toFixed(2), l.lbw_sales.toFixed(2),
        l.bar_tip_out.toFixed(2), l.rb_tip_out.toFixed(2), l.rb_received.toFixed(2),
        l.takehome.toFixed(2), totalTips(l).toFixed(2), p === null ? "" : p.toFixed(1),
      ].join(",");
    };
    const rows = [headers.join(","), ...lines.map((l) => lineFor(l, l.date, l.period))];
    rows.push(lineFor(total, `${from} to ${to}`, "TOTAL"));
    downloadTextFile(
      rows.join("\n"),
      `tips_${person.name.replace(/\s+/g, "-")}_${from}_to_${to}.csv`,
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 bg-background border-b border-border z-10 print:hidden">
        <div className="max-w-5xl mx-auto p-4 flex items-center gap-3">
          <Link to="/" className="text-sm text-muted-foreground">← Home</Link>
          <h1 className="text-lg font-serif flex-1">Individual Summary</h1>
        </div>
      </header>

      <main ref={mainRef} className="max-w-5xl mx-auto p-4 space-y-4">
        <section className="print:hidden flex flex-wrap gap-2">
          <button
            onClick={() => { const r = payPeriodRange(settings?.pay_period_type ?? "biweekly", settings?.pay_period_anchor ?? null); setFrom(r.start); setTo(r.end); }}
            className="h-9 px-3 rounded-md border border-input text-sm"
          >
            This pay period
          </button>
          <button
            onClick={() => { const r = previousPayPeriod(settings?.pay_period_type ?? "biweekly", settings?.pay_period_anchor ?? null); setFrom(r.start); setTo(r.end); }}
            className="h-9 px-3 rounded-md border border-input text-sm"
          >
            Last pay period
          </button>
        </section>

        <section className="bg-card border border-border rounded-lg p-4 grid grid-cols-1 md:grid-cols-4 gap-3 print:hidden">
          <div className="md:col-span-2">
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Staff member</label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3"
            >
              {staff.length === 0 && <option value="">No staff yet</option>}
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.server_number ? ` (#${s.server_number})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3" />
          </div>
          <div className="md:col-span-4 flex gap-2">
            <button onClick={downloadCSV} className="flex-1 h-11 rounded-md bg-primary text-primary-foreground font-medium">Download CSV</button>
            <button onClick={() => printElementFromClick(mainRef.current, "Individual Summary")} className="h-11 px-4 rounded-md border border-input">Print</button>
          </div>
        </section>

        <section className="bg-card border border-border rounded-lg p-6 text-center print-header" style={{ borderTop: `4px solid ${brand.primary}` }}>
          {brand.logoUrl && <img src={brand.logoUrl} alt="" className="mx-auto h-24 max-w-[240px] object-contain mb-3" />}
          <h2 className="text-2xl font-serif" style={{ color: brand.primary }}>{settings?.establishment_name || "Individual Tip Summary"}</h2>
          {person ? (
            <div className="mt-3 inline-flex items-center gap-3 rounded-full px-5 py-2" style={{ background: brand.soft }}>
              <span className="text-3xl font-bold tracking-tight" style={{ color: brand.primary }}>{person.name}</span>
              {person.server_number && (
                <span className="text-lg font-semibold opacity-80" style={{ color: brand.primary }}>#{person.server_number}</span>
              )}
            </div>
          ) : (
            <p className="text-xl mt-3 font-medium text-muted-foreground">—</p>
          )}
          <p className="text-sm mt-3" style={{ color: brand.accent }}>{from} to {to}</p>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
            <Stat label="Shifts worked" value={String(lines.length)} />
            <Stat label="Total tips" value={`$${totalTips(total).toFixed(2)}`} />
            <Stat label="Take-home" value={`$${total.takehome.toFixed(2)}`} />
            <Stat label="Avg per shift" value={`$${avg.toFixed(2)}`} />
          </div>
        </section>

        <section className="report-table bg-card border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: brand.primary, color: brand.onPrimary }}>
              <tr>
                <Th>Date</Th><Th>Shift</Th><Th>Role(s)</Th>
                <Th right>Hours</Th>
                <Th right>Credit Tips</Th>
                <Th right>From Servers</Th>
                <Th right>LBW Sales</Th>
                <Th right>Bar Out</Th><Th right>R/B Out</Th><Th right>R/B Recv</Th>
                <Th right>Take-Home (%)</Th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={11} className="text-center p-8 text-muted-foreground">Loading…</td></tr>}
              {!loading && lines.length === 0 && (
                <tr><td colSpan={11} className="text-center p-8 text-muted-foreground">No shifts for this person in this range.</td></tr>
              )}
              {lines.map((l) => {
                const pct = takePct(l);
                return (
                  <tr key={l.key} className="border-t border-border">
                    <Td>{dayLabel(l.date)}</Td>
                    <Td className="text-muted-foreground">{l.period}</Td>
                    <Td className="text-muted-foreground capitalize">{l.roles.join(", ")}</Td>
                    <Td right>{l.hours ? l.hours.toFixed(2) : "—"}</Td>
                    <Td right>${l.credit_tips.toFixed(2)}</Td>
                    <Td right className={l.bar_from_servers ? "" : "text-muted-foreground"}>
                      {l.bar_from_servers ? `$${l.bar_from_servers.toFixed(2)}` : "—"}
                    </Td>
                    <Td right>${l.lbw_sales.toFixed(2)}</Td>
                    <Td right>${l.bar_tip_out.toFixed(2)}</Td>
                    <Td right>${l.rb_tip_out.toFixed(2)}</Td>
                    <Td right>${l.rb_received.toFixed(2)}</Td>
                    <Td right className="font-medium">
                      ${l.takehome.toFixed(2)}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        ({pct === null ? "—" : `${pct.toFixed(1)}%`})
                      </span>
                    </Td>
                  </tr>
                );
              })}
              {!loading && lines.length > 0 && (
                <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
                  <Td>Total</Td>
                  <Td>{lines.length} shifts</Td>
                  <Td>—</Td>
                  <Td right>{total.hours.toFixed(2)}</Td>
                  <Td right>${total.credit_tips.toFixed(2)}</Td>
                  <Td right>${total.bar_from_servers.toFixed(2)}</Td>
                  <Td right>${total.lbw_sales.toFixed(2)}</Td>
                  <Td right>${total.bar_tip_out.toFixed(2)}</Td>
                  <Td right>${total.rb_tip_out.toFixed(2)}</Td>
                  <Td right>${total.rb_received.toFixed(2)}</Td>
                  <Td right>
                    ${total.takehome.toFixed(2)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      ({takePct(total) === null ? "—" : `${takePct(total)!.toFixed(1)}%`})
                    </span>
                  </Td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </main>

      <style>{`
        @media print {
          @page { size: landscape; margin: 0.25in; }
          html, body { background: white !important; font-size: 9pt; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print-header img { height: 1.35in !important; max-width: 2.8in !important; }
          .print-header { border: none !important; border-bottom: 2px solid ${brand.primary} !important; border-radius: 0 !important; padding: 0.15in 0 0.12in 0 !important; margin-bottom: 0.12in !important; }
          .print-header .rounded-full { border-radius: 9999px !important; padding: 0.08in 0.22in !important; margin-top: 0.08in !important; }
          .print-header .rounded-full span:first-child { font-size: 20pt !important; }
          .report-table { overflow: visible !important; border: none !important; border-radius: 0 !important; }
          .report-table table { width: 100% !important; table-layout: fixed; font-size: 8pt; border-collapse: collapse; }
          .report-table th, .report-table td { padding: 1px 3px !important; line-height: 1.2; word-break: break-word; overflow-wrap: anywhere; }
          .report-table thead { display: table-header-group; }
          .report-table tr { page-break-inside: avoid; break-inside: avoid; }
          main { max-width: none !important; padding: 0 !important; }
          main > * + * { margin-top: 0.12in !important; }
          section, .rounded-lg { border-radius: 0 !important; }
          section > div, section .p-4, .p-4 { padding: 0.06in !important; }
        }
      `}</style>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-medium tabular-nums">{value}</div>
    </div>
  );
}
function dayLabel(date: string) {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-3 py-2 text-xs uppercase tracking-wide font-medium whitespace-nowrap ${right ? "text-right" : "text-left"}`}>{children}</th>;
}
function Td({ children, right, className }: { children: React.ReactNode; right?: boolean; className?: string }) {
  return <td className={`px-3 py-2 whitespace-nowrap ${right ? "text-right tabular-nums" : ""} ${className ?? ""}`}>{children}</td>;
}
function csvEsc(s: string) {
  if (s == null) return "";
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
