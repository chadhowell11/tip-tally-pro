import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveLogoUrl } from "@/lib/location";
import { InstallPrompt } from "@/components/install-prompt";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tip Share Calculator" },
      { name: "description", content: "Enter shift tips and run payroll-ready reports." },
    ],
  }),
  component: Home,
});

function Home() {
  const [settings, setSettings] = useState<{ establishment_name: string; logo_url: string | null } | null>(null);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("app_settings")
      .select("establishment_name, logo_url")
      .limit(1)
      .maybeSingle()
      .then(async ({ data }) => {
        setSettings(data ?? { establishment_name: "Tip Share", logo_url: null });
        setLogoSrc(await resolveLogoUrl(data?.logo_url));
      });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto p-6 pt-12 flex flex-col items-center">
        {logoSrc ? (
          <img src={logoSrc} alt={`${settings?.establishment_name ?? "Establishment"} logo`} className="h-24 w-24 object-contain rounded-lg mb-4" />
        ) : (
          <div className="h-24 w-24 rounded-lg bg-secondary flex items-center justify-center mb-4">
            <span className="text-3xl">🍸</span>
          </div>
        )}
        <h1 className="text-3xl font-serif text-foreground text-center">
          {settings?.establishment_name ?? "Tip Share"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1 mb-10">Shift tip share calculator</p>

        <div className="w-full space-y-3">
          <Link
            to="/shift/new"
            className="block w-full h-16 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-lg font-medium shadow-sm"
          >
            + New Shift
          </Link>
          <Link
            to="/shifts"
            className="block w-full h-16 rounded-lg bg-secondary text-secondary-foreground flex items-center justify-center text-lg font-medium"
          >
            Edit Shift
          </Link>

          <Link
            to="/daily"
            className="block w-full h-16 rounded-lg bg-secondary text-secondary-foreground flex items-center justify-center text-lg font-medium"
          >
            Daily Report
          </Link>
          <Link
            to="/reports"
            className="block w-full h-16 rounded-lg bg-secondary text-secondary-foreground flex items-center justify-center text-lg font-medium"
          >
            Payroll Reports
          </Link>
          <Link
            to="/individual"
            className="block w-full h-16 rounded-lg bg-secondary text-secondary-foreground flex items-center justify-center text-lg font-medium"
          >
            Individual Summary
          </Link>

          <Link
            to="/trends"
            className="block w-full h-16 rounded-lg bg-secondary text-secondary-foreground flex items-center justify-center text-lg font-medium"
          >
            Tip Trends
          </Link>


          <Link
            to="/admin"
            className="block w-full h-12 rounded-lg border border-border text-foreground flex items-center justify-center text-sm"
          >
            Admin
          </Link>
        </div>

        <InstallPrompt />
      </div>
    </div>
  );
}
