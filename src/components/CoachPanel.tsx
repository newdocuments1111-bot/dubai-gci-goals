import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { coachChat } from '@/lib/leads-app.functions';

type Result = Awaited<ReturnType<typeof coachChat>>;

/** "Coach me" — the AI reviews the agent's own replies and suggests 2–3 better ones. */
export function CoachPanel({ leadId }: { leadId: string }) {
  const coach = useServerFn(coachChat);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <section aria-label="Chat coaching" className="mt-4 rounded-lg border border-border p-4">
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="mr-auto font-semibold">Chat coaching</h2>
      <Button variant="outline" size="sm" disabled={busy} onClick={async () => { setBusy(true); setError('');
        try { setResult(await coach({ data: leadId })); } catch (e) { setError(e instanceof Error ? e.message : 'Coaching failed.'); } finally { setBusy(false); } }}>
        <GraduationCap className="size-4" />{busy ? 'Reviewing…' : 'Coach me'}
      </Button>
    </div>
    <p className="mt-1 text-xs text-muted-foreground">Reviews the replies you wrote yourself and suggests better ones — human tone, no pressure, no promised prices.</p>
    {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    {result && <div className="mt-3 space-y-3 text-sm">
      <p>{result.summary}</p>
      {result.suggestions.map((s, i) => <div key={i} className="rounded-md bg-muted p-3">
        {s.instead_of && <p className="text-xs text-muted-foreground">Instead of: “{s.instead_of}”</p>}
        <p className="mt-1 font-medium">Try: “{s.try}”</p>
        {s.why && <p className="mt-1 text-xs text-muted-foreground">Why: {s.why}</p>}
      </div>)}
    </div>}
  </section>;
}
