import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuditPanel } from "@/components/audit-panel";
export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({
    meta: [
      { title: "Audit Log · Tip Share" },
      { name: "description", content: "Admin-only log of manually adjusted tip-outs and changes to default tip-share settings." },
      { property: "og:title", content: "Audit Log · Tip Share" },
      { property: "og:description", content: "Track every manual tip-out override and setting change, with who made it and when." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);

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
      setAllowed(mem.role === "owner" || mem.role === "admin");
      setChecked(true);
    })();
  }, [navigate]);

  if (!checked) return <div className="p-8 text-center text-muted-foreground">…</div>;
  if (!allowed) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">The audit log is only available to owners and admins.</p>
        <Link to="/" className="text-primary underline mt-2 inline-block">Go home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 bg-background border-b border-border z-10 print:hidden">
        <div className="max-w-5xl mx-auto p-4 flex items-center gap-3">
          <Link to="/admin" className="text-sm text-muted-foreground">← Admin</Link>
          <h1 className="text-lg font-serif flex-1">Audit Log</h1>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-4">
        <AuditPanel />
      </main>
    </div>
  );
}

