import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
} from "@/lib/calculations";

export const Route = createFileRoute("/_authenticated/trends")({
  head: () => ({
    meta: [
      { title: "Tip Trends · Tip Share" },
      { name: "description", content: "See historical tips by week or month and whether each person is trending up or down." },
      { property: "og:title", content: "Tip Trends · Tip Share" },
      { property: "og:description", content: "Week-over-week and month-over-month tip trends for your staff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrendsPage,
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
  shift_support: { staff_id: string; hours_worked: number }[];
};

type Bucket = "week" | "month";

/** Monday-start week key, e.g. 2026-07-27 */
function weekKey(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}
function monthKey(dateStr: string) {
  return dateStr.slice(0, 7);
}
function bucketLabel(key: string, bucket: Bucket) {
  if (bucket === "month") {
    const d = new Date(key + "-01T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  }
  const d = new Date(key + "T00:00:00");
  return `Wk of ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function TrendsPage() {
  const [bucket, setBucket] = useState<Bucket>("week");
  const [periods, setPeriods] = useState(8);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>("");

  const from = useMemo(() => {
    const d = new Date();
    if (bucket === "week") d.setDate(d.getDate() - 7 * periods);
    else d.setMonth(d.getMonth() - periods);
    return d.toISOString().slice(0, 10);
  }, [bucket, periods]);
  const to = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    Promise.all([
      supabase.from("staff").select("id, name, server_number, role"),
      supabase.from("app_settings").select("*").limit(1).maybeSingle(),
    ]).then(([s, st]) => {
      setStaff((s.data ?? []) as Staff[]);
      setSettings(st.data as Settings | null);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("shifts")
      .select("id, shift_date, period, shift_servers(staff_id, cash_owed, credit_tips, lbw_sales, bar_tip_override, rb_tip_override, split_mode, shift_server_members(staff_id, hours_worked)), shift_bartenders(staff_id, cash_owed, credit_tips, rb_tip_override, split_mode, shift_bartender_members(staff_id, hours_worked)), shift_support(staff_id, hours_worked), support_split_mode")
      .gte("shift_date", from)
      .lte("shift_date", to)
      .order("shift_date")
      .then(({ data }) => {
        setShifts((data ?? []) as unknown as ShiftRow[]);
        setLoading(false);
      });
  }, [from, to]);

  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);

  /** staff_id -> bucketKey -> { takehome, shifts } */
  const series = useMemo(() => {
    const map = new Map<string, Map<string, { takehome: number; shifts: number }>>();
    const keys = new Set<string>();
    if (!settings) return { map, keys: [] as string[] };
    const bump = (id: string, key: string, takehome: number) => {
      const byKey = map.get(id) ?? new Map();
      const cur = byKey.get(key) ?? { takehome: 0, shifts: 0 };
      cur.takehome += takehome;
      byKey.set(key, cur);
      map.set(id, byKey);
    };
    const markShift = (id: string, key: string) => {
      const cur = map.get(id)?.get(key);
      if (cur) cur.shifts += 1;
    };

    for (const sh of shifts) {
      const key = bucket === "week" ? weekKey(sh.shift_date) : monthKey(sh.shift_date);
      keys.add(key);
      const seen = new Set<string>();

      for (const sv of sh.shift_servers) {
        const c = calcServer(sv, settings);
        const shares = splitServerShares(
          sv,
          { bar_tip: c.bar_tip, rb_tip: c.rb_tip, takehome: c.takehome },
          sv.split_mode ?? "single",
          sv.shift_server_members ?? [],
        );
        for (const share of shares) {
          bump(share.staff_id, key, share.takehome);
          seen.add(share.staff_id);
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
          bump(share.staff_id, key, share.takehome);
          seen.add(share.staff_id);
        }
      }

      const pool = poolFromShift(sh.shift_servers, sh.shift_bartenders, settings);
      const supportRows = sh.shift_support.map((sp) => ({
        staff_id: sp.staff_id,
        role: (staffById.get(sp.staff_id)?.role ?? "runner") as SupportRole,
        hours_worked: sp.hours_worked,
      }));
      const payouts = calcSupportPool(supportRows, pool, settings, (sh.support_split_mode === "shared" ? "shared" : "weighted"));
      for (const sp of sh.shift_support) {
        const payout = payouts.find((p) => p.staff_id === sp.staff_id)?.payout ?? 0;
        bump(sp.staff_id, key, payout);
        seen.add(sp.staff_id);
      }

      for (const id of seen) markShift(id, key);
    }
    return { map, keys: Array.from(keys).sort() };
  }, [shifts, settings, staffById, bucket]);

  const bucketKeys = series.keys;
  const lastKey = bucketKeys[bucketKeys.length - 1];
  const prevKey = bucketKeys[bucketKeys.length - 2];

  const rows = useMemo(() => {
    return Array.from(series.map.entries())
      .map(([id, byKey]) => {
        const cur = byKey.get(lastKey ?? "")?.takehome ?? 0;
        const prev = byKey.get(prevKey ?? "")?.takehome ?? 0;
        const delta = round2(cur - prev);
        const pct = prev > 0 ? (delta / prev) * 100 : null;
        return { staff: staffById.get(id), byKey, cur, prev, delta, pct };
      })
      .filter((r) => r.staff)
      .sort((a, b) => b.cur - a.cur);
  }, [series, staffById, lastKey, prevKey]);

  const houseTotals = useMemo(
    () =>
      bucketKeys.map((k) => ({
        key: k,
        total: round2(rows.reduce((s, r) => s + (r.byKey.get(k)?.takehome ?? 0), 0)),
      })),
    [bucketKeys, rows],
  );
  const maxHouse = Math.max(1, ...houseTotals.map((h) => h.total));

  const detail = rows.find((r) => r.staff!.id === selected);
  const detailPoints = detail ? bucketKeys.map((k) => detail.byKey.get(k)?.takehome ?? 0) : [];
  const detailMax = Math.max(1, ...detailPoints);

  const label = bucket === "week" ? "week over week" : "month over month";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 bg-background border-b border-border z-10">
        <div className="max-w-5xl mx-auto p-4 flex items-center gap-3">
          <Link to="/" className="text-sm text-muted-foreground">← Home</Link>
          <h1 className="text-lg font-serif flex-1">Tip Trends</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 space-y-4">
        <section className="flex flex-wrap items-center gap-2">
          {(["week", "month"] as const).map((b) => (
            <button
              key={b}
              onClick={() => { setBucket(b); setSelected(""); }}
              className={`h-9 px-3 rounded-md text-sm border ${bucket === b ? "bg-primary text-primary-foreground border-transparent" : "border-input"}`}
            >
              {b === "week" ? "Weekly" : "Monthly"}
            </button>
          ))}
          <select
            value={periods}
            onChange={(e) => setPeriods(Number(e.target.value))}
            className="h-9 px-2 rounded-md border border-input bg-background text-sm"
          >
            {[4, 8, 12, 26].map((n) => (
              <option key={n} value={n}>Last {n} {bucket === "week" ? "weeks" : "months"}</option>
            ))}
          </select>
        </section>

        <section className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-medium mb-3">Total take-home by {bucket}</h2>
          {houseTotals.length === 0 && <p className="text-sm text-muted-foreground">No shifts yet in this range.</p>}
          <div className="flex items-end gap-2 h-32">
            {houseTotals.map((h) => (
              <div key={h.key} className="flex-1 min-w-0 flex flex-col items-center justify-end gap-1">
                <span className="text-[10px] tabular-nums text-muted-foreground">${h.total.toFixed(0)}</span>
                <div className="w-full rounded-t bg-primary/70" style={{ height: `${(h.total / maxHouse) * 90}%` }} />
                <span className="text-[10px] text-muted-foreground truncate w-full text-center">{bucketLabel(h.key, bucket)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-card border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>
                <Th>Name</Th><Th>#</Th>
                <Th right>Shifts ({bucket === "week" ? "this wk" : "this mo"})</Th>
                <Th right>Latest</Th>
                <Th right>Previous</Th>
                <Th right>Change</Th>
                <Th>Trend</Th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="text-center p-8 text-muted-foreground">Loading…</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={7} className="text-center p-8 text-muted-foreground">No tip history in this range.</td></tr>
              )}
              {rows.map((r) => {
                const up = r.delta > 0.005;
                const down = r.delta < -0.005;
                return (
                  <tr
                    key={r.staff!.id}
                    onClick={() => setSelected(selected === r.staff!.id ? "" : r.staff!.id)}
                    className={`border-t border-border cursor-pointer hover:bg-secondary/40 ${selected === r.staff!.id ? "bg-secondary/50" : ""}`}
                  >
                    <Td>{r.staff!.name}</Td>
                    <Td className="text-muted-foreground">{r.staff!.server_number ?? "—"}</Td>
                    <Td right>{r.byKey.get(lastKey ?? "")?.shifts ?? 0}</Td>
                    <Td right>${r.cur.toFixed(2)}</Td>
                    <Td right className="text-muted-foreground">${r.prev.toFixed(2)}</Td>
                    <Td right className={up ? "text-emerald-600 font-medium" : down ? "text-destructive font-medium" : "text-muted-foreground"}>
                      {up ? "▲" : down ? "▼" : "–"} ${Math.abs(r.delta).toFixed(2)}
                      {r.pct !== null && (up || down) ? ` (${r.pct > 0 ? "+" : ""}${r.pct.toFixed(0)}%)` : ""}
                    </Td>
                    <Td>
                      <Spark values={bucketKeys.map((k) => r.byKey.get(k)?.takehome ?? 0)} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <p className="text-xs text-muted-foreground">
          Change compares the two most recent {bucket === "week" ? "weeks" : "months"} with data ({label}). Tap a row for their full history.
        </p>

        {detail && (
          <section className="bg-card border border-border rounded-lg p-4">
            <h2 className="text-sm font-medium mb-3">{detail.staff!.name} — take-home history</h2>
            <div className="flex items-end gap-2 h-32">
              {bucketKeys.map((k, i) => (
                <div key={k} className="flex-1 min-w-0 flex flex-col items-center justify-end gap-1">
                  <span className="text-[10px] tabular-nums text-muted-foreground">${detailPoints[i].toFixed(0)}</span>
                  <div className="w-full rounded-t bg-emerald-500/70" style={{ height: `${(detailPoints[i] / detailMax) * 90}%` }} />
                  <span className="text-[10px] text-muted-foreground truncate w-full text-center">{bucketLabel(k, bucket)}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Spark({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <span className="inline-flex items-end gap-[2px] h-6">
      {values.map((v, i) => (
        <span key={i} className="w-[4px] rounded-sm bg-primary/60" style={{ height: `${Math.max(6, (v / max) * 100)}%` }} />
      ))}
    </span>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-3 py-2 text-xs uppercase tracking-wide font-medium whitespace-nowrap ${right ? "text-right" : "text-left"}`}>{children}</th>;
}
function Td({ children, right, className }: { children: React.ReactNode; right?: boolean; className?: string }) {
  return <td className={`px-3 py-2 whitespace-nowrap ${right ? "text-right tabular-nums" : ""} ${className ?? ""}`}>{children}</td>;
}
