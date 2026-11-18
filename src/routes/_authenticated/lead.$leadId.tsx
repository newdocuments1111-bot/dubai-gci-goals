import { LEAD_SOURCES } from '@/lib/inbox';
import { createFileRoute, Link } from '@tanstack/react-router';
import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Suspense, useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getLeadThread, saveLeadToHubSpot, updateLead, recordContactConsent } from '@/lib/leads-app.functions';
import { Checkbox } from '@/components/ui/checkbox';
import { LeadChat } from '@/components/LeadChat';
import { LeadDocuments } from '@/components/LeadDocuments';
import { LeadDealPanel } from '@/components/LeadDealPanel';
import { CoachPanel } from '@/components/CoachPanel';
import { SendTemplatePanel } from '@/components/SendTemplatePanel';
import { useMembership } from '@/hooks/use-membership';
import { timezoneFromPhone } from '@/lib/leads-app';

const threadQuery = (id: string) => queryOptions({ queryKey: ['lead', id], queryFn: () => getLeadThread({ data: id }) });

export const Route = createFileRoute('/_authenticated/lead/$leadId')({
  head: () => ({ meta: [
    { title: 'Lead — Dubai AI GCI' }, { name: 'description', content: 'Lead conversation, documents and details.' },
    { property: 'og:title', content: 'Lead — Dubai AI GCI' }, { property: 'og:description', content: 'Owner-managed lead conversation.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' },
  ] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(threadQuery(params.leadId)),
  component: LeadPage,
});

function LeadPage() {
  const { leadId } = Route.useParams();
  const { data } = useSuspenseQuery(threadQuery(leadId));
  const { lead, messages } = data;
  const client = useQueryClient();
  const update = useServerFn(updateLead), toHubSpot = useServerFn(saveLeadToHubSpot), consent = useServerFn(recordContactConsent);
  const [name, setName] = useState(lead.name), [phone, setPhone] = useState(lead.phone), [source, setSource] = useState(lead.source);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const refresh = () => client.invalidateQueries({ queryKey: ['lead', leadId] });
  const membership = useMembership();

  return <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
    <Button asChild variant="ghost" className="mb-4 px-0"><Link to="/leads"><ArrowLeft className="size-4" />Back to leads</Link></Button>
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <h1 className="text-2xl font-bold">{lead.name || 'Unnamed lead'}</h1>
      <span className="rounded bg-muted px-2 py-0.5 text-xs">{lead.score}</span>
      <span className="rounded bg-muted px-2 py-0.5 text-xs">{lead.type}</span>
    </div>
    <section className="mb-4 grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-4">
      <label className="text-sm">Name<Input className="mt-1" maxLength={200} value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="text-sm">Phone<Input className="mt-1" maxLength={50} value={phone} onChange={e => setPhone(e.target.value)} /></label>
      <label className="text-sm">Source<select aria-label="Source" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={source} onChange={e => setSource(e.target.value)}>
        {LEAD_SOURCES.map(s => <option key={s}>{s}</option>)}
      </select></label>
      <div className="flex items-end gap-2">
        <Button variant="outline" disabled={busy} onClick={async () => { setBusy(true);
          try { await update({ data: { id: leadId, name, phone, source: source as 'Other', timezone: timezoneFromPhone(phone) } }); refresh(); } finally { setBusy(false); } }}>
          <Save className="size-4" />Save
        </Button>
        {membership.isHq && <Button variant="outline" disabled={busy} onClick={async () => { setBusy(true); setError(''); setMessage('');
          try { await toHubSpot({ data: leadId }); setMessage('Saved to HubSpot with the chat summary.'); }
          catch (e) { setError(e instanceof Error ? e.message : 'Could not save to HubSpot.'); } finally { setBusy(false); } }}>
          Save to HubSpot
        </Button>}
      </div>
      {message && <p role="status" className="text-sm text-primary sm:col-span-4">{message}</p>}
      {error && <p role="alert" className="text-sm text-destructive sm:col-span-4">{error}</p>}
    </section>
    <section aria-label="Lead record" className="mb-4 rounded-lg border border-border p-4 text-sm">
      <h2 className="mb-1 font-semibold">Lead record <span className="text-xs font-normal text-muted-foreground">— fills itself from every chat</span></h2>
      <dl className="grid gap-2 sm:grid-cols-5">
        {([['Area', lead.area], ['Budget', lead.budget], ['Timing', lead.timing], ['Score', lead.score], ['Next step', lead.next_step]] as const).map(([k, v]) =>
          <div key={k} className={k === 'Next step' ? 'sm:col-span-5' : ''}><dt className="text-xs text-muted-foreground">{k}</dt><dd>{v || '—'}</dd></div>)}
      </dl>
    </section>
    <LeadDealPanel lead={lead} onChanged={refresh} />
    <LeadChat lead={lead} messages={messages} onChanged={refresh} playAsClient />
    {messages.some(m => m.role === 'owner') && <CoachPanel leadId={leadId} />}
    <label className="mt-4 flex items-center gap-2 text-sm"><Checkbox checked={lead.opted_in} disabled={busy || lead.stopped} onCheckedChange={async value => {
      setBusy(true); setError('');
      try { await consent({ data: { id: leadId, agreed: value === true } }); refresh(); }
      catch (e) { setError(e instanceof Error ? e.message : 'Could not record consent.'); }
      finally { setBusy(false); }
    }} />Client agreed to future property check-ins</label>
    <SendTemplatePanel lead={lead} />
    <div className="mt-4"><Suspense fallback={<p className="text-sm text-muted-foreground">Loading documents…</p>}><LeadDocuments lead={lead} /></Suspense></div>
  </main>;
}
