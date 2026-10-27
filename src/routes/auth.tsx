import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in or create your agency — Dubai AI GCI" },
      { name: "description", content: "Sign in to Dubai AI GCI, or create a new agency account for your team." },
      { property: "og:title", content: "Sign in — Dubai AI GCI" },
      { property: "og:description", content: "Agency sign-in and sign-up for the Dubai AI GCI assistant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const field = "mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [yourName, setYourName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null); setNotice(null); setBusy(true);
    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
      setBusy(false);
      if (error) return setError(/rate|too many/i.test(error.message) ? "Too many attempts — please wait a few minutes and try again." : "Could not send the reset email. Please try again.");
      return setNotice("If an account exists for that email, a password reset link is on its way. Check your inbox.");
    }
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setBusy(false);
      if (error) return setError(/confirm/i.test(error.message) ? "Please confirm your email first — check your inbox." : "Wrong email or password.");
      return navigate({ to: "/dashboard", replace: true });
    }
    if (!agencyName.trim()) { setBusy(false); return setError("Enter your agency name."); }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { emailRedirectTo: `${window.location.origin}/onboarding`, data: { agency_name: agencyName.trim(), display_name: yourName.trim() } },
    });
    setBusy(false);
    if (error) return setError(/weak|pwned|leaked/i.test(error.message) ? "Choose a stronger password — this one is too easy to guess." : error.message);
    if (data.session) return navigate({ to: "/onboarding", replace: true });
    setNotice("Check your email and click the link to confirm. Then sign in to finish creating your agency.");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6">
        <div>
          <h1 className="text-2xl font-bold">{mode === "signin" ? "Sign in" : mode === "forgot" ? "Reset your password" : "Create your agency"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{mode === "signin" ? "Owners and agents sign in here." : mode === "forgot" ? "Enter your email and we'll send you a link to set a new password." : "You become the owner and can invite your agents."}</p>
        </div>
        {mode === "signup" && <>
          <label className="block"><span className="text-xs font-medium text-muted-foreground">Agency name</span>
            <input required maxLength={200} value={agencyName} onChange={(e) => setAgencyName(e.target.value)} className={field} /></label>
          <label className="block"><span className="text-xs font-medium text-muted-foreground">Your name</span>
            <input maxLength={200} value={yourName} onChange={(e) => setYourName(e.target.value)} className={field} /></label>
        </>}
        <label className="block"><span className="text-xs font-medium text-muted-foreground">Email</span>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} /></label>
        {mode !== "forgot" && <label className="block"><span className="text-xs font-medium text-muted-foreground">Password</span>
          <input type="password" required minLength={mode === "signup" ? 8 : undefined} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} className={field} /></label>}
        {mode === "signin" && <button type="button" className="-mt-2 block text-sm text-primary underline" onClick={() => { setMode("forgot"); setError(null); setNotice(null); }}>Forgot password?</button>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "forgot" ? "Send reset link" : "Create agency account"}</Button>
        <button type="button" className="block w-full text-center text-sm text-primary underline" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setNotice(null); }}>
          {mode === "signin" ? "New agency? Create an account" : mode === "forgot" ? "Back to sign in" : "Already have a login? Sign in"}
        </button>
        <Link to="/" className="block text-center text-sm text-muted-foreground underline">Back to calculator</Link>
      </form>
    </main>
  );
}
