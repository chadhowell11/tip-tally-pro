import { createFileRoute, Link, useNavigate, useBlocker } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  calcServer,
  calcBartender,
  calcSupportPool,
  poolFromShift,
  splitBartenderShares,
  splitServerShares,
  type BartenderSplitMode,
  type Settings,
  type SupportRole,
  type SupportSplitMode,
} from "@/lib/calculations";


type NewShiftSearch = { date?: string; period?: "AM" | "PM" };

export const Route = createFileRoute("/_authenticated/shift/new")({
  head: () => ({ meta: [{ title: "New Shift · Tip Share" }] }),
  validateSearch: (search: Record<string, unknown>): NewShiftSearch => ({
    date: typeof search.date === "string" ? search.date : undefined,
    period: search.period === "AM" || search.period === "PM" ? search.period : undefined,
  }),
  component: NewShiftRoute,
});

function NewShiftRoute() {
  const { date, period } = Route.useSearch();
  return <ShiftForm key={`${date ?? ""}-${period ?? ""}`} prefillDate={date} prefillPeriod={period} />;
}

type Staff = { id: string; name: string; server_number: string | null; role: string; positions: string[] };

type BartenderMemberInput = { staff_id: string; hours_worked: string };
type ServerEntry = {
  staff_id: string;
  cash_owed: string;
  credit_tips: string;
  lbw_sales: string;
  total_sales: string;
  bar_tip_override: string;
  rb_tip_override: string;
  split_mode: BartenderSplitMode;
  members: BartenderMemberInput[];
};
type BartenderEntry = {
  staff_id: string;
  cash_owed: string;
  credit_tips: string;
  total_sales: string;
  rb_tip_override: string;
  split_mode: BartenderSplitMode;
  members: BartenderMemberInput[];
};

type SupportEntry = { staff_id: string; role: SupportRole | ""; hours_worked: string };


const SUPPORT_ROLES: SupportRole[] = ["runner", "busser", "bar_back", "hostess"];
const fmt = (n: number) => `$${n.toFixed(2)}`;
const pct = (take: number, total: number) => (total > 0 ? `${((take / total) * 100).toFixed(1)}% of tips` : "—");


export function ShiftForm({ initialShiftId, prefillDate, prefillPeriod }: { initialShiftId?: string; prefillDate?: string; prefillPeriod?: "AM" | "PM" } = {}) {

  const navigate = useNavigate();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [date, setDate] = useState(() => prefillDate ?? new Date().toISOString().slice(0, 10));
  const [period, setPeriod] = useState<"AM" | "PM">(prefillPeriod ?? "PM");
  const [notes, setNotes] = useState("");
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [bartenders, setBartenders] = useState<BartenderEntry[]>([]);
  const [support, setSupport] = useState<SupportEntry[]>([]);
  const [supportSplit, setSupportSplit] = useState<SupportSplitMode>("weighted");
  const [saving, setSaving] = useState(false);
  const [switchingPeriod, setSwitchingPeriod] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [dayPeriods, setDayPeriods] = useState<{ AM: boolean; PM: boolean }>({ AM: false, PM: false });
  const [moveBusy, setMoveBusy] = useState(false);
  const [moveErr, setMoveErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const [locationId, setLocationId] = useState<string | null>(null);
  const [amCash, setAmCash] = useState(0);
  const [amCashLoaded, setAmCashLoaded] = useState(false);
  const [amCashNonce, setAmCashNonce] = useState(0);

  // Keep the AM subtotal fresh: refetch whenever this tab regains focus.
  useEffect(() => {
    const bump = () => setAmCashNonce((n) => n + 1);
    const onVis = () => { if (document.visibilityState === "visible") bump(); };
    window.addEventListener("focus", bump);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", bump);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    if (period !== "PM" || !date || !locationId) {
      setAmCash(0);
      setAmCashLoaded(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setAmCashLoaded(false);
      const { data: am, error: shiftError } = await supabase
        .from("shifts")
        .select("id")
        .eq("shift_date", date)
        .eq("period", "AM")
        .eq("location_id", locationId)
        .neq("id", initialShiftId ?? "00000000-0000-0000-0000-000000000000")
        .limit(1)
        .maybeSingle();
      if (cancelled) return;

      if (shiftError || !am?.id) {
        setAmCash(0);
        setAmCashLoaded(true);
        return;
      }

      const [serverCashRows, bartenderCashRows] = await Promise.all([
        supabase.from("shift_servers").select("cash_owed").eq("shift_id", am.id),
        supabase.from("shift_bartenders").select("cash_owed").eq("shift_id", am.id),
      ]);
      if (cancelled) return;

      const s = (serverCashRows.data ?? []).reduce((sum, r) => sum + Number(r.cash_owed ?? 0), 0);
      const b = (bartenderCashRows.data ?? []).reduce((sum, r) => sum + Number(r.cash_owed ?? 0), 0);
      setAmCash(s + b);
      setAmCashLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [date, period, initialShiftId, locationId, amCashNonce]);


  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: mem } = await supabase
        .from("location_members")
        .select("location_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      const loc = mem?.location_id ?? null;
      setLocationId(loc);

      const [s, st] = await Promise.all([
        supabase.from("staff").select("id, name, server_number, role, is_manager, staff_positions(position)").eq("active", true).order("server_number"),
        supabase.from("app_settings").select("*").limit(1).maybeSingle(),
      ]);
      const settingsRow = st.data as (Settings & { manager_exclusion_enabled?: boolean }) | null;
      const excludeManagers = !!settingsRow?.manager_exclusion_enabled;
      const rows = (s.data ?? []) as Array<Staff & { is_manager?: boolean; staff_positions: { position: string }[] }>;
      const filtered = excludeManagers ? rows.filter((r) => !r.is_manager) : rows;
      setStaff(filtered.map((r) => ({
        id: r.id, name: r.name, server_number: r.server_number, role: r.role,
        positions: r.staff_positions?.length ? r.staff_positions.map((p) => p.position) : [r.role],
      })));
      setSettings(settingsRow);

    })();
  }, []);


  const has = (s: Staff, pos: string) => s.positions.includes(pos);
  const serverList = staff.filter((s) => has(s, "server"));
  const bartenderList = staff.filter((s) => has(s, "bartender"));
  const supportList = staff.filter((s) => SUPPORT_ROLES.some((r) => has(s, r)));
  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);

  const num = (s: string) => Number(s) || 0;
  const optNum = (s: string) => (s.trim() === "" ? null : Number(s));
  const serverRows = servers.map((s) => ({
    staff_id: s.staff_id,
    cash_owed: num(s.cash_owed),
    credit_tips: num(s.credit_tips),
    lbw_sales: num(s.lbw_sales),
    total_sales: num(s.total_sales),
    bar_tip_override: optNum(s.bar_tip_override),
    rb_tip_override: optNum(s.rb_tip_override),
    split_mode: s.split_mode,
    members: s.members
      .filter((m) => m.staff_id)
      .map((m) => ({ staff_id: m.staff_id, hours_worked: num(m.hours_worked) })),
  }));
  const bartenderRows = bartenders.map((b) => ({
    staff_id: b.split_mode === "single" ? b.staff_id : null,
    cash_owed: num(b.cash_owed),
    credit_tips: num(b.credit_tips),
    total_sales: num(b.total_sales),
    rb_tip_override: optNum(b.rb_tip_override),
    split_mode: b.split_mode,
    members: b.members
      .filter((m) => m.staff_id)
      .map((m) => ({ staff_id: m.staff_id, hours_worked: num(m.hours_worked) })),
  }));



  const salesBasis = settings?.rb_basis === "sales";
  const pool = settings ? poolFromShift(serverRows, bartenderRows, settings) : 0;
  const supportRows = support.map((sp) => ({
    staff_id: sp.staff_id,
    role: (sp.role || (staffById.get(sp.staff_id)?.positions.find((p) => SUPPORT_ROLES.includes(p as SupportRole)) ?? "runner")) as SupportRole,
    hours_worked: num(sp.hours_worked),
  }));
  const supportPayouts = settings ? calcSupportPool(supportRows, pool, settings, supportSplit) : [];

  const [shiftId, setShiftId] = useState<string | null>(initialShiftId ?? null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [dirty, setDirty] = useState(false);
  const hydratedRef = useRef<boolean>(!initialShiftId);
  const savingRef = useRef(false);
  const pendingRef = useRef(false);


  async function openPeriod(nextPeriod: "AM" | "PM") {
    if (nextPeriod === period || switchingPeriod) return;
    if (!date) {
      setPeriod(nextPeriod);
      return;
    }

    setErr(null);
    setSwitchingPeriod(true);
    try {
      let query = supabase
        .from("shifts")
        .select("id")
        .eq("shift_date", date)
        .eq("period", nextPeriod)
        .limit(1);

      if (locationId) query = query.eq("location_id", locationId);

      const { data, error } = await query.maybeSingle();
      if (error) throw error;

      if (data?.id) {
        navigate({ to: "/shift/$id/edit", params: { id: data.id } });
      } else {
        navigate({ to: "/shift/new", search: { date, period: nextPeriod } });
      }
    } catch (e) {
      setErr((e as Error).message);
      setPeriod(nextPeriod);
      setSwitchingPeriod(false);
    }
  }

  const hasEntries =
    servers.some((r) => r.staff_id || r.members.length > 0) ||
    bartenders.some((r) => r.staff_id || r.members.length > 0) ||
    support.some((r) => r.staff_id) ||
    notes.trim().length > 0;

  async function requestDateChange(next: string) {
    if (!next || next === date) return;
    if (!hasEntries && !shiftId) {
      setDate(next);
      return;
    }
    setMoveErr(null);
    const periods: { AM: boolean; PM: boolean } = { AM: false, PM: false };
    if (locationId) {
      const { data } = await supabase
        .from("shifts")
        .select("period")
        .eq("shift_date", date)
        .eq("location_id", locationId);
      for (const r of data ?? []) periods[r.period as "AM" | "PM"] = true;
    }
    periods[period] = true;
    setDayPeriods(periods);
    setPendingDate(next);
  }

  async function confirmDateChange() {
    const next = pendingDate;
    if (!next) return;
    setMoveBusy(true);
    setMoveErr(null);
    try {
      if (hasEntries || shiftId) await save();
      if (locationId) {
        const { data: clash } = await supabase
          .from("shifts")
          .select("period")
          .eq("shift_date", next)
          .eq("location_id", locationId);
        if ((clash ?? []).length) {
          setMoveErr(
            `${next} already has a ${(clash ?? []).map((c) => c.period).join(" and ")} shift. Move or delete it first.`,
          );
          setMoveBusy(false);
          return;
        }
        const { error } = await supabase
          .from("shifts")
          .update({ shift_date: next })
          .eq("shift_date", date)
          .eq("location_id", locationId);
        if (error) throw error;
      }
      setDate(next);
      setPendingDate(null);
    } catch (e) {
      setMoveErr((e as Error).message);
    } finally {
      setMoveBusy(false);
    }
  }

  async function deleteShift() {
    if (!shiftId) return;
    setDeleting(true);
    setDeleteErr(null);
    try {
      hydratedRef.current = false; // stop autosave from re-creating the shift
      savingRef.current = true;
      await Promise.all([
        supabase.from("shift_servers").delete().eq("shift_id", shiftId),
        supabase.from("shift_bartenders").delete().eq("shift_id", shiftId),
        supabase.from("shift_support").delete().eq("shift_id", shiftId),
      ]);
      const { error } = await supabase.from("shifts").delete().eq("id", shiftId);
      if (error) throw error;
      navigate({ to: "/shifts" });
    } catch (e) {
      hydratedRef.current = true;
      savingRef.current = false;
      setDeleteErr((e as Error).message);
      setDeleting(false);
    }
  }



  useEffect(() => {
    if (!initialShiftId) return;
    (async () => {
      const { data } = await supabase
        .from("shifts")
        .select("shift_date, period, notes, support_split_mode, shift_servers(*, shift_server_members(*)), shift_bartenders(*, shift_bartender_members(*)), shift_support(*)")
        .eq("id", initialShiftId)
        .maybeSingle();
      if (!data) return;
      setDate(data.shift_date);
      setPeriod(data.period as "AM" | "PM");
      setNotes(data.notes ?? "");
      setSupportSplit(((data as any).support_split_mode ?? "weighted") as SupportSplitMode);
      const str = (v: number | null | undefined) => (v == null ? "" : String(v));
      setServers((data.shift_servers ?? []).map((r: any) => ({
        staff_id: r.staff_id ?? "",
        cash_owed: str(r.cash_owed),
        credit_tips: str(r.credit_tips),
        lbw_sales: str(r.lbw_sales),
        total_sales: str(r.total_sales),
        bar_tip_override: str(r.bar_tip_override),
        rb_tip_override: str(r.rb_tip_override),
        split_mode: (r.split_mode ?? "single") as BartenderSplitMode,
        members: (r.shift_server_members ?? []).map((m: any) => ({
          staff_id: m.staff_id, hours_worked: str(m.hours_worked),
        })),
      })));
      setBartenders((data.shift_bartenders ?? []).map((r: any) => ({
        staff_id: r.staff_id ?? "",
        cash_owed: str(r.cash_owed),
        credit_tips: str(r.credit_tips),
        total_sales: str(r.total_sales),
        rb_tip_override: str(r.rb_tip_override),
        split_mode: (r.split_mode ?? "single") as BartenderSplitMode,
        members: (r.shift_bartender_members ?? []).map((m: any) => ({
          staff_id: m.staff_id, hours_worked: str(m.hours_worked),
        })),
      })));

      setSupport((data.shift_support ?? []).map((r: any) => ({
        staff_id: r.staff_id,
        role: (r.role ?? "") as SupportRole | "",
        hours_worked: str(r.hours_worked),
      })));
      // allow autosave after initial hydration completes
      setTimeout(() => { hydratedRef.current = true; }, 0);
    })();
  }, [initialShiftId]);


  async function save(opts: { close?: boolean } = {}): Promise<void> {
    if (!settings) return;
    if (!locationId) { setErr("No location found for your account."); return; }
    if (savingRef.current) {
      // A save is already running: remember that newer edits need another pass
      // instead of silently dropping them.
      pendingRef.current = true;
      return;
    }
    savingRef.current = true;
    setErr(null);
    setSaving(true);
    let rollback: (() => Promise<void>) | null = null;
    try {
      let id = shiftId;


      if (id) {
        const { error: eu } = await supabase
          .from("shifts")
          .update({ shift_date: date, period, notes, support_split_mode: supportSplit } as any)
          .eq("id", id);
        if (eu) throw eu;
        // Snapshot existing rows so a failed re-insert can be rolled back
        // instead of leaving the shift empty.
        const [oldSv, oldBt, oldSp] = await Promise.all([
          supabase.from("shift_servers").select("*, shift_server_members(*)" as any).eq("shift_id", id),
          supabase.from("shift_bartenders").select("*, shift_bartender_members(*)").eq("shift_id", id),
          supabase.from("shift_support").select("*").eq("shift_id", id),
        ]);
        rollback = async () => {
          const strip = (r: any) => { const { id: _i, created_at: _c, updated_at: _u, shift_bartender_members: _m, shift_server_members: _sm, ...rest } = r; return rest; };
          for (const sv of (oldSv.data ?? []) as any[]) {
            const { data: rec } = await supabase.from("shift_servers").insert(strip(sv) as any).select("id").single();
            const mems = (sv.shift_server_members ?? []).map((m: any) => ({
              shift_server_id: rec?.id, staff_id: m.staff_id, hours_worked: m.hours_worked,
            }));
            if (rec?.id && mems.length) await supabase.from("shift_server_members" as any).insert(mems);
          }
          if ((oldSp.data ?? []).length) await supabase.from("shift_support").insert((oldSp.data ?? []).map(strip) as any);
          for (const b of (oldBt.data ?? []) as any[]) {
            const { data: rec } = await supabase.from("shift_bartenders").insert(strip(b) as any).select("id").single();
            const mems = (b.shift_bartender_members ?? []).map((m: any) => ({
              shift_bartender_id: rec?.id, staff_id: m.staff_id, hours_worked: m.hours_worked,
            }));
            if (rec?.id && mems.length) await supabase.from("shift_bartender_members" as any).insert(mems);
          }
        };
        // Clear children so we can re-insert current state.
        await Promise.all([
          supabase.from("shift_servers").delete().eq("shift_id", id),
          supabase.from("shift_bartenders").delete().eq("shift_id", id),
          supabase.from("shift_support").delete().eq("shift_id", id),
        ]);

      } else {
        // Guard: if a shift already exists for this date/period/location, open it instead of creating a duplicate.
        const { data: existing } = await supabase
          .from("shifts")
          .select("id")
          .eq("shift_date", date)
          .eq("period", period)
          .eq("location_id", locationId)
          .limit(1)
          .maybeSingle();
        if (existing?.id) {
          savingRef.current = false;
          setSaving(false);
          setErr(`A ${period} shift already exists for ${date}. Opening it instead.`);
          navigate({ to: "/shift/$id/edit", params: { id: existing.id } });
          return;
        }
        const { data: shift, error: e1 } = await supabase
          .from("shifts")
          .insert({ shift_date: date, period, notes, location_id: locationId, support_split_mode: supportSplit } as any)
          .select("id")
          .single();
        if (e1 || !shift) throw e1 ?? new Error("Insert failed");
        id = shift.id;
        setShiftId(id);
      }

      const serverPayload = serverRows.filter((r) => (r.split_mode === "single" ? r.staff_id : r.members.length > 0));
      if (serverPayload.length) {
        const { data: insertedSv, error } = await supabase.from("shift_servers").insert(
          serverPayload.map((r) => ({
            shift_id: id, staff_id: r.split_mode === "single" ? r.staff_id : null,
            cash_owed: r.cash_owed, credit_tips: r.credit_tips, lbw_sales: r.lbw_sales, total_sales: r.total_sales,
            bar_tip_override: r.bar_tip_override, rb_tip_override: r.rb_tip_override,
            split_mode: r.split_mode,
          })) as any,
        ).select("id");
        if (error) throw error;
        const svMemberInserts: any[] = [];
        (insertedSv ?? []).forEach((rec, idx) => {
          const src = serverPayload[idx];
          if (src.split_mode !== "single") {
            for (const m of src.members) {
              svMemberInserts.push({ shift_server_id: rec.id, staff_id: m.staff_id, hours_worked: m.hours_worked });
            }
          }
        });
        if (svMemberInserts.length) {
          const { error: sme } = await supabase.from("shift_server_members" as any).insert(svMemberInserts);
          if (sme) throw sme;
        }
      }
      const bartenderPayload = bartenderRows.filter((r) => r.staff_id || r.members.length > 0);
      if (bartenderPayload.length) {
        const { data: inserted, error } = await supabase
          .from("shift_bartenders")
          .insert(
            bartenderPayload.map((r) => ({
              shift_id: id,
              staff_id: r.staff_id,
              cash_owed: r.cash_owed,
              credit_tips: r.credit_tips,
              total_sales: r.total_sales,
              rb_tip_override: r.rb_tip_override,
              split_mode: r.split_mode,
            })) as any,
          )
          .select("id");
        if (error) throw error;
        const memberInserts: any[] = [];
        (inserted ?? []).forEach((rec, idx) => {
          const src = bartenderPayload[idx];
          if (src.split_mode !== "single") {
            for (const m of src.members) {
              memberInserts.push({ shift_bartender_id: rec.id, staff_id: m.staff_id, hours_worked: m.hours_worked });
            }
          }
        });
        if (memberInserts.length) {
          const { error: me } = await supabase.from("shift_bartender_members" as any).insert(memberInserts);
          if (me) throw me;
        }
      }


      if (supportRows.length) {
        const { error } = await supabase.from("shift_support").insert(
          supportRows.filter((r) => r.staff_id).map((r) => ({
            shift_id: id, staff_id: r.staff_id, hours_worked: r.hours_worked, role: r.role,
          })) as any,
        );
        if (error) throw error;
      }
      setSavedAt(new Date());
      setSaving(false);
      savingRef.current = false;
      if (pendingRef.current) {
        // Edits arrived while this save was in flight — write them too.
        pendingRef.current = false;
        await save();
        return;
      }
      setDirty(false);
      setAmCashNonce((n) => n + 1);
      if (opts.close) navigate({ to: "/" });
    } catch (e) {
      if (rollback) await rollback().catch(() => {});
      setErr(`${(e as Error).message} — nothing was lost, please try saving again.`);
      setSaving(false);
      savingRef.current = false;
      pendingRef.current = false;
    }
  }

  // Always call the freshest save (avoids stale-closure saves on unmount).
  const saveRef = useRef(save);
  saveRef.current = save;

  // Auto-save: debounced save when form data changes after hydration.
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (!date || !settings || !locationId) return;
    setDirty(true);
    const t = setTimeout(() => { saveRef.current().catch(() => {}); }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servers, bartenders, support, supportSplit, notes, date, period, settings, locationId]);

  // Best-effort save on tab close / navigation away.
  useEffect(() => {
    const handler = () => {
      if (hydratedRef.current) saveRef.current().catch(() => {});
    };
    window.addEventListener("pagehide", handler);
    return () => {

      window.removeEventListener("pagehide", handler);
      handler();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn on tab close / reload while there are unsaved edits.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Prompt to save before navigating away with unsaved edits.
  const { status: blockStatus, proceed, reset } = useBlocker({
    shouldBlockFn: () => dirtyRef.current && !savingRef.current,
    enableBeforeUnload: false,
    withResolver: true,
  });



  if (!settings) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen bg-background pb-32">
      {blockStatus === "blocked" && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-5 max-w-sm w-full space-y-3">
            <h2 className="font-serif text-lg">Unsaved changes</h2>
            <p className="text-sm text-muted-foreground">You have shift edits that haven’t been saved yet. Save before leaving?</p>
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={async () => { await saveRef.current(); proceed(); }}
                className="h-11 rounded-md bg-primary text-primary-foreground font-medium"
              >
                Save and leave
              </button>
              <button onClick={() => proceed()} className="h-11 rounded-md border border-input text-sm font-medium">
                Leave without saving
              </button>
              <button onClick={() => reset()} className="h-11 rounded-md text-sm text-muted-foreground">
                Stay on this page
              </button>
            </div>
          </div>
        </div>
      )}
      <header className="sticky top-0 bg-background border-b border-border z-10">
        <div className="max-w-2xl mx-auto p-4 flex items-center gap-3">
          <Link to="/" className="text-sm text-muted-foreground">← Home</Link>
          <h1 className="text-lg font-serif flex-1">{initialShiftId ? "Edit Shift" : "New Shift"}</h1>
          <button
            onClick={async () => { await save(); navigate({ to: "/daily", search: { date } }); }}
            disabled={saving}
            className="h-9 px-3 rounded-md border border-input text-sm font-medium disabled:opacity-60"
          >
            {saving ? "Saving…" : "Print now"}
          </button>
        </div>

      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        <section className="bg-card border border-border rounded-lg p-4 grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Date</label>
            <input type="date" value={pendingDate ?? date} onChange={(e) => requestDateChange(e.target.value)} className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3" />
            {hasEntries && <p className="mt-1 text-[11px] text-muted-foreground">Changing the date moves the whole day (AM + PM).</p>}
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Period</label>
            <div className="mt-1 flex gap-2">
              {(["AM", "PM"] as const).map((p) => (
                <button key={p} onClick={() => openPeriod(p)} disabled={switchingPeriod} className={`flex-1 h-11 rounded-md border disabled:opacity-60 ${period === p ? "bg-primary text-primary-foreground border-primary" : "border-input"}`}>{switchingPeriod && period !== p ? "Opening…" : p}</button>
              ))}
            </div>
          </div>
        </section>

        <Section title="Servers" onAdd={() => setServers([...servers, { staff_id: "", cash_owed: "", credit_tips: "", lbw_sales: "", total_sales: "", bar_tip_override: "", rb_tip_override: "", split_mode: "single", members: [] }])}>
          {servers.map((row, i) => {
            const shared = row.split_mode !== "single";
            const raw = { staff_id: row.staff_id, cash_owed: num(row.cash_owed), credit_tips: num(row.credit_tips), lbw_sales: num(row.lbw_sales), total_sales: num(row.total_sales) };
            const auto = calcServer(raw, settings);
            const calc = calcServer({ ...raw, bar_tip_override: optNum(row.bar_tip_override), rb_tip_override: optNum(row.rb_tip_override) }, settings);
            const memberInputs = row.members
              .filter((m) => m.staff_id)
              .map((m) => ({ staff_id: m.staff_id, hours_worked: num(m.hours_worked) }));
            const shares = shared
              ? splitServerShares(
                  { staff_id: null, cash_owed: raw.cash_owed, credit_tips: raw.credit_tips, lbw_sales: raw.lbw_sales },
                  { bar_tip: calc.bar_tip, rb_tip: calc.rb_tip, takehome: calc.takehome },
                  row.split_mode,
                  memberInputs,
                )
              : [];
            const updateMember = (mi: number, patch: Partial<BartenderMemberInput>) => {
              updateAt(servers, setServers, i, { members: row.members.map((m, j) => (j === mi ? { ...m, ...patch } : m)) });
            };
            const removeMember = (mi: number) => {
              updateAt(servers, setServers, i, { members: row.members.filter((_, j) => j !== mi) });
            };
            const addMember = () => {
              updateAt(servers, setServers, i, { members: [...row.members, { staff_id: "", hours_worked: "" }] });
            };
            return (
              <div key={i} className="border border-border rounded-md p-3 space-y-2 bg-background">
                <div className="flex gap-2">
                  {!shared ? (
                    <select value={row.staff_id} onChange={(e) => updateAt(servers, setServers, i, { staff_id: e.target.value })} className="flex-1 h-11 rounded-md border border-input bg-background px-2">
                      <option value="">Select server…</option>
                      {serverList.map((s) => (<option key={s.id} value={s.id}>{s.name}{s.server_number ? ` #${s.server_number}` : ""}</option>))}
                    </select>
                  ) : (
                    <div className="flex-1 h-11 rounded-md border border-input bg-secondary/40 px-3 flex items-center text-sm text-muted-foreground">
                      Split party — {memberInputs.length} server{memberInputs.length === 1 ? "" : "s"}
                    </div>
                  )}
                  <button onClick={() => setServers(servers.filter((_, j) => j !== i))} className="px-3 h-11 rounded-md border border-input text-muted-foreground">×</button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Split:</span>
                  <div className="inline-flex rounded-md border border-input overflow-hidden">
                    {(["single", "equal", "hours"] as BartenderSplitMode[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          if (m === "single") {
                            updateAt(servers, setServers, i, { split_mode: "single" });
                            return;
                          }
                          const seed: BartenderMemberInput[] = row.staff_id
                            ? [{ staff_id: row.staff_id, hours_worked: "" }]
                            : [{ staff_id: "", hours_worked: "" }, { staff_id: "", hours_worked: "" }];
                          updateAt(servers, setServers, i, {
                            split_mode: m,
                            members: row.members.length ? row.members : seed,
                          });
                        }}
                        className={`h-9 px-3 text-sm ${row.split_mode === m ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
                      >
                        {m === "single" ? "Individual" : m === "equal" ? "Split party (even)" : "Split party (hours)"}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {row.split_mode === "single"
                      ? "One server on this cash-out."
                      : row.split_mode === "equal"
                      ? "Cash-out splits evenly across everyone listed."
                      : "Enter hours worked — cash-out weighted by hours."}
                  </span>
                </div>

                {shared && (
                  <div className="space-y-2 pl-1 border-l-2 border-secondary">
                    {row.members.map((m, mi) => {
                      const share = shares.find((s) => s.staff_id === m.staff_id);
                      return (
                        <div key={mi} className="grid grid-cols-[1fr_100px_auto] gap-2 items-center">
                          <select value={m.staff_id} onChange={(e) => updateMember(mi, { staff_id: e.target.value })} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
                            <option value="">Select server…</option>
                            {serverList.map((s) => (<option key={s.id} value={s.id}>{s.name}{s.server_number ? ` #${s.server_number}` : ""}</option>))}
                          </select>
                          {row.split_mode === "hours" ? (
                            <input type="number" inputMode="decimal" step="0.25" placeholder="Hrs" value={m.hours_worked} onChange={(e) => updateMember(mi, { hours_worked: e.target.value })} className="h-10 rounded-md border border-input bg-background px-2 text-sm" />
                          ) : (
                            <div className="text-xs text-muted-foreground text-right">Even share</div>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="text-sm tabular-nums text-emerald-700 font-semibold min-w-[64px] text-right">{share ? fmt(share.takehome) : "$0.00"}</span>
                            <button onClick={() => removeMember(mi)} className="px-2 h-10 rounded-md border border-input text-muted-foreground text-sm">×</button>
                          </div>
                        </div>
                      );
                    })}
                    <button type="button" onClick={addMember} className="text-xs px-3 h-8 rounded-md border border-input">+ Add server</button>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <Money label="Cash owed" value={row.cash_owed} onChange={(v) => updateAt(servers, setServers, i, { cash_owed: v })} />
                  <Money label="Credit tips" value={row.credit_tips} onChange={(v) => updateAt(servers, setServers, i, { credit_tips: v })} />
                  <Money label="LBW sales" value={row.lbw_sales} onChange={(v) => updateAt(servers, setServers, i, { lbw_sales: v })} />
                </div>
                {salesBasis && (
                  <Money label="Total sales" value={row.total_sales} onChange={(v) => updateAt(servers, setServers, i, { total_sales: v })} />
                )}
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border">
                  <TipOut label="Bar tip" auto={auto.bar_tip} override={row.bar_tip_override} onSet={(v) => updateAt(servers, setServers, i, { bar_tip_override: v })} />
                  <TipOut label="R/B tip" auto={auto.rb_tip} override={row.rb_tip_override} onSet={(v) => updateAt(servers, setServers, i, { rb_tip_override: v })} />
                  <div className="self-end rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold">{shared ? "Combined take-home" : "Take-home"}</div>
                    <div className="text-xl font-bold text-emerald-700 tabular-nums leading-tight">{fmt(calc.takehome)}</div>
                    <div className="text-[11px] text-emerald-700/80 tabular-nums">{pct(calc.takehome, raw.credit_tips)}</div>
                  </div>

                </div>

              </div>
            );
          })}


        </Section>

        <Section title="Bartenders" onAdd={() => setBartenders([...bartenders, { staff_id: "", cash_owed: "", credit_tips: "", total_sales: "", rb_tip_override: "", split_mode: "single", members: [] }])}>
          {(() => {
            const totalServerBar = serverRows.reduce((sum, r) => sum + calcServer(r, settings).bar_tip, 0);
            const perBartender = bartenders.length > 0 ? totalServerBar / bartenders.length : 0;
            return bartenders.map((row, i) => {
              const shared = row.split_mode !== "single";
              const rawB = { staff_id: shared ? null : row.staff_id, cash_owed: num(row.cash_owed), credit_tips: num(row.credit_tips), total_sales: num(row.total_sales) };
              const auto = calcBartender(rawB, perBartender, settings);
              const calc = calcBartender({ ...rawB, rb_tip_override: optNum(row.rb_tip_override) }, perBartender, settings);
              const memberInputs = row.members.map((m) => ({ staff_id: m.staff_id, hours_worked: num(m.hours_worked) }));
              const shares = shared
                ? splitBartenderShares(rawB, { rb_tip: calc.rb_tip, takehome: calc.takehome, collected_from_servers: perBartender }, row.split_mode, memberInputs.filter((m) => m.staff_id))
                : [];
              const updateMember = (mi: number, patch: Partial<BartenderMemberInput>) => {
                const next = row.members.map((m, j) => (j === mi ? { ...m, ...patch } : m));
                updateAt(bartenders, setBartenders, i, { members: next });
              };
              const removeMember = (mi: number) => {
                updateAt(bartenders, setBartenders, i, { members: row.members.filter((_, j) => j !== mi) });
              };
              const addMember = () => {
                updateAt(bartenders, setBartenders, i, { members: [...row.members, { staff_id: "", hours_worked: "" }] });
              };
              return (
                <div key={i} className="border border-border rounded-md p-3 space-y-2 bg-background">
                  <div className="flex gap-2">
                    {!shared ? (
                      <select value={row.staff_id} onChange={(e) => updateAt(bartenders, setBartenders, i, { staff_id: e.target.value })} className="flex-1 h-11 rounded-md border border-input bg-background px-2">
                        <option value="">Select bartender…</option>
                        {bartenderList.map((s) => (<option key={s.id} value={s.id}>{s.name}{s.server_number ? ` #${s.server_number}` : ""}</option>))}
                      </select>
                    ) : (
                      <div className="flex-1 h-11 rounded-md border border-input bg-secondary/40 px-3 flex items-center text-sm text-muted-foreground">
                        Shared cash-out — {row.members.filter((m) => m.staff_id).length} bartender{row.members.filter((m) => m.staff_id).length === 1 ? "" : "s"}
                      </div>
                    )}
                    <button onClick={() => setBartenders(bartenders.filter((_, j) => j !== i))} className="px-3 h-11 rounded-md border border-input text-muted-foreground">×</button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Split:</span>
                    <div className="inline-flex rounded-md border border-input overflow-hidden">
                      {(["single", "equal", "hours"] as BartenderSplitMode[]).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            if (m === "single") {
                              updateAt(bartenders, setBartenders, i, { split_mode: "single" });
                              return;
                            }
                            const seed: BartenderMemberInput[] = row.staff_id
                              ? [{ staff_id: row.staff_id, hours_worked: "" }]
                              : [{ staff_id: "", hours_worked: "" }, { staff_id: "", hours_worked: "" }];
                            updateAt(bartenders, setBartenders, i, {
                              split_mode: m,
                              members: row.members.length ? row.members : seed,
                            });
                          }}
                          className={`h-9 px-3 text-sm ${row.split_mode === m ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
                        >
                          {m === "single" ? "Individual" : m === "equal" ? "Shared (even)" : "Weighted (hours)"}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {row.split_mode === "single"
                        ? "One bartender on this cash-out."
                        : row.split_mode === "equal"
                        ? "Cash-out splits evenly across everyone listed."
                        : "Enter hours worked — cash-out weighted by hours."}
                    </span>
                  </div>

                  {shared && (
                    <div className="space-y-2 pl-1 border-l-2 border-secondary">
                      {row.members.map((m, mi) => {
                        const share = shares.find((s) => s.staff_id === m.staff_id);
                        return (
                          <div key={mi} className="grid grid-cols-[1fr_100px_auto] gap-2 items-center">
                            <select value={m.staff_id} onChange={(e) => updateMember(mi, { staff_id: e.target.value })} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
                              <option value="">Select bartender…</option>
                              {bartenderList.map((s) => (<option key={s.id} value={s.id}>{s.name}{s.server_number ? ` #${s.server_number}` : ""}</option>))}
                            </select>
                            {row.split_mode === "hours" ? (
                              <input type="number" inputMode="decimal" step="0.25" placeholder="Hrs" value={m.hours_worked} onChange={(e) => updateMember(mi, { hours_worked: e.target.value })} className="h-10 rounded-md border border-input bg-background px-2 text-sm" />
                            ) : (
                              <div className="text-xs text-muted-foreground text-right">Even share</div>
                            )}
                            <div className="flex items-center gap-2">
                              <span className="text-sm tabular-nums text-emerald-700 font-semibold min-w-[64px] text-right">{share ? fmt(share.takehome) : "$0.00"}</span>
                              <button onClick={() => removeMember(mi)} className="px-2 h-10 rounded-md border border-input text-muted-foreground text-sm">×</button>
                            </div>
                          </div>
                        );
                      })}
                      <button type="button" onClick={addMember} className="text-xs px-3 h-8 rounded-md border border-input">+ Add bartender</button>
                    </div>
                  )}


                  <div className="grid grid-cols-2 gap-2">
                    <Money label="Cash owed" value={row.cash_owed} onChange={(v) => updateAt(bartenders, setBartenders, i, { cash_owed: v })} />
                    <Money label="Credit tips" value={row.credit_tips} onChange={(v) => updateAt(bartenders, setBartenders, i, { credit_tips: v })} />
                    {salesBasis && (
                      <Money label="Total sales" value={row.total_sales} onChange={(v) => updateAt(bartenders, setBartenders, i, { total_sales: v })} />
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border items-end">
                    <div className="text-xs text-muted-foreground pb-2">From servers: <span className="text-foreground font-medium">{fmt(perBartender)}</span></div>
                    <TipOut label="R/B tip out" auto={auto.rb_tip} override={row.rb_tip_override} onSet={(v) => updateAt(bartenders, setBartenders, i, { rb_tip_override: v })} />
                    <div className="self-end rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-center">
                      <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold">
                        {shared ? "Combined take-home" : "Take-home"}
                      </div>
                      <div className="text-xl font-bold text-emerald-700 tabular-nums leading-tight">{fmt(calc.takehome)}</div>
                      <div className="text-[11px] text-emerald-700/80 tabular-nums">{pct(calc.takehome, rawB.credit_tips + perBartender)}</div>
                    </div>

                  </div>
                  {row.rb_tip_override.trim() !== "" && (
                    <button type="button" onClick={() => updateAt(bartenders, setBartenders, i, { rb_tip_override: "" })} className="text-xs text-muted-foreground underline">
                      Reset tip-out to calculated
                    </button>
                  )}
                </div>
              );
            });
          })()}
        </Section>


        <Section title="Support staff (Runners / Bussers / Bar Backs / Hostesses)" onAdd={() => setSupport([...support, { staff_id: "", role: "", hours_worked: "" }])}>
          <div className="flex flex-wrap items-center gap-2 pb-1">
            <span className="text-xs text-muted-foreground">Split:</span>
            <div className="inline-flex rounded-md border border-input overflow-hidden">
              {(["shared", "weighted"] as SupportSplitMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSupportSplit(m)}
                  className={`h-9 px-3 text-sm ${supportSplit === m ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
                >
                  {m === "shared" ? "Shared (even)" : "Weighted (hours)"}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              {supportSplit === "shared" ? "Pool splits evenly across everyone listed." : "Enter hours worked — payout weighted by position and hours."}
            </span>
          </div>
          {support.map((row, i) => {
            const person = staffById.get(row.staff_id);
            const qualified = person ? SUPPORT_ROLES.filter((r) => person.positions.includes(r)) : SUPPORT_ROLES;
            const payout = supportPayouts.find((p) => p.staff_id === row.staff_id)?.payout ?? 0;
            return (
              <div key={i} className="border border-border rounded-md p-3 space-y-2 bg-background">
                <div className="flex gap-2">
                  <select value={row.staff_id} onChange={(e) => {
                    const id = e.target.value;
                    const p = staff.find((x) => x.id === id);
                    const def = p ? (SUPPORT_ROLES.find((r) => p.positions.includes(r)) ?? "") : "";
                    updateAt(support, setSupport, i, { staff_id: id, role: def as SupportRole | "" });
                  }} className="flex-1 h-11 rounded-md border border-input bg-background px-2">
                    <option value="">Select…</option>
                    {supportList.map((s) => (<option key={s.id} value={s.id}>{s.name}{s.server_number ? ` #${s.server_number}` : ""}</option>))}
                  </select>
                  <select value={row.role} onChange={(e) => updateAt(support, setSupport, i, { role: e.target.value as SupportRole })} className="h-11 rounded-md border border-input bg-background px-2" disabled={!row.staff_id}>
                    <option value="">Position…</option>
                    {qualified.map((r) => (<option key={r} value={r}>{r.replace("_", " ")}</option>))}
                  </select>
                  <button onClick={() => setSupport(support.filter((_, j) => j !== i))} className="px-3 h-11 rounded-md border border-input text-muted-foreground">×</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {supportSplit === "weighted" ? (
                    <div>
                      <label className="text-xs text-muted-foreground">Hours</label>
                      <input type="number" inputMode="decimal" step="0.25" value={row.hours_worked} onChange={(e) => updateAt(support, setSupport, i, { hours_worked: e.target.value })} className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3" />
                    </div>
                  ) : (
                    <div className="flex items-end text-sm text-muted-foreground">Even share</div>
                  )}
                  <div className="flex items-end text-sm">
                    <div className="text-muted-foreground">Payout: <span className="text-foreground font-medium">{fmt(payout)}</span></div>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="text-xs text-muted-foreground pt-2">Pool from tonight: <span className="font-medium text-foreground">{fmt(pool)}</span></div>
        </Section>


        {(() => {
          const serverCash = serverRows.reduce((s, r) => s + r.cash_owed, 0);
          const bartenderCash = bartenderRows.reduce((s, r) => s + r.cash_owed, 0);
          const currentSubtotal = serverCash + bartenderCash;
          const includeAm = period === "PM";
          const total = currentSubtotal + (includeAm ? amCash : 0);
          const currentLabel = period === "PM" ? "PM owed to house" : "AM owed to house";
          return (
            <section className="bg-card border border-border rounded-lg p-4 space-y-3">
              <h2 className="font-serif text-lg text-foreground">Cash Deposit (House)</h2>

              {includeAm && (
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">AM owed to house</div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">AM shift subtotal</span><span className="font-medium">{amCashLoaded ? fmt(amCash) : "Loading…"}</span></div>
                </div>
              )}

              <div className="space-y-1 pt-1 border-t border-border">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{currentLabel}</div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Servers cash owed</span><span className="font-medium">{fmt(serverCash)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Bartenders cash owed</span><span className="font-medium">{fmt(bartenderCash)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">{period} subtotal</span><span className="font-medium">{fmt(currentSubtotal)}</span></div>
              </div>

              <div className="flex justify-between pt-2 border-t border-border"><span className="font-medium">Total deposit</span><span className="font-serif text-lg">{fmt(total)}</span></div>
            </section>
          );
        })()}


        <section>
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" />
        </section>

        {err && <p className="text-sm text-destructive">{err}</p>}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4">
        <div className="max-w-2xl mx-auto flex gap-2 items-center">
          <span className="text-xs text-muted-foreground flex-1">
            {saving ? "Auto-saving…" : savedAt ? `Auto-saved ${savedAt.toLocaleTimeString()}` : "Auto-save on"}
          </span>
          <button onClick={() => save()} disabled={saving} className="flex-1 h-12 rounded-md border border-input font-medium disabled:opacity-50">
            {saving ? "Saving…" : shiftId ? "Save Progress" : "Save"}
          </button>
          <button onClick={() => save({ close: true })} disabled={saving} className="flex-1 h-12 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50">
            Save & Close
          </button>
        </div>
        {shiftId && (
          <div className="max-w-2xl mx-auto mt-2 flex justify-end">
            <button
              onClick={() => { setDeleteErr(null); setConfirmDelete(true); }}
              className="h-9 px-4 rounded-md border border-destructive text-destructive text-sm font-medium"
            >
              Delete shift
            </button>
          </div>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-card border border-border rounded-lg p-5 space-y-3">
            <h2 className="text-lg font-serif">Delete this shift?</h2>
            <p className="text-sm text-muted-foreground">
              The {period} shift for <span className="font-medium text-foreground">{date}</span> and all of its server,
              bartender and support entries will be permanently deleted. This cannot be undone.
            </p>
            {deleteErr && <p className="text-sm text-destructive">{deleteErr}</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="flex-1 h-11 rounded-md border border-input font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteShift()}
                disabled={deleting}
                className="flex-1 h-11 rounded-md bg-destructive text-destructive-foreground font-medium disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete shift"}
              </button>
            </div>
          </div>
        </div>
      )}


      {pendingDate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-card border border-border rounded-lg p-5 space-y-3">
            <h2 className="text-lg font-serif">Change shift date?</h2>
            <p className="text-sm text-muted-foreground">
              You picked <span className="font-medium text-foreground">{pendingDate}</span> instead of{" "}
              <span className="font-medium text-foreground">{date}</span>. If that was a mistake, cancel and the date stays as it is.
            </p>
            <p className="text-sm text-muted-foreground">
              If it's correct, this shift's entries are saved first, then{" "}
              <span className="font-medium text-foreground">
                {dayPeriods.AM && dayPeriods.PM ? "both the AM and PM shifts" : dayPeriods.AM ? "the AM shift" : "the PM shift"}
              </span>{" "}
              for {date} moves to {pendingDate} with all entries.
            </p>
            {moveErr && <p className="text-sm text-destructive">{moveErr}</p>}
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => confirmDateChange()}
                disabled={moveBusy}
                className="h-11 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50"
              >
                {moveBusy ? "Saving & moving…" : `Save & move day to ${pendingDate}`}
              </button>
              <button
                onClick={() => { setPendingDate(null); setMoveErr(null); }}
                disabled={moveBusy}
                className="h-11 rounded-md border border-input font-medium disabled:opacity-50"
              >
                Cancel — wrong date, keep {date}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>

  );
}

function updateAt<T>(arr: T[], set: (a: T[]) => void, i: number, patch: Partial<T>) {
  set(arr.map((row, j) => (j === i ? { ...row, ...patch } : row)));
}

function Section({ title, onAdd, children }: { title: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg text-foreground">{title}</h2>
        <button onClick={onAdd} className="text-sm px-3 h-9 rounded-md border border-input text-foreground">+ Add</button>
      </div>
      {children}
    </section>
  );
}

function Money({ label, value, onChange, tone }: { label: string; value: string; onChange: (v: string) => void; tone?: "tipout" }) {
  const isTip = tone === "tipout";
  return (
    <div>
      <label className={`text-xs ${isTip ? "text-red-600 font-medium" : "text-muted-foreground"}`}>{label}</label>
      <div className="relative">
        <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${isTip ? "text-red-600" : "text-muted-foreground"}`}>$</span>
        <input type="number" inputMode="decimal" step="0.01" value={value} onChange={(e) => onChange(e.target.value)} className={`mt-1 w-full rounded-md border border-input bg-background pl-7 pr-2 ${isTip ? "h-12 text-lg font-semibold text-red-600" : "h-11"}`} />
      </div>
    </div>
  );
}

function TipOut({ label, auto, override, onSet }: { label: string; auto: number; override: string; onSet: (v: string) => void }) {
  const isOverride = override.trim() !== "";
  const effective = isOverride ? Number(override) || 0 : auto;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const startEdit = () => {
    setDraft(isOverride ? override : auto.toFixed(2));
    setEditing(true);
  };
  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === "") { onSet(""); setEditing(false); return; }
    const n = Number(trimmed);
    if (!isFinite(n) || n < 0) { setEditing(false); return; }
    onSet(trimmed);
    setEditing(false);
  };
  const clearOverride = () => { onSet(""); setEditing(false); };
  if (editing) {
    return (
      <div>
        <label className="text-xs text-red-600 font-medium">{label}</label>
        <div className="mt-1 flex gap-1">
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
            onBlur={(e) => {
              const next = e.relatedTarget as HTMLElement | null;
              if (next?.dataset?.tipoutAction) return; // let Save/Reset handle it
              commit();
            }}
            className="flex-1 h-12 rounded-md border border-input bg-background px-3 text-lg font-semibold text-red-600 tabular-nums"
          />
          <button type="button" data-tipout-action="save" onMouseDown={(e) => e.preventDefault()} onClick={commit} className="h-12 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium">Save</button>
          {isOverride && (
            <button type="button" data-tipout-action="reset" onMouseDown={(e) => e.preventDefault()} onClick={clearOverride} className="h-12 px-2 rounded-md border border-input text-xs">Reset</button>
          )}
        </div>
      </div>
    );
  }
  return (
    <div>
      <label className="text-xs text-red-600 font-medium">{label}</label>
      <button
        type="button"
        onClick={startEdit}
        className="mt-1 w-full h-12 rounded-md border border-input bg-background px-3 flex items-center justify-between text-red-600 hover:bg-red-50"
      >
        <span className="text-lg font-semibold tabular-nums">{fmt(effective)}</span>
        <span className="text-xs uppercase tracking-wide font-medium underline">{isOverride ? "Edit ✱" : "Edit"}</span>
      </button>
    </div>
  );
}
