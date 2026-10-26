import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/welcome")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Welcome — set your password — Dubai AI GCI" },
      { name: "description", content: "You were invited to an agency on Dubai AI GCI. Set your password to start." },
      { property: "og:title", content: "Welcome to Dubai AI GCI" },
      { property: "og:description", content: "Set your password to join your agency." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WelcomePage,
});

/** Invited agents and owners land here from the invite email and choose a password. */
function WelcomePage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<boolean | null>(null);
  const [agency, setAgency] = useState("");
  const [password, setPassword] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      setReady(Boolean(data.session));
      setAgency(((data.session?.user.user_metadata ?? {}) as { agency_name?: string }).agency_name ?? "");
    };
    void check();
    const { data } = supabase.auth.onAuthStateChange((event) => { if (event === "SIGNED_IN") void check(); });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError("");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(/weak|pwned|leaked/i.test(error.message) ? "Choose a stronger password — this one is too easy to guess." : "Could not save your password. Please try again.");
    navigate({ to: "/dashboard", replace: true });
  };

  return <main className="flex min-h-screen items-center justify-center bg-background px-4">
    {ready === null && <p className="text-sm text-muted-foreground">Checking your invite…</p>}
    {ready === false && <div className="max-w-sm space-y-3 text-center"><p>This invite link has expired or was already used. Ask your owner to invite you again, or sign in.</p><Button asChild><Link to="/auth">Sign in</Link></Button></div>}
    {ready && <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6">
      <div><h1 className="text-2xl font-bold">Welcome{agency ? ` to ${agency}` : ""}</h1><p className="mt-1 text-sm text-muted-foreground">Choose a password for your login.</p></div>
      <label className="block"><span className="text-xs font-medium text-muted-foreground">New password</span>
        <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" /></label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save password and start"}</Button>
    </form>}
  </main>;
}
