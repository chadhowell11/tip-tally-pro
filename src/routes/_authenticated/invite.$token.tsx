import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/invite/$token")({
  head: () => ({
    meta: [
      { title: "Accept invitation · Tip Share" },
      { name: "description", content: "Join your restaurant's tip share workspace." },
    ],
  }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token } = useParams({ from: "/_authenticated/invite/$token" });
  const navigate = useNavigate();
  const [status, setStatus] = useState<"working" | "error">("working");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { error } = await supabase.rpc("accept_location_invite", { _token: token });
      if (error) { setErr(error.message); setStatus("error"); return; }
      navigate({ to: "/" });
    })();
  }, [token, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-lg p-6 text-center space-y-3">
        {status === "working" ? (
          <p className="text-muted-foreground">Joining your team…</p>
        ) : (
          <>
            <h1 className="text-xl font-serif">Invitation problem</h1>
            <p className="text-sm text-destructive">{err}</p>
            <button onClick={() => navigate({ to: "/onboarding" })} className="w-full h-11 rounded-md bg-primary text-primary-foreground font-medium">
              Set up my own establishment
            </button>
          </>
        )}
      </div>
    </div>
  );
}
