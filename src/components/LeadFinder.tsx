import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLeads } from "@/lib/leads.functions";
import type { Lead } from "@/lib/leads";
import { DEMO_LEADS } from "@/lib/demo-leads";

const BADGE = { hot: "Hot 🔥", warm: "Warm 🟡", cold: "Cold ❄️" } as const;
const SIGN_LABEL = { budget: "Budget", location: "Location", moveIn: "Move-in time" } as const;

export function LeadFinder({ isOwner }: { isOwner: boolean }) {
  const fetchLeads = useServerFn(getLeads);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchLeads();
      setError(r.error);
      if (!r.error) setLeads(r.leads);
    } catch {
      setError("Could not load leads.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOwner) {
    return (
      <section aria-label="Demo leads" className="mt-8 border-t border-border pt-6">
        <h2 className="text-xl font-semibold">Demo leads</h2>
        <p className="mt-1 inline-block rounded-md bg-muted px-2 py-1 text-xs font-semibold">Sample data – not real people</p>
        <p className="mt-2 text-sm text-muted-foreground">An example of how the AI lead finder scores leads by budget, location and move-in time.</p>
        <LeadCards leads={DEMO_LEADS} />
      </section>
    );
  }

  return (
    <section aria-label="AI lead finder" className="mt-8 border-t border-border pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">AI lead finder</h2>
          <p className="mt-1 text-sm text-muted-foreground">Reads your HubSpot contacts and notes for budget, location and move-in time.</p>
        </div>
        <Button onClick={load} disabled={loading}>
          {leads ? <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> : <Plug className="size-4" />}
          {loading ? "Reading leads…" : leads ? "Refresh leads" : "Connect HubSpot"}
        </Button>
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
      {leads && !leads.length && !error && <p className="mt-4 text-sm text-muted-foreground">No contacts found in HubSpot yet.</p>}

      {leads && leads.length > 0 && <LeadCards leads={leads} />}
    </section>
  );
}

function LeadCards({ leads }: { leads: Lead[] }) {
  return (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {leads.map((l) => {
            const found = (Object.keys(SIGN_LABEL) as (keyof typeof SIGN_LABEL)[]).filter((k) => l.signs[k]);
            const missing = (Object.keys(SIGN_LABEL) as (keyof typeof SIGN_LABEL)[]).filter((k) => !l.signs[k]);
            return (
              <li key={l.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{l.name}</p>
                    {l.email && <p className="truncate text-xs text-muted-foreground">{l.email}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${l.score === "hot" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>{BADGE[l.score]}</span>
                </div>
                <dl className="mt-3 space-y-1 text-sm">
                  {found.map((k) => <div key={k}><dt className="inline font-medium">✓ {SIGN_LABEL[k]}: </dt><dd className="inline text-muted-foreground">{l.signs[k]}</dd></div>)}
                </dl>
                {missing.length > 0 && <p className="mt-2 text-sm text-muted-foreground">Missing: {missing.map((k) => SIGN_LABEL[k]).join(", ")}</p>}
                <p className="mt-3 border-t border-border pt-2 text-sm"><span className="font-medium">Next step: </span>{l.nextStep}</p>
                {l.url && <a href={l.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-primary underline">Open in HubSpot</a>}
              </li>
            );
          })}
        </ul>
  );
}
