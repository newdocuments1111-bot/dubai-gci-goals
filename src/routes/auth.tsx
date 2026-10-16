import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { isOwnerEmail } from "@/lib/owner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Owner login — Dubai AI GCI" },
      { name: "description", content: "Owner sign-in for the Dubai AI GCI lead finder." },
      { property: "og:title", content: "Owner login — Dubai AI GCI" },
      { property: "og:description", content: "Owner sign-in for the Dubai AI GCI lead finder." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isOwnerEmail(email)) return setError("Only the owner can sign in.");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) return setError("Wrong email or password.");
    navigate({ to: "/", replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6">
        <div>
          <h1 className="text-2xl font-bold">Owner login</h1>
          <p className="mt-1 text-sm text-muted-foreground">Private access to your real HubSpot leads.</p>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Email</span>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Password</span>
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" />
        </label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
        <Link to="/" className="block text-center text-sm text-muted-foreground underline">Back to calculator</Link>
      </form>
    </main>
  );
}
