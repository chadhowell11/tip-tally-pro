import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { printElement, printHtmlFromClick } from "@/lib/print";
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


export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports · Tip Share" }] }),
  component: ReportsPage,
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

type Totals = {
  shifts: number;
  hours: number;
  cash_owed: number;
  credit_tips: number;
  lbw_sales: number;
  bar_tip_out: number;
  rb_tip_out: number;
  rb_received: number;
  bar_from_servers: number;
  takehome: number;
};

const empty = (): Totals => ({
  shifts: 0, hours: 0, cash_owed: 0, credit_tips: 0, lbw_sales: 0,
  bar_tip_out: 0, rb_tip_out: 0, rb_received: 0, bar_from_servers: 0, takehome: 0,
});

/** Total tips flowing to a person before tip-outs. */
const totalTips = (t: Totals) => t.credit_tips + t.bar_from_servers + t.rb_received;

/** Take-home as a % of total tips; null when there are no tips. */
const takePct = (t: Totals) => {
  const tips = totalTips(t);
  return tips > 0 ? (t.takehome / tips) * 100 : null;
};



type SettingsWithPeriod = Settings & { pay_period_type?: PayPeriodType; pay_period_anchor?: string | null; establishment_name?: string; logo_url?: string | null };

function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const fourteen = new Date(Date.now() - 13 * 86400_000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(fourteen);
  const [to, setTo] = useState(today);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [positions, setPositions] = useState<Record<string, string[]>>({});
  const [settings, setSettings] = useState<SettingsWithPeriod | null>(null);
  const brand = useBrand(settings?.logo_url);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [printMode, setPrintMode] = useState<"all" | "slips">("all");
  const [printOnly, setPrintOnly] = useState<string | null>(null);

  const [pendingPrint, setPendingPrint] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const slipsRef = useRef<HTMLDivElement>(null);

  // Individual sheets print straight from the click (markup is always mounted,
  // just hidden), so no popup blocker / async-gesture issues.
  function printSlips() {
    const el = slipsRef.current;
    if (!el) return;
    printHtmlFromClick(el.innerHTML, "Payroll Sheets");
  }

  function runPrint(mode: "all" | "slips", staffId?: string | null) {
    setPrintMode(mode);
    setPrintOnly(staffId ?? null);
    setPendingPrint(true);
  }

  // Print only after the slip markup has actually painted, and keep it mounted
  // until the browser's print dialog closes (afterprint).
  useEffect(() => {
    if (!pendingPrint) return;
    let raf2 = 0;
    const done = () => {
      setPendingPrint(false);
      setPrintMode("all");
    };
    window.addEventListener("afterprint", done);
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        printElement(mainRef.current, "Payroll Report");
        // Safari/older browsers may never fire afterprint.
        setTimeout(() => setPendingPrint(false), 1000);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.removeEventListener("afterprint", done);
    };
  }, [pendingPrint]);



  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase.from("staff").select("id, name, server_number, role"),
      supabase.from("app_settings").select("*").limit(1).maybeSingle(),
      supabase.from("staff_positions").select("staff_id, position"),
    ]).then(([s, st, sp]) => {
      if (cancelled) return;
      const error = s.error ?? st.error ?? sp.error;
      if (error) {
        setReportError("The payroll setup could not be loaded. Please try again.");
        return;
      }
      setStaff((s.data ?? []) as Staff[]);
      setSettings(st.data as SettingsWithPeriod | null);
      const map: Record<string, string[]> = {};
      for (const row of (sp.data ?? []) as { staff_id: string; position: string }[]) {
        (map[row.staff_id] ??= []).push(row.position);
      }
      setPositions(map);
      setReportError(null);
    }).catch(() => {
      if (!cancelled) setReportError("The payroll setup could not be loaded. Please try again.");
    });
    return () => { cancelled = true; };
  }, [reloadKey]);


  const reqSeq = useRef(0);
  useEffect(() => {
    // Ignore incomplete/invalid dates while typing in the date inputs.
    const valid = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number(d.slice(0, 4)) > 1900;
    if (!valid(from) || !valid(to) || from > to) return;
    const seq = ++reqSeq.current;
    setLoading(true);
    setReportError(null);
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("shifts")
          .select("id, shift_date, period, shift_servers(staff_id, cash_owed, credit_tips, lbw_sales, bar_tip_override, rb_tip_override, split_mode, shift_server_members(staff_id, hours_worked)), shift_bartenders(staff_id, cash_owed, credit_tips, rb_tip_override, split_mode, shift_bartender_members(staff_id, hours_worked)), shift_support(staff_id, hours_worked, role), support_split_mode")
          .gte("shift_date", from)
          .lte("shift_date", to)
          .order("shift_date");
        // Drop out-of-order responses so a slow older range can't overwrite newer results.
        if (seq !== reqSeq.current) return;
        if (error) {
          setReportError("The payroll records could not be loaded. Please try again.");
          setLoading(false);
          return;
        }
        const safeShifts = (data ?? []).map((shift) => ({
          ...shift,
          shift_servers: shift.shift_servers ?? [],
          shift_bartenders: shift.shift_bartenders ?? [],
          shift_support: shift.shift_support ?? [],
        }));
        setShifts(safeShifts as unknown as ShiftRow[]);
        setLoading(false);
      } catch {
        if (seq !== reqSeq.current) return;
        setReportError("The payroll records could not be loaded. Please try again.");
        setLoading(false);
      }
    })();
  }, [from, to, reloadKey]);

  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);

  const totalsByStaff = useMemo(() => {
    const map = new Map<string, Totals>();
    if (!settings) return map;
    const bump = (id: string, patch: Partial<Totals>) => {
      const t = map.get(id) ?? empty();
      for (const k in patch) (t as any)[k] += (patch as any)[k] ?? 0;
      map.set(id, t);
    };
    for (const sh of shifts) {
      const shiftStaffSeen = new Set<string>();
      for (const sv of sh.shift_servers) {
        const c = calcServer(sv, settings);
        const shares = splitServerShares(
          sv,
          { bar_tip: c.bar_tip, rb_tip: c.rb_tip, takehome: c.takehome },
          sv.split_mode ?? "single",
          sv.shift_server_members ?? [],
        );
        for (const share of shares) {
          bump(share.staff_id, {
            cash_owed: share.cash_owed, credit_tips: share.credit_tips, lbw_sales: share.lbw_sales,
            bar_tip_out: share.bar_tip, rb_tip_out: share.rb_tip, takehome: share.takehome,
          });
          shiftStaffSeen.add(share.staff_id);
        }
      }
      // bartenders: collect server bar tips
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
          bump(share.staff_id, {
            cash_owed: share.cash_owed,
            credit_tips: share.credit_tips,
            bar_from_servers: share.bar_from_servers,
            rb_tip_out: share.rb_tip,
            takehome: share.takehome,
          });
          shiftStaffSeen.add(share.staff_id);
        }

      }


      // support pool
      const pool = poolFromShift(sh.shift_servers, sh.shift_bartenders, settings);
      const supportRows = sh.shift_support.map((sp) => ({
        staff_id: sp.staff_id,
        role: resolveSupportRole(sp.role, staffById.get(sp.staff_id)?.role),
        hours_worked: sp.hours_worked,
      }));
      const payouts = calcSupportPool(supportRows, pool, settings, (sh.support_split_mode === "shared" ? "shared" : "weighted"));
      for (const sp of sh.shift_support) {
        const payout = payouts.find((p) => p.staff_id === sp.staff_id)?.payout ?? 0;
        bump(sp.staff_id, { hours: sp.hours_worked, rb_received: payout, takehome: payout });
        shiftStaffSeen.add(sp.staff_id);
      }
      for (const id of shiftStaffSeen) bump(id, { shifts: 1 });
    }
    return map;
  }, [shifts, settings, staffById]);

  /** Per-person, per-day (and period) breakdown used by the individual print sheets. */
  const dayRowsByStaff = useMemo(() => {
    const out = new Map<string, { date: string; period: string; totals: Totals }[]>();
    if (!settings) return out;
    for (const sh of shifts) {
      const perStaff = new Map<string, Totals>();
      const bump = (id: string, patch: Partial<Totals>) => {
        const t = perStaff.get(id) ?? empty();
        for (const k in patch) (t as any)[k] += (patch as any)[k] ?? 0;
        perStaff.set(id, t);
      };
      for (const sv of sh.shift_servers) {
        const c = calcServer(sv, settings);
        const shares = splitServerShares(
          sv,
          { bar_tip: c.bar_tip, rb_tip: c.rb_tip, takehome: c.takehome },
          sv.split_mode ?? "single",
          sv.shift_server_members ?? [],
        );
        for (const share of shares) {
          bump(share.staff_id, {
            cash_owed: share.cash_owed, credit_tips: share.credit_tips, lbw_sales: share.lbw_sales,
            bar_tip_out: share.bar_tip, rb_tip_out: share.rb_tip, takehome: share.takehome,
          });
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
          bump(share.staff_id, {
            cash_owed: share.cash_owed, credit_tips: share.credit_tips,
            bar_from_servers: share.bar_from_servers, rb_tip_out: share.rb_tip, takehome: share.takehome,
          });
        }
      }
      const pool = poolFromShift(sh.shift_servers, sh.shift_bartenders, settings);
      const supportRows = sh.shift_support.map((sp) => ({
        staff_id: sp.staff_id,
        role: resolveSupportRole(sp.role, staffById.get(sp.staff_id)?.role),
        hours_worked: sp.hours_worked,
      }));
      const payouts = calcSupportPool(supportRows, pool, settings, (sh.support_split_mode === "shared" ? "shared" : "weighted"));
      for (const sp of sh.shift_support) {
        const payout = payouts.find((p) => p.staff_id === sp.staff_id)?.payout ?? 0;
        bump(sp.staff_id, { hours: sp.hours_worked, rb_received: payout, takehome: payout });
      }
      for (const [id, t] of perStaff) {
        t.shifts = 1;
        (out.get(id) ?? out.set(id, []).get(id)!).push({ date: sh.shift_date, period: sh.period, totals: t });
      }
    }
    for (const list of out.values()) {
      list.sort((a, b) => (a.date === b.date ? a.period.localeCompare(b.period) : a.date.localeCompare(b.date)));
    }
    return out;
  }, [shifts, settings, staffById]);

  const rows = useMemo(() => {
    return Array.from(totalsByStaff.entries())
      .map(([id, t]) => ({ staff: staffById.get(id), totals: t }))
      .filter((r) => r.staff)
      .sort((a, b) => (a.staff!.name ?? "").localeCompare(b.staff!.name ?? ""));
  }, [totalsByStaff, staffById]);

  const visibleRows = useMemo(
    () => (printOnly ? rows.filter((r) => r.staff!.id === printOnly) : rows),
    [rows, printOnly],
  );



  const grand = useMemo(() => {
    const t = empty();
    for (const r of rows) {
      t.shifts += r.totals.shifts;
      t.hours += r.totals.hours;
      t.cash_owed += r.totals.cash_owed;
      t.credit_tips += r.totals.credit_tips;
      t.lbw_sales += r.totals.lbw_sales;
      t.bar_tip_out += r.totals.bar_tip_out;
      t.rb_tip_out += r.totals.rb_tip_out;
      t.rb_received += r.totals.rb_received;
      t.bar_from_servers += r.totals.bar_from_servers;
      t.takehome += r.totals.takehome;
    }
    return t;
  }, [rows]);

  function downloadCSV() {
    const headers = [
      "Date From", "Date To", "Name", "Server #", "Role", "Shifts", "Hours",
      "Cash Owed", "Credit Tips", "Tips From Servers (Bar)", "LBW Sales",
      "Bar Tip Out", "R/B Tip Out", "R/B Received", "Take-Home", "Total Tips", "Take-Home %",
    ];
    const lines = [headers.join(",")];
    for (const r of rows) {
      const s = r.staff!;
      const t = r.totals;
      const p = takePct(t);
      const row = [
        from, to,
        csvEsc(s.name),
        s.server_number ?? "",
        csvEsc(roleLabel(s, positions)),
        t.shifts, t.hours.toFixed(2),
        t.cash_owed.toFixed(2), t.credit_tips.toFixed(2),
        t.bar_from_servers.toFixed(2),
        t.lbw_sales.toFixed(2),
        t.bar_tip_out.toFixed(2), t.rb_tip_out.toFixed(2), t.rb_received.toFixed(2), t.takehome.toFixed(2),
        totalTips(t).toFixed(2), p === null ? "" : p.toFixed(1),
      ];
      lines.push(row.join(","));
    }
    const gp = takePct(grand);
    lines.push([
      from, to, "TOTAL", "", "",
      grand.shifts, grand.hours.toFixed(2),
      grand.cash_owed.toFixed(2), grand.credit_tips.toFixed(2),
      grand.bar_from_servers.toFixed(2),
      grand.lbw_sales.toFixed(2),
      grand.bar_tip_out.toFixed(2), grand.rb_tip_out.toFixed(2),
      grand.rb_received.toFixed(2), grand.takehome.toFixed(2),
      totalTips(grand).toFixed(2), gp === null ? "" : gp.toFixed(1),
    ].join(","));



    downloadTextFile(lines.join("\n"), `tip-share_${from}_to_${to}.csv`);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 bg-background border-b border-border z-10 print:hidden">
        <div className="max-w-5xl mx-auto p-4 flex items-center gap-3">
          <Link to="/" className="text-sm text-muted-foreground">← Home</Link>
          <h1 className="text-lg font-serif flex-1">Payroll Report</h1>
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
        <section className="bg-card border border-border rounded-lg p-4 grid grid-cols-1 md:grid-cols-3 gap-3 print:hidden">
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3" />
          </div>
          <div className="flex items-end gap-2">
            <button onClick={downloadCSV} className="flex-1 h-11 rounded-md bg-primary text-primary-foreground font-medium">
              Download CSV
            </button>
            <button onClick={() => runPrint("all")} className="h-11 px-4 rounded-md border border-input">Print all</button>
          </div>
        </section>

        {reportError && (
          <section className="border border-destructive/40 bg-destructive/10 p-4 print:hidden" role="alert">
            <p className="text-sm text-destructive">{reportError}</p>
            <button
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
              className="mt-3 h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Try again
            </button>
          </section>
        )}

        <section className="bg-card border border-border rounded-lg p-4 flex flex-wrap items-end gap-3 print:hidden">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Print individually</label>
            <select
              value={printOnly ?? ""}
              onChange={(e) => setPrintOnly(e.target.value || null)}
              className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3"
            >
              <option value="">Everyone — one page per person</option>
              {rows.map((r) => (
                <option key={r.staff!.id} value={r.staff!.id}>
                  {r.staff!.name}{r.staff!.server_number ? ` (#${r.staff!.server_number})` : ""}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={printSlips}
            disabled={rows.length === 0}
            className="h-11 px-5 rounded-md border border-input font-medium disabled:opacity-50"
          >
            Print individual sheets
          </button>
          {printOnly && (
            <button
              onClick={() => setPrintOnly(null)}
              className="h-11 px-4 rounded-md border border-input text-sm"
            >
              Show everyone
            </button>
          )}
          {printOnly && (
            <p className="w-full text-xs text-muted-foreground">
              Showing {staffById.get(printOnly)?.name ?? "selected person"} only — the table below is filtered to match what will print.
            </p>
          )}
        </section>

        <p className="text-xs text-muted-foreground print:hidden">
          CSV is plain comma-separated — your CPA can map columns into QuickBooks (Journal Entry, Bills, or Payroll import) on their end.
        </p>

        <section className="bg-card border border-border rounded-lg p-6 text-center print-header" style={{ borderTop: `4px solid ${brand.primary}` }}>
          {brand.logoUrl && <img src={brand.logoUrl} alt="" className="mx-auto h-24 max-w-[240px] object-contain mb-3" />}
          <h2 className="text-2xl font-serif" style={{ color: brand.primary }}>{settings?.establishment_name || "Payroll Report"}</h2>
          <p className="text-sm mt-1" style={{ color: brand.accent }}>Tip Payroll Statement · {from} to {to}</p>
        </section>

        <div ref={slipsRef} className="hidden" aria-hidden="true">
          <div>
            {rows
              .filter((r) => !printOnly || r.staff!.id === printOnly)
              .map((r) => {
                const t = r.totals;
                const pct = takePct(t);
                const days = dayRowsByStaff.get(r.staff!.id) ?? [];
                const money = (n: number) => `$${n.toFixed(2)}`;
                const dayLabel = (d: string) =>
                  new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
                const line = (label: string, value: string) => (
                  <div key={label} className="flex justify-between border-b border-black/20 py-1">
                    <span>{label}</span>
                    <span className="tabular-nums font-medium">{value}</span>
                  </div>
                );
                return (
                  <div key={r.staff!.id} className="slip text-sm">
                    <div className="text-lg font-serif">{r.staff!.name}</div>
                    <div className="text-xs">
                      {r.staff!.server_number ? `#${r.staff!.server_number} · ` : ""}
                      {roleLabel(r.staff!, positions)}
                    </div>
                    <div className="text-xs mb-2">Pay period {from} – {to}</div>

                    <table className="slip-table w-full text-xs mb-3">
                      <thead>
                        <tr className="border-b border-black/40">
                          <th className="text-left">Date</th>
                          <th className="text-left">Shift</th>
                          <th className="text-right">Hrs</th>
                          <th className="text-right">Cash Owed</th>
                          <th className="text-right">CC Tips</th>
                          <th className="text-right">From Srv</th>
                          <th className="text-right">R/B Recv</th>
                          <th className="text-right">Bar Out</th>
                          <th className="text-right">R/B Out</th>
                          <th className="text-right">Take-Home</th>
                        </tr>
                      </thead>
                      <tbody>
                        {days.map((d) => (
                          <tr key={`${d.date}-${d.period}`} className="border-b border-black/15">
                            <td>{dayLabel(d.date)}</td>
                            <td>{d.period}</td>
                            <td className="text-right tabular-nums">{d.totals.hours ? d.totals.hours.toFixed(2) : "—"}</td>
                            <td className="text-right tabular-nums">{money(d.totals.cash_owed)}</td>
                            <td className="text-right tabular-nums">{money(d.totals.credit_tips)}</td>
                            <td className="text-right tabular-nums">{money(d.totals.bar_from_servers)}</td>
                            <td className="text-right tabular-nums">{money(d.totals.rb_received)}</td>
                            <td className="text-right tabular-nums">-{money(d.totals.bar_tip_out)}</td>
                            <td className="text-right tabular-nums">-{money(d.totals.rb_tip_out)}</td>
                            <td className="text-right tabular-nums font-medium">{money(d.totals.takehome)}</td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-black/60 font-semibold">
                          <td>Totals</td>
                          <td>{days.length} shift{days.length === 1 ? "" : "s"}</td>
                          <td className="text-right tabular-nums">{t.hours.toFixed(2)}</td>
                          <td className="text-right tabular-nums">{money(t.cash_owed)}</td>
                          <td className="text-right tabular-nums">{money(t.credit_tips)}</td>
                          <td className="text-right tabular-nums">{money(t.bar_from_servers)}</td>
                          <td className="text-right tabular-nums">{money(t.rb_received)}</td>
                          <td className="text-right tabular-nums">-{money(t.bar_tip_out)}</td>
                          <td className="text-right tabular-nums">-{money(t.rb_tip_out)}</td>
                          <td className="text-right tabular-nums">{money(t.takehome)}</td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="text-xs uppercase tracking-wide mb-1" style={{ color: brand.primary }}>
                      Period summary
                    </div>
                    {line("Shifts", String(t.shifts))}
                    {line("Hours", t.hours.toFixed(2))}
                    {line("Cash owed (turned in)", money(t.cash_owed))}
                    {line("Credit card tips", money(t.credit_tips))}
                    {line("Tips from servers", money(t.bar_from_servers))}
                    {line("R/B received", money(t.rb_received))}
                    {line("LBW sales", money(t.lbw_sales))}
                    {line("Bar tip out", `-${money(t.bar_tip_out)}`)}
                    {line("R/B tip out", `-${money(t.rb_tip_out)}`)}
                    {line("Total tips", money(totalTips(t)))}
                    <div className="flex justify-between pt-2 font-semibold">
                      <span>Take-home</span>
                      <span className="tabular-nums">
                        ${t.takehome.toFixed(2)} ({pct === null ? "—" : `${pct.toFixed(1)}%`})
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        <section className={`bg-card border border-border rounded-lg p-4 flex items-baseline justify-between gap-3 ${printMode === "slips" ? "print:hidden" : ""}`}>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Total cash deposits (house)</div>
            <div className="text-xs text-muted-foreground">Cash owed turned in by servers and bartenders, {from} – {to}</div>
          </div>
          <div className="text-2xl font-serif">${grand.cash_owed.toFixed(2)}</div>
        </section>

        <section className={`report-table bg-card border border-border rounded-lg overflow-x-auto ${printMode === "slips" ? "print:hidden" : ""}`}>

          <table className="w-full text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>
                <Th>Name</Th><Th>#</Th><Th>Roles</Th>
                <Th right>Shifts</Th><Th right>Hours</Th>
                <Th right>Cash Owed</Th>
                <Th right>Credit Tips</Th>
                <Th right>From Servers</Th>
                <Th right>LBW Sales</Th>
                <Th right>Bar Out</Th><Th right>R/B Out</Th>
                <Th right>R/B Recv</Th>
                <Th right>Take-Home (%)</Th>


              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={13} className="text-center p-8 text-muted-foreground">Loading…</td></tr>}
              {!loading && visibleRows.length === 0 && (
                <tr><td colSpan={13} className="text-center p-8 text-muted-foreground">No shifts in this range.</td></tr>
              )}
              {visibleRows.map((r) => {
                const showFromServers = r.totals.bar_from_servers !== 0;
                const pct = takePct(r.totals);
                return (
                <tr key={r.staff!.id} className="border-t border-border">
                  <Td>{r.staff!.name}</Td>
                  <Td className="text-muted-foreground">{r.staff!.server_number ?? "—"}</Td>
                  <Td className="text-muted-foreground capitalize">{roleLabel(r.staff!, positions)}</Td>
                  <Td right>{r.totals.shifts}</Td>
                  <Td right>{r.totals.hours.toFixed(2)}</Td>
                  <Td right>${r.totals.cash_owed.toFixed(2)}</Td>
                  <Td right>${r.totals.credit_tips.toFixed(2)}</Td>
                  <Td right className={showFromServers ? "" : "text-muted-foreground"}>
                    {showFromServers ? `$${r.totals.bar_from_servers.toFixed(2)}` : "—"}
                  </Td>
                  <Td right>${r.totals.lbw_sales.toFixed(2)}</Td>
                  <Td right>${r.totals.bar_tip_out.toFixed(2)}</Td>
                  <Td right>${r.totals.rb_tip_out.toFixed(2)}</Td>
                  <Td right>${r.totals.rb_received.toFixed(2)}</Td>
                  <Td right className="font-medium">
                    ${r.totals.takehome.toFixed(2)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      ({pct === null ? "—" : `${pct.toFixed(1)}%`})
                    </span>
                  </Td>
                </tr>
                );
              })}

              {!loading && !printOnly && rows.length > 0 && (
                <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
                  <Td>Total</Td>
                  <Td>—</Td>
                  <Td>{rows.length} people</Td>
                  <Td right>{grand.shifts}</Td>
                  <Td right>{grand.hours.toFixed(2)}</Td>
                  <Td right>${grand.cash_owed.toFixed(2)}</Td>
                  <Td right>${grand.credit_tips.toFixed(2)}</Td>
                  <Td right>${grand.bar_from_servers.toFixed(2)}</Td>
                  <Td right>${grand.lbw_sales.toFixed(2)}</Td>
                  <Td right>${grand.bar_tip_out.toFixed(2)}</Td>
                  <Td right>${grand.rb_tip_out.toFixed(2)}</Td>
                  <Td right>${grand.rb_received.toFixed(2)}</Td>
                  <Td right>${grand.takehome.toFixed(2)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      ({takePct(grand) === null ? "—" : `${takePct(grand)?.toFixed(1)}%`})
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
          .report-table {
            overflow: visible !important;
            border: none !important;
            border-radius: 0 !important;
          }
          .report-table table {
            width: 100% !important;
            table-layout: fixed;
            font-size: 8pt;
            border-collapse: collapse;
          }
          .report-table th, .report-table td {
            padding: 1px 3px !important;
            line-height: 1.2;
            word-break: break-word;
            overflow-wrap: anywhere;
          }
          .report-table thead { display: table-header-group; }
          .report-table tr { page-break-inside: avoid; break-inside: avoid; }
          main { max-width: none !important; padding: 0 !important; }
          main > * + * { margin-top: 0.12in !important; }
          section { border-radius: 0 !important; padding: 0.06in !important; }
          /* Individual slips: flow several per page instead of one page each */
          .slip {
            page-break-after: always;
            break-after: page;
            page-break-inside: avoid;
            break-inside: avoid;
            display: block;
            width: 100%;
            margin: 0;
            padding-bottom: 0;
            font-size: 10pt;
          }
          .slip:last-child { page-break-after: auto; break-after: auto; }
          .slip .py-1 { padding-top: 1px !important; padding-bottom: 1px !important; line-height: 1.35; }
          .slip-table { border-collapse: collapse; font-size: 8.5pt; }
          .slip-table th, .slip-table td { padding: 1px 3px !important; line-height: 1.3; white-space: nowrap; }
          .slip-table tr { page-break-inside: avoid; break-inside: avoid; }

        }
      `}</style>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-3 py-2 text-xs uppercase tracking-wide font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>;
}
function Td({ children, right, className }: { children: React.ReactNode; right?: boolean; className?: string }) {
  return <td className={`px-3 py-2 ${right ? "text-right tabular-nums" : ""} ${className ?? ""}`}>{children}</td>;
}
function csvEsc(s: string) {
  if (s == null) return "";
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
/** Show every position a person holds, not just their primary role. */
function roleLabel(s: Staff, positions: Record<string, string[]>) {
  const all = new Set<string>([s.role, ...(positions[s.id] ?? [])]);
  return Array.from(all).map((r) => r.replace("_", " ")).sort().join(", ");
}

