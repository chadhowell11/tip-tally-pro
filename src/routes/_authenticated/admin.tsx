import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { PAY_PERIOD_LABELS, type PayPeriodType, getMyLocationId, loadMySettings, resolveLogoUrl } from "@/lib/location";
import { clearRemembered } from "@/lib/remember";
import { AuditPanel } from "@/components/audit-panel";


export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin · Tip Share" }] }),
  component: AdminPage,
});

const ALL_POSITIONS = ["server", "bartender", "runner", "busser", "bar_back", "hostess"] as const;
type Position = (typeof ALL_POSITIONS)[number];

type Staff = { id: string; name: string; server_number: string | null; email: string | null; phone: string | null; role: Position; active: boolean; is_manager: boolean; positions: Position[] };
type Settings = {
  id: number; location_id: string; establishment_name: string; logo_url: string | null;
  pay_period_type: PayPeriodType; pay_period_anchor: string | null;
  bar_tip_pct: number; runner_busser_tip_pct: number; bartender_tip_pct: number; max_tipout_pct: number; rb_basis: "tips" | "sales";
  weight_runner: number; weight_busser: number; weight_bar_back: number; weight_hostess: number;
  rounding_mode: "none" | "nearest" | "up" | "down";
  use_net_sales: boolean; sales_tax_pct: number;
  cc_fee_enabled: boolean; cc_fee_pct: number;
  manager_exclusion_enabled: boolean;
  sms_enabled: boolean; sms_from_number: string | null; sms_include_breakdown: boolean;
};


function AdminPage() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [tab, setTab] = useState<"staff" | "team" | "settings" | "audit">("staff");

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/auth" }); return; }
      const { data: mem } = await supabase
        .from("location_members")
        .select("location_id, role")
        .eq("user_id", session.user.id)
        .limit(1)
        .maybeSingle();
      if (!mem?.location_id) { navigate({ to: "/onboarding" }); return; }
      setMyRole(mem.role as string);
      const { data } = await supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" });
      setIsAdmin(!!data);
      setAuthChecked(true);
    })();
  }, [navigate]);

  const canEditSettings = myRole === "owner" || myRole === "admin";


  if (!authChecked) return <div className="p-8 text-center text-muted-foreground">…</div>;
  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">You're signed in, but not an admin.</p>
        <Link to="/" className="text-primary underline mt-2 inline-block">Go home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 bg-background border-b border-border z-10">
        <div className="max-w-3xl mx-auto p-4 flex items-center gap-3">
          <Link to="/" className="text-sm text-muted-foreground">← Home</Link>
          <h1 className="text-lg font-serif flex-1">Admin</h1>

          <button onClick={async () => { await supabase.auth.signOut(); clearRemembered(); navigate({ to: "/auth" }); }} className="text-sm text-muted-foreground">Sign out</button>
        </div>
        <div className="max-w-3xl mx-auto px-4 flex gap-1">
          {(["staff", "team", "settings", ...(canEditSettings ? ["audit"] as const : [])] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm capitalize border-b-2 ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>{t}</button>
          ))}
        </div>
      </header>
      <main className={tab === "audit" ? "max-w-5xl mx-auto p-4" : "max-w-3xl mx-auto p-4"}>
        {tab === "staff" ? <StaffTab /> : tab === "team" ? <TeamTab /> : tab === "audit" ? <AuditPanel /> : <SettingsTab canEdit={canEditSettings} />}
      </main>

    </div>
  );
}

function normalizePosition(raw: string): Position | null {
  const s = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const map: Record<string, Position> = {
    server: "server", waiter: "server", waitress: "server", server_assistant: "server",
    bartender: "bartender", bar: "bartender",
    runner: "runner", food_runner: "runner",
    busser: "busser", bus: "busser",
    bar_back: "bar_back", barback: "bar_back",
    hostess: "hostess", host: "hostess",
  };
  return (map[s] as Position) ?? (ALL_POSITIONS.includes(s as Position) ? (s as Position) : null);
}

function StaffTab() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [name, setName] = useState("");
  const [num, setNum] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Position>("server");
  const [err, setErr] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [listView, setListView] = useState<"active" | "inactive">("active");


  async function load() {
    const { data } = await supabase.from("staff").select("id, name, server_number, email, phone, role, active, is_manager, staff_positions(position)").order("server_number", { nullsFirst: false });
    const rows = (data ?? []) as Array<Staff & { staff_positions: { position: Position }[] }>;
    setStaff(rows.map((r) => ({
      id: r.id, name: r.name, server_number: r.server_number, email: r.email ?? null, phone: r.phone ?? null,
      role: r.role, active: r.active, is_manager: !!r.is_manager,
      positions: r.staff_positions?.length ? r.staff_positions.map((p) => p.position) : [r.role],
    })));
  }

  useEffect(() => { load(); }, []);

  async function add() {
    setErr(null);
    if (!name.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data: loc } = await supabase.from("location_members").select("location_id").eq("user_id", user?.id ?? "").limit(1).maybeSingle();
    if (!loc?.location_id) return setErr("No location found for your account.");
    const { data, error } = await supabase.from("staff").insert({
      name: name.trim(), server_number: num || null, email: email.trim() || null, phone: phone.trim() || null,
      role, active: true, location_id: loc.location_id,
    }).select("id").single();
    if (error || !data) return setErr(error?.message ?? "Insert failed");
    await supabase.from("staff_positions").insert({ staff_id: data.id, position: role });
    setName(""); setNum(""); setEmail(""); setPhone(""); setRole("server");
    load();
  }

  async function saveContact(s: Staff, patch: { email?: string | null; phone?: string | null; name?: string; server_number?: string | null }) {
    const { error } = await supabase.from("staff").update(patch).eq("id", s.id);
    if (error) { setErr(error.message); return; }
    setStaff((prev) => prev.map((x) => (x.id === s.id ? { ...x, ...patch } : x)));
  }



  async function togglePosition(s: Staff, p: Position) {
    if (s.positions.includes(p)) {
      if (s.positions.length === 1) return; // keep at least one
      await supabase.from("staff_positions").delete().eq("staff_id", s.id).eq("position", p);
    } else {
      await supabase.from("staff_positions").insert({ staff_id: s.id, position: p });
    }
    load();
  }

  async function toggleActive(s: Staff) {
    await supabase.from("staff").update({ active: !s.active }).eq("id", s.id);
    load();
  }
  async function toggleManager(s: Staff) {
    await supabase.from("staff").update({ is_manager: !s.is_manager }).eq("id", s.id);
    load();
  }
  async function remove(s: Staff) {
    if (!confirm(`Remove ${s.name}?`)) return;
    setErr(null);
    const { error } = await supabase.from("staff").delete().eq("id", s.id);
    if (error) {
      const hasHistory = error.code === "23503" || /foreign key|violates/i.test(error.message);
      if (hasHistory) {
        const ok = confirm(
          `${s.name} has shift history and can't be deleted (their past tip records must stay intact). Mark them inactive instead? They'll be hidden from new shifts.`,
        );
        if (ok) {
          const { error: e2 } = await supabase.from("staff").update({ active: false }).eq("id", s.id);
          if (e2) setErr(e2.message);
          else setStaff((prev) => prev.map((x) => (x.id === s.id ? { ...x, active: false } : x)));
        }
      } else {
        setErr(error.message);
      }
      return;
    }
    setStaff((prev) => prev.filter((x) => x.id !== s.id));
    load();
  }



  const visibleStaff = staff.filter((s) => (listView === "active" ? s.active : !s.active));

  return (

    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg">Add staff</h2>
          <button onClick={() => setShowImport(true)} className="text-sm h-9 px-3 rounded-md border border-input">Import from Excel</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-md border border-input bg-background px-3 sm:col-span-2" />
          <input placeholder="#" type="number" value={num} onChange={(e) => setNum(e.target.value)} className="h-11 rounded-md border border-input bg-background px-3" />
          <select value={role} onChange={(e) => setRole(e.target.value as Position)} className="h-11 rounded-md border border-input bg-background px-2">
            {ALL_POSITIONS.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input placeholder="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-md border border-input bg-background px-3" />
          <input placeholder="Phone (optional)" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 rounded-md border border-input bg-background px-3" />
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <button onClick={add} className="h-11 px-4 rounded-md bg-primary text-primary-foreground font-medium">Add</button>
        <p className="text-xs text-muted-foreground">The role you pick is the person's primary position. Add more positions from the chips below after they're added. Email or phone is used to send the employee their tip report.</p>
      </div>

      <div className="flex gap-2">

        {([["active", "Active"], ["inactive", "Inactive"]] as const).map(([k, label]) => {
          const count = staff.filter((s) => (k === "active" ? s.active : !s.active)).length;
          return (
            <button
              key={k}
              onClick={() => setListView(k)}
              className={`h-9 px-3 rounded-md text-sm border ${listView === k ? "bg-primary text-primary-foreground border-primary" : "border-input text-muted-foreground"}`}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      <div className="bg-card border border-border rounded-lg divide-y divide-border">
        {visibleStaff.map((s) => (
          <div key={s.id} className={`p-3 space-y-2 ${s.active ? "" : "opacity-70"}`}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:gap-3">
              <div className="min-w-0 sm:flex-1 flex gap-2">
                <input
                  aria-label="Name"
                  defaultValue={s.name}
                  onBlur={(e) => { const v = e.target.value.trim(); if (!v) { e.target.value = s.name; return; } if (v !== s.name) saveContact(s, { name: v }); }}
                  className="h-9 min-w-0 flex-1 text-sm font-medium rounded-md border border-input bg-background px-2"
                />
                <input
                  aria-label="Server number"
                  placeholder="#"
                  defaultValue={s.server_number ?? ""}
                  onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== (s.server_number ?? null)) saveContact(s, { server_number: v }); }}
                  className="h-9 w-20 text-sm rounded-md border border-input bg-background px-2"
                />
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
              <button onClick={() => toggleManager(s)} className={`text-xs px-3 min-h-9 rounded ${s.is_manager ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground"}`} title="Managers can be excluded from tip pools via Settings">{s.is_manager ? "Manager" : "Staff"}</button>
              <button onClick={() => toggleActive(s)} className={`text-xs px-3 min-h-9 rounded ${s.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{s.active ? "Active" : "Inactive"}</button>
                <button onClick={() => remove(s)} className="text-xs text-destructive px-2 min-h-9">Remove</button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                placeholder="Email for tip report"
                type="email"
                defaultValue={s.email ?? ""}
                onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== (s.email ?? null)) saveContact(s, { email: v }); }}
                className="h-9 text-sm rounded-md border border-input bg-background px-2"
              />
              <input
                placeholder="Phone for tip report"
                type="tel"
                defaultValue={s.phone ?? ""}
                onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== (s.phone ?? null)) saveContact(s, { phone: v }); }}
                className="h-9 text-sm rounded-md border border-input bg-background px-2"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {ALL_POSITIONS.map((p) => {
                const on = s.positions.includes(p);

                return (
                  <button key={p} onClick={() => togglePosition(s, p)} className={`text-xs px-3 min-h-9 rounded-full border ${on ? "bg-primary text-primary-foreground border-primary" : "border-input text-muted-foreground"}`}>
                    {p.replace("_", " ")}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {visibleStaff.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-sm">
            {listView === "active" ? "No active staff yet." : "No inactive staff."}
          </div>
        )}
      </div>


      {showImport && <ImportDialog onClose={() => setShowImport(false)} onDone={() => { setShowImport(false); load(); }} />}
    </div>
  );
}

type ParsedRow = { name: string; server_number: string | null; email: string | null; phone: string | null; positions: Position[]; error?: string };

function ImportDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setErr(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "binary" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        const parsed: ParsedRow[] = json.map((r) => {
          const keys = Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim().toLowerCase(), v]));
          const name = String(keys["name"] ?? keys["full name"] ?? "").trim();
          const numRaw = keys["number"] ?? keys["server #"] ?? keys["server number"] ?? keys["#"] ?? "";
          const server_number = String(numRaw).trim() || null;
          const email = String(keys["email"] ?? keys["e-mail"] ?? keys["email address"] ?? "").trim() || null;
          const phone = String(keys["phone"] ?? keys["phone number"] ?? keys["mobile"] ?? keys["cell"] ?? "").trim() || null;
          const posRaw = String(keys["positions"] ?? keys["position"] ?? keys["role"] ?? keys["roles"] ?? "").trim();
          const posList = posRaw ? posRaw.split(/[,;|/]/).map((p) => normalizePosition(p)).filter((x): x is Position => !!x) : ["server" as Position];
          const positions = Array.from(new Set(posList));
          let error: string | undefined;
          if (!name) error = "Missing name";
          else if (positions.length === 0) error = "No valid positions";
          return { name, server_number, email, phone, positions, error };
        });
        setRows(parsed);
      } catch (e2) {
        setErr((e2 as Error).message);
      }
    };
    reader.readAsBinaryString(file);
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Name", "Number", "Positions", "Email", "Phone"],
      ["Jane Doe", "12", "server, bartender", "jane@example.com", "555-123-4567"],
      ["John Smith", "7", "runner, busser", "", "555-987-6543"],
      ["Alex Lee", "", "hostess", "alex@example.com", ""],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Staff");
    XLSX.writeFile(wb, "staff-template.xlsx");
  }

  async function doImport() {
    const valid = rows.filter((r) => !r.error);
    if (valid.length === 0) return;
    setImporting(true);
    setErr(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // get the user's location_id (first one they manage)
      const { data: loc } = await supabase.from("location_members").select("location_id").eq("user_id", user?.id ?? "").limit(1).maybeSingle();
      const location_id = loc?.location_id ?? null;

      const { data: inserted, error } = await supabase.from("staff").insert(
        valid.map((r) => ({
          name: r.name,
          server_number: r.server_number,
          email: r.email,
          phone: r.phone,
          role: r.positions[0],
          active: true,
          location_id,
        })),
      ).select("id");
      if (error) throw error;

      const posRows = (inserted ?? []).flatMap((s, i) => valid[i].positions.map((p) => ({ staff_id: s.id, position: p })));
      if (posRows.length) {
        const { error: e2 } = await supabase.from("staff_positions").upsert(posRows, { onConflict: "staff_id,position" });
        if (e2) throw e2;
      }
      onDone();
    } catch (e) {
      setErr((e as Error).message);
      setImporting(false);
    }
  }

  const validCount = rows.filter((r) => !r.error).length;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-background w-full sm:max-w-2xl sm:rounded-lg rounded-t-lg max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-serif text-lg">Import staff from Excel</h3>
          <button onClick={onClose} className="text-muted-foreground">×</button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          {rows.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Upload an .xlsx or .csv file. Columns: <span className="font-mono">Name</span>, <span className="font-mono">Number</span> (optional), <span className="font-mono">Positions</span> (comma-separated), <span className="font-mono">Email</span> (optional), <span className="font-mono">Phone</span> (optional).</p>
              <p className="text-xs text-muted-foreground">Valid positions: server, bartender, runner, busser, bar back, hostess.</p>
              <div className="flex gap-2">
                <button onClick={() => fileRef.current?.click()} className="h-11 px-4 rounded-md bg-primary text-primary-foreground font-medium">Choose file</button>
                <button onClick={downloadTemplate} className="h-11 px-4 rounded-md border border-input">Download template</button>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">{fileName} — {validCount} valid of {rows.length}</div>
              <div className="border border-border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary text-secondary-foreground text-xs">
                    <tr><th className="text-left px-2 py-1.5">Name</th><th className="text-left px-2 py-1.5">#</th><th className="text-left px-2 py-1.5">Positions</th><th className="text-left px-2 py-1.5">Contact</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className={`border-t border-border ${r.error ? "bg-destructive/5" : ""}`}>
                        <td className="px-2 py-1.5">{r.name || <span className="text-destructive">—</span>}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{r.server_number ?? "—"}</td>
                        <td className="px-2 py-1.5">
                          {r.error ? <span className="text-destructive text-xs">{r.error}</span> : r.positions.map((p) => p.replace("_", " ")).join(", ")}
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground text-xs">{r.email || r.phone || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
        {rows.length > 0 && (
          <div className="p-4 border-t border-border flex gap-2 justify-end">
            <button onClick={() => { setRows([]); setFileName(""); }} className="h-11 px-4 rounded-md border border-input">Start over</button>
            <button onClick={doImport} disabled={importing || validCount === 0} className="h-11 px-4 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50">
              {importing ? "Importing…" : `Import ${validCount}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsTab({ canEdit }: { canEdit: boolean }) {
  const [s, setS] = useState<Settings | null>(null);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    loadMySettings().then(async (data) => {
      setS(data as Settings | null);
      setLogoSrc(await resolveLogoUrl((data as Settings | null)?.logo_url));
    });
  }, []);

  async function save() {
    if (!s) return;
    setSaving(true);
    setMsg(null);
    const { error } = await supabase.from("app_settings").update({
      establishment_name: s.establishment_name,
      bar_tip_pct: s.bar_tip_pct,
      runner_busser_tip_pct: s.runner_busser_tip_pct,
      bartender_tip_pct: s.bartender_tip_pct,
      max_tipout_pct: s.max_tipout_pct,
      rb_basis: s.rb_basis ?? "tips",
      weight_runner: s.weight_runner,
      weight_busser: s.weight_busser,
      weight_bar_back: s.weight_bar_back,
      weight_hostess: s.weight_hostess,
      rounding_mode: s.rounding_mode,
      use_net_sales: s.use_net_sales,
      sales_tax_pct: s.sales_tax_pct,
      cc_fee_enabled: s.cc_fee_enabled,
      cc_fee_pct: s.cc_fee_pct,
      manager_exclusion_enabled: s.manager_exclusion_enabled,
      sms_enabled: s.sms_enabled,
      sms_from_number: s.sms_from_number || null,
      sms_include_breakdown: s.sms_include_breakdown,
      pay_period_type: s.pay_period_type,
      pay_period_anchor: s.pay_period_anchor || null,
    }).eq("location_id", s.location_id);
    setSaving(false);
    setMsg(error ? error.message : "Saved");
  }


  async function uploadLogo(file: File) {
    if (!s) return;
    const ext = file.name.split(".").pop() || "png";
    const path = `${s.location_id}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
    if (error) return setMsg(error.message);
    await supabase.from("app_settings").update({ logo_url: path }).eq("location_id", s.location_id);
    await supabase.from("locations").update({ logo_url: path }).eq("id", s.location_id);
    setS({ ...s, logo_url: path });
    setLogoSrc(await resolveLogoUrl(path));
    setMsg("Logo updated");
  }


  if (!s) return <p className="text-muted-foreground">Loading…</p>;

  const field = (label: string, val: number, pct: boolean, onChange: (n: number) => void) => (
    <div>
      <label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</label>
      <div className="relative">
        <input
          type="number"
          step={pct ? 1 : 0.1}
          min={pct ? 0 : undefined}
          value={pct ? Math.round(val * 1000) / 10 : val}
          onChange={(e) => {
            const raw = Number(e.target.value);
            onChange(pct ? (Number.isFinite(raw) ? Math.round(raw * 10) / 1000 : 0) : raw);
          }}
          className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3 pr-8"
        />
        {pct && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>}
      </div>
      {pct && <p className="text-xs text-muted-foreground mt-1">Enter as a whole percent (e.g. 5 = 5%)</p>}
    </div>
  );


  return (
    <fieldset disabled={!canEdit} className="space-y-4 block disabled:opacity-70">
      {!canEdit && (
        <div className="bg-muted border border-border rounded-lg p-3 text-sm text-muted-foreground">
          Settings are read-only for managers. Ask an owner or admin to make changes.
        </div>
      )}

      <div className="bg-card border border-border rounded-lg p-4 space-y-4">
        <h2 className="font-serif text-lg">Establishment</h2>
        <div>
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Name</label>
          <input value={s.establishment_name} onChange={(e) => setS({ ...s, establishment_name: e.target.value })} className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Logo</label>
          <div className="mt-2 flex items-center gap-3">
            {logoSrc && <img src={logoSrc} alt="Establishment logo" className="h-16 w-16 object-contain rounded border border-border" />}
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} className="text-sm" />
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h2 className="font-serif text-lg">Pay periods</h2>
        <p className="text-xs text-muted-foreground">Adds one-tap date presets to payroll reports.</p>
        <div className="flex flex-col gap-2">
          {(Object.keys(PAY_PERIOD_LABELS) as PayPeriodType[]).map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="pp" checked={(s.pay_period_type ?? "biweekly") === t} onChange={() => setS({ ...s, pay_period_type: t })} className="h-4 w-4" />
              {PAY_PERIOD_LABELS[t]}
            </label>
          ))}
        </div>
        {(s.pay_period_type === "weekly" || s.pay_period_type === "biweekly") && (
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">First day of a pay period</label>
            <input type="date" value={s.pay_period_anchor ?? ""} onChange={(e) => setS({ ...s, pay_period_anchor: e.target.value })} className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3" />
          </div>
        )}
      </div>


      <div className="bg-card border border-border rounded-lg p-4 space-y-4">
        <div>
          <h2 className="font-serif text-lg">Features</h2>
          <p className="text-xs text-muted-foreground mt-1">Turn optional rules on or off. Each is independent — off restores default behavior.</p>
        </div>

        <FeatureToggle
          label="Net vs. gross sales"
          desc="Treat entered LBW sales as gross (tax included) and strip sales tax before applying the bar tip percentage."
          on={s.use_net_sales}
          onChange={(v) => setS({ ...s, use_net_sales: v })}
        >
          {s.use_net_sales && (
            <div className="pt-2">
              {field("Sales tax %", s.sales_tax_pct, true, (n) => setS({ ...s, sales_tax_pct: n }))}
            </div>
          )}
        </FeatureToggle>

        <FeatureToggle
          label="Credit card fee recovery"
          desc="Deduct processing fees from credit tips before calculating tip-outs and take-home."
          on={s.cc_fee_enabled}
          onChange={(v) => setS({ ...s, cc_fee_enabled: v })}
        >
          {s.cc_fee_enabled && (
            <div className="pt-2">
              {field("Processing fee %", s.cc_fee_pct, true, (n) => setS({ ...s, cc_fee_pct: n }))}
            </div>
          )}
        </FeatureToggle>

        <FeatureToggle
          label="Exclude managers from tip pools"
          desc="Staff flagged as “Manager” on the Staff tab won't appear in shift entry selectors while this is on."
          on={s.manager_exclusion_enabled}
          onChange={(v) => setS({ ...s, manager_exclusion_enabled: v })}
        />
      </div>



      <div className="bg-card border border-border rounded-lg p-4 space-y-4">
        <h2 className="font-serif text-lg">Tip percentages</h2>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Support tip-out is calculated from</p>
          <div className="flex flex-col gap-2">
            {([
              { v: "tips", label: "Tips", desc: "% of credit card tips" },
              { v: "sales", label: "Gross sales", desc: "% of each person's total sales for the shift" },
            ] as const).map((opt) => (
              <label key={opt.v} className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={(s.rb_basis ?? "tips") === opt.v}
                  onChange={() => setS({ ...s, rb_basis: opt.v })}
                  className="mt-0.5 h-4 w-4 rounded border-input"
                />
                <span><span className="font-medium">{opt.label}</span> — <span className="text-muted-foreground">{opt.desc}</span></span>
              </label>
            ))}
          </div>
          {(s.rb_basis ?? "tips") === "sales" && (
            <p className="text-xs text-muted-foreground">Enter each server's and bartender's “Total sales” on the shift form so these percentages have a base.</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field("Bar tip (of LBW sales)", s.bar_tip_pct, true, (n) => setS({ ...s, bar_tip_pct: n }))}
          {field((s.rb_basis ?? "tips") === "sales" ? "Server R/B (of total sales)" : "Server R/B (of remaining tips)", s.runner_busser_tip_pct, true, (n) => setS({ ...s, runner_busser_tip_pct: n }))}
          {field((s.rb_basis ?? "tips") === "sales" ? "Bartender R/B (of total sales)" : "Bartender R/B (of credit tips)", s.bartender_tip_pct, true, (n) => setS({ ...s, bartender_tip_pct: n }))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field("Max total tip-out (of credit tips)", s.max_tipout_pct, true, (n) => setS({ ...s, max_tipout_pct: n }))}
        </div>
        <p className="text-xs text-muted-foreground">Caps the combined bar + support tip-out per person. Set to 1.00 (100%) to disable.</p>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h2 className="font-serif text-lg">Dollar rounding</h2>
        <p className="text-xs text-muted-foreground">How payouts are rounded to the nearest dollar.</p>
        <div className="flex flex-col gap-2">
          {([
            { v: "none", label: "Don't round (keep cents)" },
            { v: "nearest", label: "Round to nearest dollar" },
            { v: "up", label: "Always round up to next dollar" },
            { v: "down", label: "Always round down to dollar" },
          ] as const).map((opt) => (
            <label key={opt.v} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={(s.rounding_mode ?? "nearest") === opt.v}
                onChange={() => setS({ ...s, rounding_mode: opt.v })}
                className="h-4 w-4 rounded border-input"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 space-y-4">
        <h2 className="font-serif text-lg">Pool weights (× hours)</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {field("Runner", s.weight_runner, false, (n) => setS({ ...s, weight_runner: n }))}
          {field("Busser", s.weight_busser, false, (n) => setS({ ...s, weight_busser: n }))}
          {field("Bar back", s.weight_bar_back, false, (n) => setS({ ...s, weight_bar_back: n }))}
          {field("Hostess", s.weight_hostess, false, (n) => setS({ ...s, weight_hostess: n }))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h2 className="font-serif text-lg">Text tip reports</h2>
        <FeatureToggle
          label="Text each person their tip report"
          desc="Adds a “Text tip reports” button to the daily report. Each person gets only their own numbers, sent to the phone number on their staff record."
          on={!!s.sms_enabled}
          onChange={(v) => setS({ ...s, sms_enabled: v })}
        >
          {s.sms_enabled && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="text-xs uppercase tracking-wide text-muted-foreground">Sending phone number</label>
                <input
                  value={s.sms_from_number ?? ""}
                  onChange={(e) => setS({ ...s, sms_from_number: e.target.value })}
                  placeholder="+15125550123"
                  className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3"
                />
                <p className="text-xs text-muted-foreground mt-1">Your texting service's number, in +1 format.</p>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={s.sms_include_breakdown !== false}
                  onChange={(e) => setS({ ...s, sms_include_breakdown: e.target.checked })}
                  className="h-4 w-4 rounded border-input"
                />
                Include the full breakdown (tips, cash owed, tip-outs), not just take-home
              </label>
              <p className="text-xs text-muted-foreground">
                Texting isn't connected to a messaging service yet — the button will report that nothing was sent until it is.
              </p>
            </div>
          )}
        </FeatureToggle>
      </div>


      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      {canEdit && (
        <button onClick={save} disabled={saving} className="h-11 px-6 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50">
          {saving ? "Saving…" : "Save settings"}
        </button>
      )}
    </fieldset>

  );
}

function FeatureToggle({
  label, desc, on, onChange, children,
}: {
  label: string; desc: string; on: boolean; onChange: (v: boolean) => void; children?: ReactNode;
}) {
  return (
    <div className="border border-border rounded-md p-3">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="font-medium text-sm">{label}</div>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={() => onChange(!on)}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${on ? "bg-primary" : "bg-muted"}`}
        >
          <span className={`inline-block h-6 w-6 transform rounded-full bg-background transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
      </div>
      {children}
    </div>
  );
}


type InviteRow = { id: string; email: string; role: string; token: string; accepted_at: string | null; expires_at: string };
type MemberRow = { user_id: string; role: string };

function TeamTab() {
  const [locationId, setLocationId] = useState<string | null>(null);
  const [loc, setLoc] = useState<{ name: string; establishment_type: string | null; address: string | null; timezone: string; setup_steps: Record<string, boolean> | null; logo_url: string | null } | null>(null);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "staff">("manager");
  const [msg, setMsg] = useState<string | null>(null);
  const [staffCount, setStaffCount] = useState(0);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);

  async function load() {
    const id = await getMyLocationId();
    setLocationId(id);
    if (!id) return;
    const [{ data: l }, { data: inv }, { data: mem }, { count }, { data: settings }] = await Promise.all([
      supabase.from("locations").select("name, establishment_type, address, timezone, setup_steps, logo_url").eq("id", id).maybeSingle(),
      supabase.from("location_invites").select("id, email, role, token, accepted_at, expires_at").eq("location_id", id).order("created_at", { ascending: false }),
      supabase.from("location_members").select("user_id, role").eq("location_id", id),
      supabase.from("staff").select("id", { count: "exact", head: true }).eq("location_id", id),
      supabase.from("app_settings").select("logo_url").eq("location_id", id).maybeSingle(),
    ]);
    setLoc(l as never);
    setInvites((inv ?? []) as InviteRow[]);
    setMembers((mem ?? []) as MemberRow[]);
    setStaffCount(count ?? 0);
    const logoPath = (l as { logo_url?: string | null } | null)?.logo_url ?? settings?.logo_url ?? null;
    setLogoSrc(await resolveLogoUrl(logoPath));
  }

  async function uploadLogo(file: File) {
    if (!locationId) return;
    setMsg(null);
    const ext = file.name.split(".").pop() || "png";
    const path = `${locationId}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
    if (error) return setMsg(error.message);
    await Promise.all([
      supabase.from("app_settings").update({ logo_url: path }).eq("location_id", locationId),
      supabase.from("locations").update({ logo_url: path }).eq("id", locationId),
    ]);
    setLoc((prev) => prev ? { ...prev, logo_url: path, setup_steps: { ...prev.setup_steps, logo: true } } : prev);
    setLogoSrc(await resolveLogoUrl(path));
    setMsg("Logo updated");
  }

  useEffect(() => { load(); }, []);

  async function sendInvite() {
    setMsg(null);
    const e = email.trim().toLowerCase();
    if (!e.includes("@") || !locationId) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("location_invites").insert({ location_id: locationId, email: e, role, invited_by: user?.id ?? "" });
    if (error) return setMsg(error.message);
    setEmail("");
    setMsg("Invitation created — share the link below.");
    load();
  }

  async function revoke(id: string) {
    await supabase.from("location_invites").delete().eq("id", id);
    load();
  }

  async function saveProfile() {
    if (!locationId || !loc) return;
    const { error } = await supabase.from("locations").update({
      name: loc.name, establishment_type: loc.establishment_type, address: loc.address, timezone: loc.timezone,
    }).eq("id", locationId);
    setMsg(error ? error.message : "Establishment profile saved");
  }

  if (!loc) return <p className="text-muted-foreground">Loading…</p>;

  const steps = loc.setup_steps ?? {};
  const checklist = [
    { key: "profile", label: "Establishment profile", done: !!loc.name },
    { key: "logo", label: "Logo uploaded", done: !!steps.logo },
    { key: "team", label: "Invite managers or authorized users", done: invites.length > 0 || members.length > 1 },
    { key: "staff", label: "Add your staff", done: staffCount > 0 },
    { key: "pay_periods", label: "Pay period set", done: !!steps.pay_periods },
  ];
  const remaining = checklist.filter((c) => !c.done);

  return (
    <div className="space-y-4">
      {remaining.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="font-serif text-lg">Finish setting up</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {checklist.map((c) => (
              <li key={c.key} className={c.done ? "text-muted-foreground line-through" : "text-foreground"}>
                {c.done ? "✓" : "○"} {c.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h2 className="font-serif text-lg">Establishment profile</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Company name</label>
            <input value={loc.name} onChange={(e) => setLoc({ ...loc, name: e.target.value })} className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Type</label>
            <input value={loc.establishment_type ?? ""} onChange={(e) => setLoc({ ...loc, establishment_type: e.target.value })} className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Address</label>
            <input value={loc.address ?? ""} onChange={(e) => setLoc({ ...loc, address: e.target.value })} className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Time zone</label>
            <input value={loc.timezone} onChange={(e) => setLoc({ ...loc, timezone: e.target.value })} className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3" />
          </div>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-muted-foreground">Company logo</label>
          <div className="mt-2 flex items-center gap-3">
            {logoSrc
              ? <img src={logoSrc} alt="Establishment logo" className="h-16 w-16 object-contain rounded border border-border" />
              : <div className="h-16 w-16 rounded border border-dashed border-border flex items-center justify-center text-2xl">🍸</div>}
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} className="text-sm" />
          </div>
        </div>
        <button onClick={saveProfile} className="h-11 px-5 rounded-md bg-primary text-primary-foreground font-medium">Save profile</button>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h2 className="font-serif text-lg">Managers &amp; authorized users</h2>
        <p className="text-xs text-muted-foreground">{members.length} with access today.</p>
        <div className="flex gap-2">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className="flex-1 h-11 rounded-md border border-input bg-background px-3" />
          <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "manager" | "staff")} className="h-11 rounded-md border border-input bg-background px-2 text-sm">
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>

            <option value="staff">Staff</option>
          </select>
          <button onClick={sendInvite} className="h-11 px-4 rounded-md bg-primary text-primary-foreground font-medium">Invite</button>
        </div>
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
        <ul className="space-y-2">
          {invites.map((i) => (
            <li key={i.id} className="border border-border rounded-md p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span>{i.email} <span className="text-muted-foreground">· {i.role}</span></span>
                {i.accepted_at
                  ? <span className="text-xs text-emerald-600">Joined</span>
                  : <button onClick={() => revoke(i.id)} className="text-xs text-destructive">Revoke</button>}
              </div>
              {!i.accepted_at && (
                <button
                  onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/invite/${i.token}`)}
                  className="mt-1 text-xs text-primary underline"
                >
                  Copy invite link
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
