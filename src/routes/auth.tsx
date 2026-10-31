import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { REMEMBER_KEY, REMEMBER_PW_KEY, clearRemembered } from "@/lib/remember";

// Set before leaving for Google; tells the page it is a return from Google sign-in.
const OAUTH_PENDING_KEY = "ttp-oauth-pending";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign In · Tip Share" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(() => (typeof window !== "undefined" ? localStorage.getItem(REMEMBER_KEY) ?? "" : ""));
  const [password, setPassword] = useState(() => (typeof window !== "undefined" ? localStorage.getItem(REMEMBER_PW_KEY) ?? "" : ""));
  const [remember, setRemember] = useState(() => (typeof window !== "undefined" ? !!localStorage.getItem(REMEMBER_KEY) : true));

  const [showPassword, setShowPassword] = useState(false);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);


  async function routePostAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: mem } = await supabase
      .from("location_members")
      .select("location_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    navigate({ to: mem?.location_id ? "/admin" : "/onboarding" });
  }

  useEffect(() => {
    (async () => {
      // Google sends errors back in the query string or the hash.
      const params = new URLSearchParams(
        window.location.search + "&" + window.location.hash.slice(1),
      );
      const oauthError = params.get("error_description") ?? params.get("error");
      // getSession waits for supabase-js to read a returned Google session from the URL.
      const { data } = await supabase.auth.getSession();
      const returningFromGoogle = sessionStorage.getItem(OAUTH_PENDING_KEY) === "1";
      sessionStorage.removeItem(OAUTH_PENDING_KEY);
      if (oauthError) {
        setErr(oauthError);
        return;
      }
      if (returningFromGoogle && data.session) {
        routePostAuth();
        return;
      }
      if (data.session?.user?.email) setSignedInEmail(data.session.user.email);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function switchAccount() {
    setErr(null);
    setLoading(true);
    await supabase.auth.signOut();
    clearRemembered();
    setSignedInEmail(null);
    setEmail("");
    setPassword("");
    setRemember(false);
    setMode("signup");
    setLoading(false);
  }


  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const result =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (result.error) return setErr(result.error.message);
    if (remember) {
      localStorage.setItem(REMEMBER_KEY, email);
      localStorage.setItem(REMEMBER_PW_KEY, password);
    } else {
      localStorage.removeItem(REMEMBER_KEY);
      localStorage.removeItem(REMEMBER_PW_KEY);
    }

    if (!result.data.session) {
      return setErr("Account created. Check your email to confirm, then sign in.");
    }
    routePostAuth();
  }


  async function signInGoogle() {
    setErr(null);
    // Supabase's own Google login: the browser goes to Google, then back to /auth with a session.
    sessionStorage.setItem(OAUTH_PENDING_KEY, "1");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth` },
    });
    if (error) {
      sessionStorage.removeItem(OAUTH_PENDING_KEY);
      setErr(error.message || "Google sign-in failed");
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-lg p-6 shadow-sm">
        <h1 className="text-2xl font-serif text-foreground mb-1">{mode === "signup" ? "Create Account" : "Sign In"}</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Managers and owners only. Shift entry requires sign-in.
        </p>

        {signedInEmail && (
          <div className="mb-4 rounded-md border border-border bg-secondary/50 p-3 space-y-2">
            <p className="text-sm text-foreground">
              You're already signed in as <strong>{signedInEmail}</strong>.
            </p>
            <div className="flex gap-2">
              <button onClick={routePostAuth} className="flex-1 h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium">
                Continue
              </button>
              <button onClick={switchAccount} disabled={loading} className="flex-1 h-10 rounded-md border border-input text-sm">
                Start a new account
              </button>
            </div>
          </div>
        )}


        <button
          onClick={signInGoogle}
          className="w-full h-11 rounded-md border border-input bg-background hover:bg-secondary flex items-center justify-center gap-2 font-medium text-sm mb-4"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.8.54-1.83.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 009 18z"/>
            <path fill="#FBBC05" d="M3.96 10.71A5.41 5.41 0 013.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 000 9c0 1.45.35 2.83.96 4.04l3-2.33z"/>
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 009 0 9 9 0 00.96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z"/>
          </svg>
          Continue with Google
        </button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center"><span className="bg-card px-2 text-xs text-muted-foreground uppercase tracking-wide">or</span></div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full h-11 rounded-md border border-input bg-background px-3"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Password</label>
            <div className="relative mt-1">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 rounded-md border border-input bg-background pl-3 pr-16"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-2 rounded text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Remember email &amp; password on this device (testing)
          </label>
          <p className="text-xs text-muted-foreground -mt-2">
            Stores your password in this browser in plain text. Turn off for shared devices.
          </p>

          {err && <p className="text-sm text-destructive">{err}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50"
          >
            {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 text-sm text-muted-foreground hover:text-foreground w-full text-center"
        >
          {mode === "signin" ? "First time? Create account" : "Have an account? Sign in"}
        </button>
        <Link to="/" className="block mt-4 text-sm text-center text-muted-foreground hover:text-foreground">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
