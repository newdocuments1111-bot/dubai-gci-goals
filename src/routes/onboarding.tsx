import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getAccess } from "@/lib/agency-access";
import { createMyAgency } from "@/lib/team.functions";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set up your agency — Dubai AI GCI" },
      { name: "description", content: "Name your agency to start using Dubai AI GCI with your team." },
      { property: "og:title", content: "Set up your agency — Dubai AI GCI" },
      { property: "og:description", content: "Create your agency in Dubai AI GCI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnboardingPage,
});

const field = "mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring";

function OnboardingPage() {
  const navigate = useNavigate();
  const create = useServerFn(createMyAgency);
  const [state, setState] = useState<"loading" | "signed-out" | "ready">("loading");
  const [name, setName] = useState(""), [yourName, setYourName] = useState("");
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return setState("signed-out");
      const membership = await getAccess(supabase, data.user.id).catch(() => null);
      if (membership) return navigate({ to: "/dashboard", replace: true });
      const meta = data.user.user_metadata as { agency_name?: string; display_name?: string };
      setName(meta.agency_name ?? ""); setYourName(meta.display_name ?? "");
      setState("ready");
    })();
  }, [navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const r = await create({ data: { name, displayName: yourName } });
      if ("error" in r) setError(r.error ?? "Could not create your agency.");
      else navigate({ to: "/dashboard", replace: true });
    } catch { setError("Could not create your agency. Please try again."); }
    finally { setBusy(false); }
  };

  return <main className="flex min-h-screen items-center justify-center bg-background px-4">
    {state === "loading" && <p className="text-sm text-muted-foreground">Loading…</p>}
    {state === "signed-out" && <div className="max-w-sm space-y-3 text-center"><p>Please sign in first to set up your agency.</p><Button asChild><Link to="/auth">Sign in</Link></Button></div>}
    {state === "ready" && <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6">
      <div><h1 className="text-2xl font-bold">Set up your agency</h1><p className="mt-1 text-sm text-muted-foreground">You'll be the owner. You can invite agents from the Team page.</p></div>
      <label className="block"><span className="text-xs font-medium text-muted-foreground">Agency name</span><input required maxLength={200} value={name} onChange={e => setName(e.target.value)} className={field} /></label>
      <label className="block"><span className="text-xs font-medium text-muted-foreground">Your name</span><input maxLength={200} value={yourName} onChange={e => setYourName(e.target.value)} className={field} /></label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy || !name.trim()}>{busy ? "Creating…" : "Create my agency"}</Button>
    </form>}
  </main>;
}
