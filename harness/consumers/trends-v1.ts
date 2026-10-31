// CHARACTERIZATION COPY of the Trends math in src/routes/_authenticated/trends.tsx
// (weekKey/monthKey 50–58, series 115–184, rows 190–202, houseTotals 204–212).
// React removed; logic transcribed line for line. Never fix anything here.
// NOTE: weekKey mixes local-time Date math with UTC toISOString, so results depend on the
// process time zone. characterize.test.ts runs with TZ=UTC.
import {
  calcBartender,
  calcServer,
  calcSupportPool,
  poolFromShift,
  round2,
  splitBartenderShares,
  splitServerShares,
  type SupportRole,
} from "../../src/engine/calculations.ts";

type Bucket = "week" | "month";
export function weekKey(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}
export function monthKey(dateStr: string) {
  return dateStr.slice(0, 7);
}

export function series(shifts: any[], settings: any, staffById: Map<string, any>, bucket: Bucket) {
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
    const serverBarTotal = sh.shift_servers.reduce(
      (s: number, sv: any) => s + calcServer(sv, settings).bar_tip,
      0,
    );
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
    const supportRows = sh.shift_support.map((sp: any) => ({
      staff_id: sp.staff_id,
      role: (staffById.get(sp.staff_id)?.role ?? "runner") as SupportRole,
      hours_worked: sp.hours_worked,
    }));
    const payouts = calcSupportPool(
      supportRows,
      pool,
      settings,
      sh.support_split_mode === "shared" ? "shared" : "weighted",
    );
    for (const sp of sh.shift_support) {
      const payout = payouts.find((p) => p.staff_id === sp.staff_id)?.payout ?? 0;
      bump(sp.staff_id, key, payout);
      seen.add(sp.staff_id);
    }
    for (const id of seen) markShift(id, key);
  }
  return { map, keys: Array.from(keys).sort() };
}

export function trendRows(s: ReturnType<typeof series>, staffById: Map<string, any>) {
  const bucketKeys = s.keys;
  const lastKey = bucketKeys[bucketKeys.length - 1];
  const prevKey = bucketKeys[bucketKeys.length - 2];
  const rows = Array.from(s.map.entries())
    .map(([id, byKey]) => {
      const cur = byKey.get(lastKey ?? "")?.takehome ?? 0;
      const prev = byKey.get(prevKey ?? "")?.takehome ?? 0;
      const delta = round2(cur - prev);
      const pct = prev > 0 ? (delta / prev) * 100 : null;
      return { staff: staffById.get(id), id, byKey, cur, prev, delta, pct };
    })
    .filter((r) => r.staff)
    .sort((a, b) => b.cur - a.cur);
  const houseTotals = bucketKeys.map((k) => ({
    key: k,
    total: round2(rows.reduce((sum, r) => sum + (r.byKey.get(k)?.takehome ?? 0), 0)),
  }));
  return { rows, houseTotals };
}
