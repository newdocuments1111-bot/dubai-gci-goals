import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — Dubai AI GCI" },
      { name: "description", content: "Choose a new password for your Dubai AI GCI account." },
      { property: "og:title", content: "Set a new password — Dubai AI GCI" },
      { property: "og:description", content: "Password reset for the Dubai AI GCI assistant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

const field = "mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<"checking" | "yes" | "no">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // The email link signs the user in with a short-lived recovery session.
    const isRecoveryLink = /type=recovery/.test(window.location.hash) || /type=recovery|code=/.test(window.location.search);
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && isRecoveryLink)) setReady("yes");
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && isRecoveryLink) setReady("yes");
      else setTimeout(() => setReady(r => (r === "checking" ? "no" : r)), 2500);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(/weak|pwned|leaked/i.test(error.message) ? "Choose a stronger password — this one is too easy to guess." : /same/i.test(error.message) ? "Choose a password different from your old one." : "Could not update your password. Please request a new reset link.");
    setDone(true);
    setTimeout(() => navigate({ to: "/dashboard", replace: true }), 1500);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6">
        <div>
          <h1 className="text-2xl font-bold">Set a new password</h1>
          <p className="mt-1 text-sm text-muted-foreground">Choose a new password for your account.</p>
        </div>
        {ready === "checking" && <p role="status" className="text-sm text-muted-foreground">Checking your reset link…</p>}
        {ready === "no" && <p role="alert" className="text-sm text-destructive">This reset link is invalid or has expired. Please request a new one from the sign-in page.</p>}
        {ready === "yes" && !done && <>
          <label className="block"><span className="text-xs font-medium text-muted-foreground">New password</span>
            <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} /></label>
          <label className="block"><span className="text-xs font-medium text-muted-foreground">Repeat new password</span>
            <input type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={field} /></label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : "Save new password"}</Button>
        </>}
        {done && <p role="status" className="text-sm text-primary">Password updated. Taking you to your dashboard…</p>}
        <Link to="/auth" className="block text-center text-sm text-muted-foreground underline">Back to sign in</Link>
      </form>
    </main>
  );
}
