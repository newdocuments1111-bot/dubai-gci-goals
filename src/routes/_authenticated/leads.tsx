import { createFileRoute, Link } from '@tanstack/react-router';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createLead, listLeads } from '@/lib/leads-app.functions';
import { timezoneFromPhone } from '@/lib/leads-app';
import { useNavigate } from '@tanstack/react-router';

export const leadsQuery = queryOptions({ queryKey: ['leads'], queryFn: () => listLeads() });

export const Route = createFileRoute('/_authenticated/leads')({
  head: () => ({ meta: [
    { title: 'Leads — Dubai AI GCI' }, { name: 'description', content: 'Every conversation as a lead with type, score, source and full chat.' },
    { property: 'og:title', content: 'Leads — Dubai AI GCI' }, { property: 'og:description', content: 'Owner-managed leads and conversations.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(leadsQuery),
  component: LeadsPage,
});

const SCORE_STYLE = { Hot: 'bg-destructive/15 text-destructive', Warm: 'bg-warning/15 text-warning-foreground', Cold: 'bg-muted text-muted-foreground' } as const;

function LeadsPage() {
  const { data: leads } = useSuspenseQuery(leadsQuery);
  const create = useServerFn(createLead);
  const navigate = useNavigate();
  const [name, setName] = useState(''), [phone, setPhone] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');

  return <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
    <h1 className="mb-2 text-3xl font-bold">Leads</h1>
    <p className="mb-6 text-sm text-muted-foreground">Every conversation becomes a lead. Hot first. Scores use the same 3 signs as the Lead Finder: budget, location, move-in time.</p>
    <section className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-border p-4">
      <label className="text-sm">Name<Input className="mt-1 w-48" maxLength={200} value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="text-sm">Phone (with country code)<Input className="mt-1 w-48" maxLength={50} placeholder="+971…" value={phone} onChange={e => setPhone(e.target.value)} /></label>
      <Button disabled={busy || !name.trim()} onClick={async () => { setBusy(true); setError('');
        try { const lead = await create({ data: { name, phone, type: 'buyer', source: 'Other', timezone: timezoneFromPhone(phone) } }); navigate({ to: '/lead/$leadId', params: { leadId: lead.id } }); }
        catch { setError('Could not create the lead.'); } finally { setBusy(false); } }}>
        <Plus className="size-4" />New lead
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
    {leads.length === 0 && <p className="text-sm text-muted-foreground">No leads yet. Start a conversation in Test Chat or add one above.</p>}
    <div className="space-y-3">{leads.map(lead => {
      const learned = lead.learned as Record<string, unknown>;
      return <Link key={lead.id} to="/lead/$leadId" params={{ leadId: lead.id }} className="block rounded-lg border border-border p-4 hover:border-primary">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{lead.name || 'Unnamed lead'}</span>
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${SCORE_STYLE[lead.score as keyof typeof SCORE_STYLE]}`}>{lead.score === 'Hot' ? '🔥 Hot' : lead.score === 'Warm' ? '🟡 Warm' : '❄️ Cold'}</span>
          <span className="rounded bg-muted px-2 py-0.5 text-xs">{lead.type}</span>
          <span className="rounded bg-muted px-2 py-0.5 text-xs">{lead.source}</span>
          {lead.flagged && <span className="rounded bg-warning/15 px-2 py-0.5 text-xs text-warning-foreground">Needs your confirmation</span>}
          {lead.ai_paused && <span className="rounded bg-muted px-2 py-0.5 text-xs">You are replying</span>}
          {lead.stopped && <span className="rounded bg-muted px-2 py-0.5 text-xs">Stopped</span>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {['budget', 'location', 'move_in'].map(k => learned[k] ? `${k.replace('_', ' ')}: ${String(learned[k])}` : null).filter(Boolean).join(' · ') || 'Nothing learned yet'}
        </p>
      </Link>;
    })}</div>
  </main>;
}
