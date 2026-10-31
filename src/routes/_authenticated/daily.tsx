import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { printElement, printElementFromClick, printHtmlFromClick } from "@/lib/print";
import { useBrand, type Brand } from "@/lib/brand";
import { sendShiftTipReports, type SendShiftReportsResult } from "@/lib/sms.functions";
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


type DailySearch = { date?: string };

export const Route = createFileRoute("/_authenticated/daily")({
  head: () => ({ meta: [{ title: "Daily Report · Tip Share" }] }),
  validateSearch: (s: Record<string, unknown>): DailySearch => ({
    date: typeof s.date === "string" ? s.date : undefined,
  }),
  component: DailyReport,
});

type Staff = { id: string; name: string; server_number: string | null; role: string };
type ShiftRow = {
  id: string;
  shift_date: string;
  period: "AM" | "PM";
  notes: string | null;
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

type PersonDay = {
  staff_id: string;
  hours: number;
  cash_owed: number;
  credit_tips: number;
  from_servers: number;
  rb_received: number;
  lbw_sales: number;
  bar_out: number;
  rb_out: number;
  takehome: number;
};
const blankPerson = (staff_id: string): PersonDay => ({
  staff_id, hours: 0, cash_owed: 0, credit_tips: 0, from_servers: 0,
  rb_received: 0, lbw_sales: 0, bar_out: 0, rb_out: 0, takehome: 0,
});




function DailyReport() {
  const { date: dateParam } = Route.useSearch();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(dateParam ?? today);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [settings, setSettings] = useState<(Settings & { establishment_name?: string; logo_url?: string | null }) | null>(null);
  const brand = useBrand(settings?.logo_url);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("staff").select("id, name, server_number, role"),
      supabase.from("app_settings").select("*").limit(1).maybeSingle(),
    ]).then(([s, st]) => {
      setStaff((s.data ?? []) as Staff[]);
      setSettings(st.data as any);
    });
  }, []);

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    supabase
      .from("shifts")
      .select("id, shift_date, period, notes, shift_servers(staff_id, cash_owed, credit_tips, lbw_sales, bar_tip_override, rb_tip_override, split_mode, shift_server_members(staff_id, hours_worked)), shift_bartenders(staff_id, cash_owed, credit_tips, rb_tip_override, split_mode, shift_bartender_members(staff_id, hours_worked)), shift_support(staff_id, hours_worked, role), support_split_mode")
      .eq("shift_date", date)
      .order("period")
      .then(({ data }) => {
        setShifts((data ?? []) as unknown as ShiftRow[]);
        setLoading(false);
      });
  }, [date]);

  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);

  const am = shifts.find((s) => s.period === "AM");
  const pm = shifts.find((s) => s.period === "PM");

  const [printMode, setPrintMode] = useState<"all" | "slips">("all");
  const [printOnly, setPrintOnly] = useState<string | null>(null);

  const [pendingPrint, setPendingPrint] = useState(false);

  function runPrint(mode: "all" | "slips", staffId?: string | null) {
    if (mode === "all") {
      setPrintMode("all");
      setPrintOnly(null);
      printElementFromClick(mainRef.current, "Daily Report");
      return;
    }
    setPrintMode(mode);
    setPrintOnly(staffId ?? null);
    setPendingPrint(true);
  }

  const mainRef = useRef<HTMLElement>(null);
  const slipsRef = useRef<HTMLDivElement>(null);

  // Individual sheets print straight from the click (markup stays mounted, hidden).
  function printSlips() {
    const el = slipsRef.current;
    if (!el) return;
    printHtmlFromClick(el.innerHTML, "Daily Sheets");
  }

  // Print only after the slip markup has painted; keep it mounted until the
  // print dialog closes (afterprint).
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
        printElement(mainRef.current, "Daily Report");
        setTimeout(() => setPendingPrint(false), 1000);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.removeEventListener("afterprint", done);
    };
  }, [pendingPrint]);


  // Per-person totals for the whole day (AM + PM), used for individual print sheets.
  const personRows = useMemo(() => {
    if (!settings) return [] as PersonDay[];
    const map = new Map<string, PersonDay>();
    const bump = (id: string, patch: Partial<PersonDay>) => {
      const cur = map.get(id) ?? blankPerson(id);
      for (const k in patch) {
        if (k === "staff_id") continue;
        (cur as any)[k] += (patch as any)[k] ?? 0;
      }
      map.set(id, cur);
    };
    for (const sh of shifts) {
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
            bar_out: share.bar_tip, rb_out: share.rb_tip, takehome: share.takehome,
          });
        }
      }
      const serverBarTotal = sh.shift_servers.reduce((s, sv) => s + calcServer(sv, settings).bar_tip, 0);
      const btCount = Math.max(sh.shift_bartenders.length, 1);
      for (const bt of sh.shift_bartenders) {
        const collected = round2(serverBarTotal / btCount);
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
            from_servers: share.bar_from_servers, rb_out: share.rb_tip, takehome: share.takehome,
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
    }
    return Array.from(map.values())
      .sort((a, b) => (staffById.get(a.staff_id)?.name ?? "").localeCompare(staffById.get(b.staff_id)?.name ?? ""));
  }, [shifts, settings, staffById]);


  const label = new Date(date + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 bg-background border-b border-border z-10 print:hidden">
        <div className="max-w-4xl mx-auto p-4 flex items-center gap-3">
          <Link to="/" className="text-sm text-muted-foreground">← Home</Link>
          <h1 className="text-lg font-serif flex-1">Daily Report</h1>
        </div>
      </header>

      <main ref={mainRef} className="max-w-4xl mx-auto p-4 space-y-4 print:p-0 print:max-w-none">
        <section className="bg-card border border-border rounded-lg p-4 flex flex-wrap items-end gap-3 print:hidden">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3" />
          </div>
          <button onClick={() => runPrint("all")} className="h-11 px-6 rounded-md bg-primary text-primary-foreground font-medium">
            Print all
          </button>
        </section>

        <section className="bg-card border border-border rounded-lg p-4 flex flex-wrap items-end gap-3 print:hidden">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Print individually</label>
            <select
              value={printOnly ?? ""}
              onChange={(e) => setPrintOnly(e.target.value || null)}
              className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3"
            >
              <option value="">Everyone — one page per person</option>
              {personRows.map((p) => {
                const s = staffById.get(p.staff_id);
                return (
                  <option key={p.staff_id} value={p.staff_id}>
                    {s?.name ?? "—"}{s?.server_number ? ` (#${s.server_number})` : ""}
                  </option>
                );
              })}
            </select>
          </div>
          <button
            onClick={printSlips}
            disabled={personRows.length === 0}
            className="h-11 px-5 rounded-md border border-input font-medium disabled:opacity-50"
          >
            Print individual sheets
          </button>
        </section>


        <div
          className="print:block hidden mb-4 text-center pb-2"
          style={{ borderBottom: `2px solid ${brand.primary}` }}
        >
          {brand.logoUrl && (
            <img src={brand.logoUrl} alt="" className="mx-auto mb-1 h-14 object-contain" />
          )}
          <div className="text-xl font-serif" style={{ color: brand.primary }}>
            {settings?.establishment_name ?? "Tip Share"}
          </div>
          <div className="text-sm" style={{ color: brand.accent }}>Daily Report — {label}</div>
        </div>
        <div className="text-lg font-serif print:hidden">{label}</div>

        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {!loading && !am && !pm && (
          <p className="text-sm text-muted-foreground">No shifts recorded for this date.</p>
        )}

        <div ref={slipsRef} className="hidden" aria-hidden="true">
          <div>
            {personRows
              .filter((p) => !printOnly || p.staff_id === printOnly)
              .map((p) => {
                const s = staffById.get(p.staff_id);
                const tips = p.credit_tips + p.from_servers + p.rb_received;
                const pct = tips > 0 ? (p.takehome / tips) * 100 : null;
                const line = (l: string, v: string) => (
                  <div key={l} className="flex justify-between border-b border-black/20 py-1">
                    <span>{l}</span><span className="tabular-nums font-medium">{v}</span>
                  </div>
                );
                return (
                  <div key={p.staff_id} className="slip text-sm">
                    <div
                      className="flex items-center gap-2 pb-1 mb-2"
                      style={{ borderBottom: `2px solid ${brand.primary}` }}
                    >
                      {brand.logoUrl && <img src={brand.logoUrl} alt="" className="h-8 object-contain" />}
                      <div className="flex-1">
                        <div className="text-lg font-serif" style={{ color: brand.primary }}>{s?.name ?? "—"}</div>
                        <div className="text-xs" style={{ color: brand.accent }}>
                          {settings?.establishment_name ? `${settings.establishment_name} · ` : ""}
                          {s?.server_number ? `#${s.server_number} · ` : ""}{(s?.role ?? "").replace("_", " ")} · {label}
                        </div>
                      </div>
                    </div>
                    {p.hours > 0 && line("Hours", p.hours.toFixed(2))}
                    {line("Cash owed (turned in)", `$${p.cash_owed.toFixed(2)}`)}
                    {line("Credit card tips", `$${p.credit_tips.toFixed(2)}`)}
                    {line("Tips from servers", `$${p.from_servers.toFixed(2)}`)}
                    {line("R/B received", `$${p.rb_received.toFixed(2)}`)}
                    {line("LBW sales", `$${p.lbw_sales.toFixed(2)}`)}
                    {line("Bar tip out", `-$${p.bar_out.toFixed(2)}`)}
                    {line("R/B tip out", `-$${p.rb_out.toFixed(2)}`)}
                    <div
                      className="flex justify-between mt-2 px-1 py-1 font-semibold"
                      style={{ background: brand.soft, color: brand.primary }}
                    >
                      <span>Take-home</span>
                      <span className="tabular-nums">${p.takehome.toFixed(2)} ({pct === null ? "—" : `${pct.toFixed(1)}%`})</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        <div className={`space-y-4 ${printMode === "slips" ? "print:hidden" : ""}`}>
        {!loading && am && settings && (
          <ShiftBlock shift={am} settings={settings} staffById={staffById} brand={brand} />
        )}
        {!loading && pm && settings && (
          <ShiftBlock shift={pm} settings={settings} staffById={staffById} brand={brand} />
        )}


        {!loading && (am || pm) && settings && (() => {
          const totals = (sh: ShiftRow | undefined) => {
            if (!sh) return {
              serverCash: 0, barCash: 0, cash: 0, credit: 0, lbw: 0,
              takehome: 0, barOut: 0, rbOut: 0, supportPool: 0, fromServers: 0,
            };
            const serverCash = sh.shift_servers.reduce((s, x) => s + Number(x.cash_owed ?? 0), 0);
            const barCash = sh.shift_bartenders.reduce((s, x) => s + Number(x.cash_owed ?? 0), 0);
            const credit = sh.shift_servers.reduce((s, x) => s + Number(x.credit_tips ?? 0), 0) +
              sh.shift_bartenders.reduce((s, x) => s + Number(x.credit_tips ?? 0), 0);
            const lbw = sh.shift_servers.reduce((s, x) => s + Number(x.lbw_sales ?? 0), 0);
            const serverCalcs = sh.shift_servers.map((sv) => calcServer(sv, settings));
            const serverBarTotal = serverCalcs.reduce((s, c) => s + c.bar_tip, 0);
            const barOut = serverBarTotal;
            const rbOutServer = serverCalcs.reduce((s, c) => s + c.rb_tip, 0);
            const btCount = Math.max(sh.shift_bartenders.length, 1);
            const bartenderCalcs = sh.shift_bartenders.map((bt) => calcBartender(bt, round2(serverBarTotal / btCount), settings));
            const rbOutBar = bartenderCalcs.reduce((s, c) => s + c.rb_tip, 0);
            const rbOut = rbOutServer + rbOutBar;
            const fromServers = sh.shift_bartenders.length > 0 ? serverBarTotal : 0;
            const pool = poolFromShift(sh.shift_servers, sh.shift_bartenders, settings);
            const supportRows = sh.shift_support.map((sp) => ({
              staff_id: sp.staff_id,
              role: resolveSupportRole(sp.role, staffById.get(sp.staff_id)?.role),
              hours_worked: sp.hours_worked,
            }));
            const payouts = calcSupportPool(supportRows, pool, settings, (sh.support_split_mode === "shared" ? "shared" : "weighted"));
            const supportPool = payouts.reduce((s, p) => s + p.payout, 0);
            const takehome =
              serverCalcs.reduce((s, c) => s + c.takehome, 0) +
              bartenderCalcs.reduce((s, c) => s + c.takehome, 0) +
              supportPool;
            return { serverCash, barCash, cash: serverCash + barCash, credit, lbw, takehome, barOut, rbOut, supportPool, fromServers };
          };
          const a = totals(am);
          const p = totals(pm);
          const day = {
            serverCash: a.serverCash + p.serverCash,
            barCash: a.barCash + p.barCash,
            cash: a.cash + p.cash,
            credit: a.credit + p.credit,
            lbw: a.lbw + p.lbw,
            takehome: a.takehome + p.takehome,
            barOut: a.barOut + p.barOut,
            rbOut: a.rbOut + p.rbOut,
            supportPool: a.supportPool + p.supportPool,
            fromServers: a.fromServers + p.fromServers,
          };
          const Row = ({ label, av, pv, dv, total }: { label: string; av: number; pv: number; dv: number; total?: boolean }) => (
            <div className={`flex justify-between text-sm ${total ? "pt-2 border-t border-border font-medium" : ""}`}>
              <span className={total ? "" : "text-muted-foreground"}>{label}</span>
              <span className={`tabular-nums ${total ? "font-serif text-lg" : "font-medium"}`}>
                {am && <>AM ${av.toFixed(2)}</>}
                {am && pm && <span className="mx-2 text-muted-foreground">·</span>}
                {pm && <>PM ${pv.toFixed(2)}</>}
                <span className="ml-3 font-semibold">Day ${dv.toFixed(2)}</span>
              </span>
            </div>
          );
          return (
            <section className="shift-block bg-card border border-border rounded-lg overflow-hidden print:border-black">
              <div className="px-4 py-3 border-b border-border bg-secondary/40 print:bg-white">
                <h2 className="text-base font-serif">Day Totals</h2>
              </div>
              <div className="p-4 space-y-2">
                <Row label="Server cash owed" av={a.serverCash} pv={p.serverCash} dv={day.serverCash} />
                <Row label="Bartender cash owed" av={a.barCash} pv={p.barCash} dv={day.barCash} />
                <Row label="Cash deposit (house)" av={a.cash} pv={p.cash} dv={day.cash} />
                <Row label="Credit card tips" av={a.credit} pv={p.credit} dv={day.credit} />
                <Row label="LBW sales" av={a.lbw} pv={p.lbw} dv={day.lbw} />
                <div className="my-2 border-t border-dashed border-border" />
                <Row label="Bar tip-out (servers → bartenders)" av={a.barOut} pv={p.barOut} dv={day.barOut} />
                <Row label="R/B tip-out (servers + bartenders)" av={a.rbOut} pv={p.rbOut} dv={day.rbOut} />
                <Row label="Support pool paid out" av={a.supportPool} pv={p.supportPool} dv={day.supportPool} />
                <Row label="Bartender tips from servers" av={a.fromServers} pv={p.fromServers} dv={day.fromServers} />
                <div className="my-2 border-t border-dashed border-border" />
                <div className="flex justify-between text-sm pt-2 border-t border-border font-medium">
                  <span>Total cash deposit (house)</span>
                  <span className="tabular-nums font-serif text-lg">${day.cash.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span>Total take-home paid out (cashouts)</span>
                  <span className="tabular-nums font-serif text-lg">${day.takehome.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-border">
                  <span>Net house cash (deposit − cashouts)</span>
                  <span className={`tabular-nums font-medium ${day.cash - day.takehome >= 0 ? "text-green-600" : "text-destructive"}`}>${(day.cash - day.takehome).toFixed(2)}</span>
                </div>
                <Row label="Take-home total" av={a.takehome} pv={p.takehome} dv={day.takehome} total />
              </div>
            </section>
          );
        })()}

        </div>

      </main>

      <style>{`
        @media print {
          @page { size: portrait; margin: 0.25in; }
          html, body { background: white !important; font-size: 9pt; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          main { max-width: none !important; padding: 0 !important; }
          main > * + * { margin-top: 0.12in !important; }
          .shift-block { overflow: visible !important; border-radius: 0 !important; }
          .shift-block table { width: 100% !important; table-layout: fixed; font-size: 8pt; border-collapse: collapse; }
          .shift-block th, .shift-block td { padding: 1px 3px !important; line-height: 1.2; overflow-wrap: anywhere; }
          .shift-block > div { padding: 0.06in !important; }
          .shift-block { page-break-inside: avoid; break-inside: avoid; }
          /* Let shifts flow onto the same page when they fit */
          .shift-block + .shift-block { page-break-before: auto; margin-top: 0.14in !important; }
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

        }
      `}</style>
    </div>
  );
}

function SendTexts({ shiftId }: { shiftId: string }) {
  const send = useServerFn(sendShiftTipReports);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<SendShiftReportsResult | null>(null);

  async function go() {
    setBusy(true);
    setRes(null);
    try {
      setRes(await send({ data: { shift_id: shiftId } }));
    } catch (e) {
      setRes({
        configured: false, sent: 0, skipped: 0, failed: 0, results: [],
        error: e instanceof Error ? e.message : "Could not send texts.",
      });
    } finally {
      setBusy(false);
    }
  }

  const problems = res?.results.filter((r) => r.status !== "sent") ?? [];

  return (
    <div className="px-4 py-3 border-b border-border print:hidden space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={go}
          disabled={busy}
          className="h-11 px-5 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-60"
        >
          {busy ? "Sending…" : "Text tip reports"}
        </button>
        {res && !res.error && (
          <span className="text-sm text-muted-foreground">
            {res.sent} sent{res.skipped ? ` · ${res.skipped} skipped` : ""}{res.failed ? ` · ${res.failed} failed` : ""}
          </span>
        )}
      </div>
      {res?.error && <p className="text-sm text-destructive">{res.error}</p>}
      {problems.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-1">
          {problems.map((p) => (
            <li key={p.staff_id}>
              {p.name} — {p.status}{p.detail ? `: ${p.detail}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ShiftBlock({
  shift,
  settings,
  staffById,
  brand,
}: {
  shift: ShiftRow;
  settings: Settings & { sms_enabled?: boolean };
  staffById: Map<string, Staff>;
  brand: Brand;
}) {
  const periodLabel = shift.period === "AM" ? "AM (Lunch)" : "PM (Dinner)";


  const serverBarTotal = shift.shift_servers.reduce((s, sv) => s + calcServer(sv, settings).bar_tip, 0);
  const bartenderCount = Math.max(shift.shift_bartenders.length, 1);
  const pool = poolFromShift(shift.shift_servers, shift.shift_bartenders, settings);
  const supportRows = shift.shift_support.map((sp) => ({
    staff_id: sp.staff_id,
    role: resolveSupportRole(sp.role, staffById.get(sp.staff_id)?.role),
    hours_worked: sp.hours_worked,
  }));
  const payouts = calcSupportPool(supportRows, pool, settings, (shift.support_split_mode === "shared" ? "shared" : "weighted"));

  const serverCash = shift.shift_servers.reduce((s, x) => s + Number(x.cash_owed ?? 0), 0);
  const barCash = shift.shift_bartenders.reduce((s, x) => s + Number(x.cash_owed ?? 0), 0);
  const totalCash = serverCash + barCash;
  const totalCredit = shift.shift_servers.reduce((s, x) => s + Number(x.credit_tips ?? 0), 0)
    + shift.shift_bartenders.reduce((s, x) => s + Number(x.credit_tips ?? 0), 0);
  const totalSales = shift.shift_servers.reduce((s, x) => s + Number(x.lbw_sales ?? 0), 0);
  const totalTakehome =
    shift.shift_servers.reduce((s, sv) => s + calcServer(sv, settings).takehome, 0)
    + shift.shift_bartenders.reduce((s, bt) => s + calcBartender(bt, round2(serverBarTotal / bartenderCount), settings).takehome, 0)
    + payouts.reduce((s, p) => s + p.payout, 0);

  return (
    <section className="shift-block bg-card border border-border rounded-lg overflow-hidden print:border-black">
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border"
        style={{ background: brand.soft, borderBottomColor: brand.primary }}
      >
        <div className="flex items-center gap-3">
          <span
            className="text-xs px-2 py-1 rounded font-medium"
            style={{ background: brand.primary, color: brand.onPrimary }}
          >
            {shift.period}
          </span>
          <h2 className="text-base font-serif" style={{ color: brand.primary }}>{periodLabel}</h2>
        </div>
        <div className="text-xs" style={{ color: brand.accent }}>Take-Home Total: <span className="font-semibold">${totalTakehome.toFixed(2)}</span></div>
      </div>

      {settings.sms_enabled && <SendTexts shiftId={shift.id} />}

      {shift.shift_servers.length > 0 && (
        <div className="overflow-x-auto">
          <div className="px-4 pt-3 text-xs uppercase tracking-wide text-muted-foreground">Servers</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground">
                <Th>Name</Th><Th>#</Th>
                <Th right>Cash Owed</Th><Th right>Credit Tips</Th><Th right>LBW Sales</Th>
                <Th right>Bar Out</Th><Th right>R/B Out</Th><Th right>Take-Home</Th>
              </tr>
            </thead>
            <tbody>
              {shift.shift_servers.flatMap((sv, i) => {
                const c = calcServer(sv, settings);
                const shares = splitServerShares(
                  sv,
                  { bar_tip: c.bar_tip, rb_tip: c.rb_tip, takehome: c.takehome },
                  sv.split_mode ?? "single",
                  sv.shift_server_members ?? [],
                );
                const shared = (sv.split_mode ?? "single") !== "single";
                return shares.map((share, j) => {
                  const s = staffById.get(share.staff_id);
                  return (
                    <tr key={`${i}-${j}`} className="border-t border-border">
                      <Td>{s?.name ?? "—"}{shared ? " (split party)" : ""}</Td>
                      <Td className="text-muted-foreground">{s?.server_number ?? "—"}</Td>
                      <Td right>${share.cash_owed.toFixed(2)}</Td>
                      <Td right>${share.credit_tips.toFixed(2)}</Td>
                      <Td right>${share.lbw_sales.toFixed(2)}</Td>
                      <Td right>${share.bar_tip.toFixed(2)}</Td>
                      <Td right>${share.rb_tip.toFixed(2)}</Td>
                      <Td right className="font-semibold">${share.takehome.toFixed(2)}</Td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      )}

      {shift.shift_bartenders.length > 0 && (
        <div className="overflow-x-auto">
          <div className="px-4 pt-3 text-xs uppercase tracking-wide text-muted-foreground">Bartenders</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground">
                <Th>Name</Th><Th>#</Th>
                <Th right>Hours</Th>
                <Th right>Cash Owed</Th><Th right>Credit Tips</Th>
                <Th right>From Servers</Th><Th right>R/B Out</Th><Th right>Take-Home</Th>
              </tr>
            </thead>
            <tbody>
              {shift.shift_bartenders.flatMap((bt, bi) => {
                const collected = round2(serverBarTotal / bartenderCount);
                const c = calcBartender(bt, collected, settings);
                const shares = splitBartenderShares(bt, { rb_tip: c.rb_tip, takehome: c.takehome, collected_from_servers: collected }, bt.split_mode ?? "single", bt.shift_bartender_members ?? []);
                const shared = (bt.split_mode ?? "single") !== "single";
                return shares.map((sh, si) => {
                  const s = staffById.get(sh.staff_id);
                  return (
                    <tr key={`${bi}-${sh.staff_id}`} className="border-t border-border">
                      <Td>
                        {s?.name ?? "—"}
                        {shared && si === 0 && <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">shared</span>}
                      </Td>
                      <Td className="text-muted-foreground">{s?.server_number ?? "—"}</Td>
                      <Td right className="text-muted-foreground">{shared && bt.split_mode === "hours" ? sh.hours_worked.toFixed(2) : "—"}</Td>
                      <Td right>${sh.cash_owed.toFixed(2)}</Td>
                      <Td right>${sh.credit_tips.toFixed(2)}</Td>
                      <Td right>${sh.bar_from_servers.toFixed(2)}</Td>
                      <Td right>${sh.rb_tip.toFixed(2)}</Td>
                      <Td right className="font-semibold">${sh.takehome.toFixed(2)}</Td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>

        </div>
      )}

      {shift.shift_support.length > 0 && (
        <div className="overflow-x-auto">
          <div className="px-4 pt-3 text-xs uppercase tracking-wide text-muted-foreground">Support (Pool ${pool.toFixed(2)})</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground">
                <Th>Name</Th><Th>Role</Th><Th right>Hours</Th><Th right>Payout</Th>
              </tr>
            </thead>
            <tbody>
              {shift.shift_support.map((sp) => {
                const s = staffById.get(sp.staff_id);
                const payout = payouts.find((p) => p.staff_id === sp.staff_id)?.payout ?? 0;
                return (
                  <tr key={sp.staff_id} className="border-t border-border">
                    <Td>{s?.name ?? "—"}</Td>
                    <Td className="text-muted-foreground capitalize">{(s?.role ?? "").replace("_", " ")}</Td>
                    <Td right>{sp.hours_worked.toFixed(2)}</Td>
                    <Td right className="font-semibold">${payout.toFixed(2)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 border-t border-border text-sm">
        <Stat label="Server Cash Owed" value={`$${serverCash.toFixed(2)}`} />
        <Stat label="Bartender Cash Owed" value={`$${barCash.toFixed(2)}`} />
        <Stat label="Cash Deposit (Shift)" value={`$${totalCash.toFixed(2)}`} />
        <Stat label="Total Credit Tips" value={`$${totalCredit.toFixed(2)}`} />
        <Stat label="LBW Sales" value={`$${totalSales.toFixed(2)}`} />
        <Stat label="Take-Home Total" value={`$${totalTakehome.toFixed(2)}`} />
      </div>

      {shift.notes && (
        <div className="px-4 pb-4 text-sm">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Notes</div>
          <div className="mt-1 whitespace-pre-wrap">{shift.notes}</div>
        </div>
      )}
    </section>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-3 py-2 text-xs uppercase tracking-wide font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>;
}
function Td({ children, right, className }: { children: React.ReactNode; right?: boolean; className?: string }) {
  return <td className={`px-3 py-2 ${right ? "text-right tabular-nums" : ""} ${className ?? ""}`}>{children}</td>;
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  );
}
