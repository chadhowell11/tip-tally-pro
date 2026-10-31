import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PAY_PERIOD_LABELS, type PayPeriodType } from "@/lib/location";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your establishment · Tip Share" },
      { name: "description", content: "Create your establishment, add your team and choose pay periods." },
    ],
  }),
  component: OnboardingPage,
});

const TYPES = ["Restaurant", "Bar / Tavern", "Brewery", "Nightclub", "Hotel / Resort", "Other"];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
];

type Invite = { email: string; role: "manager" | "staff" };

const ALL_POSITIONS = ["server", "bartender", "runner", "busser", "bar_back", "hostess"] as const;
type Position = (typeof ALL_POSITIONS)[number];
type NewStaff = { name: string; server_number: string; positions: Position[] };

const STEPS = ["Establishment", "Logo", "Team", "Pay periods", "Tip rules", "Staff"] as const;

function OnboardingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pendingInvite, setPendingInvite] = useState<{ token: string; role: string } | null>(null);

  // Step 1
  const [name, setName] = useState("");
  const [type, setType] = useState(TYPES[0]);
  const [address, setAddress] = useState("");
  const [tz, setTz] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
  );

  // Step 2
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Step 3
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"manager" | "staff">("manager");

  // Step 4
  const [payType, setPayType] = useState<PayPeriodType>("biweekly");
  const [anchor, setAnchor] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // Step 5
  const [barPct, setBarPct] = useState(0.1);
  const [rbPct, setRbPct] = useState(0.15);
  const [maxPct, setMaxPct] = useState(0.3);

  // Step 6 — staff (required)
  const [staffList, setStaffList] = useState<NewStaff[]>([]);
  const [sName, setSName] = useState("");
  const [sNum, setSNum] = useState("");
  const [sPositions, setSPositions] = useState<Position[]>(["server"]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("location_members")
        .select("location_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (data?.location_id) {
        navigate({ to: "/admin" });
        return;
      }
      // Someone may have invited them instead — offer to join that team.
      const { data: inv } = await supabase
        .from("location_invites")
        .select("token, role")
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString())
        .limit(1)
        .maybeSingle();
      if (inv) setPendingInvite(inv as { token: string; role: string });
      setLoading(false);
    })();
  }, [navigate]);

  async function acceptInvite() {
    if (!pendingInvite) return;
    setSaving(true);
    setErr(null);
    const { error } = await supabase.rpc("accept_location_invite", { _token: pendingInvite.token });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    navigate({ to: "/" });
  }


  function pickLogo(file: File) {
    setLogo(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function addInvite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) return;
    if (invites.some((i) => i.email === email)) return;
    setInvites([...invites, { email, role: inviteRole }]);
    setInviteEmail("");
  }

  function addStaff() {
    const n = sName.trim();
    if (!n) { setErr("Enter a name."); return; }
    if (sPositions.length === 0) { setErr("Pick at least one position."); return; }
    setErr(null);
    setStaffList([...staffList, { name: n, server_number: sNum.trim(), positions: sPositions }]);
    setSName(""); setSNum(""); setSPositions(["server"]);
  }

  function togglePos(p: Position) {
    setSPositions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function finish() {
    setErr(null);
    if (!name.trim()) { setStep(0); setErr("Please enter your establishment name."); return; }
    if (staffList.length === 0) { setStep(5); setErr("Add at least one staff member to finish setup."); return; }
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErr("Not signed in."); setSaving(false); return; }

    const { data: loc, error: locErr } = await supabase
      .from("locations")
      .insert({
        name: name.trim(),
        owner_user_id: user.id,
        plan: "free",
        status: "active",
        establishment_type: type,
        address: address.trim() || null,
        timezone: tz,
      })
      .select("id")
      .single();
    if (locErr || !loc) { setErr(locErr?.message ?? "Could not create establishment"); setSaving(false); return; }

    const { error: memErr } = await supabase
      .from("location_members")
      .insert({ user_id: user.id, location_id: loc.id, role: "owner" });
    if (memErr) { setErr(memErr.message); setSaving(false); return; }

    let logoPath: string | null = null;
    if (logo) {
      const ext = logo.name.split(".").pop() || "png";
      const path = `${loc.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("logos").upload(path, logo, { upsert: true });
      if (!upErr) logoPath = path;
    }

    // A settings row is created automatically with the establishment.
    await supabase
      .from("app_settings")
      .update({
        establishment_name: name.trim(),
        logo_url: logoPath,
        pay_period_type: payType,
        pay_period_anchor: payType === "weekly" || payType === "biweekly" ? anchor : null,
        bar_tip_pct: barPct,
        runner_busser_tip_pct: rbPct,
        max_tipout_pct: maxPct,
      })
      .eq("location_id", loc.id);

    if (invites.length) {
      await supabase.from("location_invites").insert(
        invites.map((i) => ({ location_id: loc.id, email: i.email, role: i.role, invited_by: user.id })),
      );
    }

    const { data: insertedStaff, error: staffErr } = await supabase
      .from("staff")
      .insert(
        staffList.map((s) => ({
          location_id: loc.id,
          name: s.name,
          server_number: s.server_number || null,
          role: s.positions[0],
          active: true,
        })),
      )
      .select("id");
    if (staffErr) { setErr(staffErr.message); setSaving(false); return; }
    const posRows = (insertedStaff ?? []).flatMap((row, i) =>
      staffList[i].positions.map((p) => ({ staff_id: row.id, position: p })),
    );
    if (posRows.length) {
      await supabase.from("staff_positions").upsert(posRows, { onConflict: "staff_id,position" });
    }

    await supabase
      .from("locations")
      .update({
        setup_completed_at: new Date().toISOString(),
        setup_steps: {
          profile: true,
          logo: !!logoPath,
          team: invites.length > 0,
          pay_periods: true,
          tip_rules: true,
          staff: true,
        },
      })
      .eq("id", loc.id);

    navigate({ to: "/admin" });
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">…</div>;

  if (pendingInvite) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-card border border-border rounded-lg p-6 space-y-4">
          <h1 className="text-2xl font-serif">You've been invited</h1>
          <p className="text-sm text-muted-foreground">
            Your email has a pending invitation to join a team as <strong>{pendingInvite.role}</strong>.
          </p>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <button onClick={acceptInvite} disabled={saving} className="w-full h-11 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50">
            {saving ? "Joining…" : "Join the team"}
          </button>
          <button onClick={() => setPendingInvite(null)} className="w-full h-11 rounded-md border border-input text-sm">
            No thanks, set up my own establishment
          </button>
        </div>
      </div>
    );
  }


  const next = () => {
    if (step === 0 && !name.trim()) { setErr("Please enter your establishment name."); return; }
    setErr(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const pct = (label: string, val: number, set: (n: number) => void, hint: string) => (
    <div>
      <label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</label>
      <div className="relative">
        <input
          type="number"
          step={0.01}
          value={val}
          onChange={(e) => set(Number(e.target.value))}
          className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3"
        />
      </div>
      <p className="text-xs text-muted-foreground mt-1">{(val * 100).toFixed(1)}% — {hint}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto pt-8">
        <h1 className="text-2xl font-serif text-foreground">Welcome</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-5">
          A few quick questions and you're ready to run shifts. You can change anything later in Admin.
        </p>

        <div className="flex gap-1.5 mb-5">
          {STEPS.map((label, i) => (
            <div key={label} className="flex-1">
              <div className={`h-1.5 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
              <div className={`text-[10px] mt-1 ${i === step ? "text-foreground" : "text-muted-foreground"}`}>{label}</div>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          {step === 0 && (
            <>
              <h2 className="font-serif text-lg">Your establishment</h2>
              <div>
                <label className="text-xs uppercase tracking-wide text-muted-foreground">Company name</label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Carson's Tavern"
                  className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-muted-foreground">Type</label>
                <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3">
                  {TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-muted-foreground">Address (optional)</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-muted-foreground">Time zone</label>
                <select value={tz} onChange={(e) => setTz(e.target.value)} className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3">
                  {[...new Set([tz, ...TIMEZONES])].map((z) => <option key={z}>{z}</option>)}
                </select>
                <p className="text-xs text-muted-foreground mt-1">Used to decide which day a shift belongs to.</p>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="font-serif text-lg">Logo (optional)</h2>
              <p className="text-xs text-muted-foreground">Shows on your home screen and printed daily reports.</p>
              <div className="flex items-center gap-3">
                {logoPreview
                  ? <img src={logoPreview} alt="Logo preview" className="h-20 w-20 object-contain rounded border border-border" />
                  : <div className="h-20 w-20 rounded border border-dashed border-border flex items-center justify-center text-2xl">🍸</div>}
                <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && pickLogo(e.target.files[0])} className="text-sm" />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="font-serif text-lg">Managers &amp; authorized users</h2>
              <p className="text-xs text-muted-foreground">
                Invite anyone who should enter shifts or run reports. They'll get access when they sign up with this email.
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addInvite(); } }}
                  placeholder="name@example.com"
                  className="flex-1 h-11 rounded-md border border-input bg-background px-3"
                />
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as "manager" | "staff")} className="h-11 rounded-md border border-input bg-background px-2 text-sm">
                  <option value="manager">Manager</option>
                  <option value="staff">Staff</option>
                </select>
                <button type="button" onClick={addInvite} className="h-11 px-3 rounded-md bg-secondary text-secondary-foreground">Add</button>
              </div>
              <ul className="space-y-1">
                {invites.map((i) => (
                  <li key={i.email} className="flex items-center justify-between text-sm border border-border rounded-md px-3 h-10">
                    <span>{i.email} <span className="text-muted-foreground">· {i.role}</span></span>
                    <button type="button" onClick={() => setInvites(invites.filter((x) => x.email !== i.email))} className="text-destructive text-xs">Remove</button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="font-serif text-lg">Pay periods</h2>
              <p className="text-xs text-muted-foreground">Reports get one-tap buttons for the current and last pay period.</p>
              <div className="flex flex-col gap-2">
                {(Object.keys(PAY_PERIOD_LABELS) as PayPeriodType[]).map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm cursor-pointer border border-border rounded-md px-3 h-11">
                    <input type="radio" name="payperiod" checked={payType === t} onChange={() => setPayType(t)} className="h-4 w-4" />
                    {PAY_PERIOD_LABELS[t]}
                  </label>
                ))}
              </div>
              {(payType === "weekly" || payType === "biweekly") && (
                <div>
                  <label className="text-xs uppercase tracking-wide text-muted-foreground">First day of a pay period</label>
                  <input type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3" />
                </div>
              )}
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="font-serif text-lg">Tip rules</h2>
              <p className="text-xs text-muted-foreground">Starting defaults — fine-tune them any time in Admin → Settings.</p>
              {pct("Bar tip-out", barPct, setBarPct, "of liquor/beer/wine sales")}
              {pct("Support tip-out", rbPct, setRbPct, "of remaining tips, split by runners/bussers/hostesses")}
              {pct("Max total tip-out", maxPct, setMaxPct, "cap on what any one person pays out")}
            </>
          )}


          {step === 5 && (
            <>
              <h2 className="font-serif text-lg">Add your staff</h2>
              <p className="text-xs text-muted-foreground">
                Required — add at least one person so you can enter a shift. Server numbers keep same-name people apart. You can bulk-import from Excel later in Admin → Staff.
              </p>
              <div className="flex gap-2">
                <input
                  value={sName}
                  onChange={(e) => setSName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStaff(); } }}
                  placeholder="Full name"
                  className="flex-1 h-11 rounded-md border border-input bg-background px-3"
                />
                <input
                  value={sNum}
                  onChange={(e) => setSNum(e.target.value)}
                  placeholder="Server #"
                  className="w-24 h-11 rounded-md border border-input bg-background px-3"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ALL_POSITIONS.map((p) => {
                  const on = sPositions.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePos(p)}
                      className={`h-8 px-3 rounded-full text-xs border ${on ? "bg-primary text-primary-foreground border-primary" : "border-input text-muted-foreground"}`}
                    >
                      {p.replace("_", " ")}
                    </button>
                  );
                })}
              </div>
              <button type="button" onClick={addStaff} className="h-11 w-full rounded-md bg-secondary text-secondary-foreground font-medium">Add staff member</button>
              <ul className="space-y-1">
                {staffList.map((s, i) => (
                  <li key={`${s.name}-${i}`} className="flex items-center justify-between text-sm border border-border rounded-md px-3 py-2">
                    <span>
                      {s.name}
                      {s.server_number && <span className="text-muted-foreground"> · #{s.server_number}</span>}
                      <span className="text-muted-foreground"> · {s.positions.map((p) => p.replace("_", " ")).join(", ")}</span>
                    </span>
                    <button type="button" onClick={() => setStaffList(staffList.filter((_, x) => x !== i))} className="text-destructive text-xs">Remove</button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>

        <div className="flex gap-2 mt-4">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} className="h-11 px-4 rounded-md border border-input">Back</button>
          )}
          {step < STEPS.length - 1 ? (
            <button onClick={next} className="flex-1 h-11 rounded-md bg-primary text-primary-foreground font-medium">Continue</button>
          ) : (
            <button onClick={finish} disabled={saving || staffList.length === 0} className="flex-1 h-11 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50">
              {saving ? "Setting up…" : "Finish setup"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
