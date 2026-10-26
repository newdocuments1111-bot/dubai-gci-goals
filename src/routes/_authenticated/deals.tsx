import { createFileRoute, Link } from '@tanstack/react-router';
import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { FileText } from 'lucide-react';
import { listDeals, setDealStatus } from '@/lib/deals.functions';
import { PaperworkDialog } from '@/components/PaperworkDialog';
import { Button } from '@/components/ui/button';

export const dealsQuery = queryOptions({ queryKey: ['deals'], queryFn: () => listDeals() });
const aed = (n: number) => `AED ${Math.round(n).toLocaleString('en-US')}`;

export const Route = createFileRoute('/_authenticated/deals')({
  head: () => ({ meta: [
    { title: 'Deals — Dubai AI GCI' }, { name: 'description', content: 'Deals with GCI, agent share and agency share.' },
    { property: 'og:title', content: 'Deals — Dubai AI GCI' }, { property: 'og:description', content: 'Track deals and commission for your agency.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(dealsQuery),
  component: DealsPage,
});

function DealsPage() {
  const { data } = useSuspenseQuery(dealsQuery);
  const setStatus = useServerFn(setDealStatus);
  const client = useQueryClient();
  const [paperwork, setPaperwork] = useState<string | null>(null);
  const [error, setError] = useState('');
  const closed = data.deals.filter(d => d.status === 'closed');
  return <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <h1 className="mb-2 text-3xl font-bold">Deals</h1>
    <p className="mb-6 text-sm text-muted-foreground">GCI = price × commission %. Agent share = GCI × the agent's split %. Agency share = GCI − agent share. Turn a lead into a deal from its lead page.</p>
    <section className="mb-6 grid gap-4 sm:grid-cols-3">
      <div className="rounded-lg border border-border p-4"><p className="text-2xl font-bold">{aed(closed.reduce((a, d) => a + d.gci, 0))}</p><p className="text-sm text-muted-foreground">Closed GCI (all time)</p></div>
      <div className="rounded-lg border border-border p-4"><p className="text-2xl font-bold">{aed(closed.reduce((a, d) => a + d.agentShare, 0))}</p><p className="text-sm text-muted-foreground">Agent share</p></div>
      <div className="rounded-lg border border-border p-4"><p className="text-2xl font-bold">{aed(closed.reduce((a, d) => a + d.agencyShare, 0))}</p><p className="text-sm text-muted-foreground">Agency share</p></div>
    </section>
    {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
    {data.deals.length === 0 ? <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No deals yet. Open a lead and choose “Turn into a deal”.</p> :
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground"><tr><th className="p-2">Client</th><th>Agent</th><th>Type</th><th>Price</th><th>Comm.</th><th>GCI</th><th>Agent share</th><th>Agency share</th><th>Status</th><th></th></tr></thead>
          <tbody>{data.deals.map(d => (
            <tr key={d.id} className="border-t border-border">
              <td className="p-2">{d.lead_id ? <Link className="underline" to="/lead/$leadId" params={{ leadId: d.lead_id }}>{(d.leads as { name: string } | null)?.name || 'Lead'}</Link> : '—'}
                {d.ai_handled && <span className="ml-1 rounded bg-primary/10 px-1.5 text-xs text-primary">AI-handled</span>}
                {d.listings && <div className="text-xs text-muted-foreground">{(d.listings as { title: string }).title}</div>}</td>
              <td>{d.agentName}</td><td className="capitalize">{d.deal_type}</td><td>{aed(d.price_aed)}</td><td>{d.commission_percent}%</td>
              <td className="font-medium">{aed(d.gci)}</td><td>{aed(d.agentShare)} <span className="text-xs text-muted-foreground">({d.splitPercent}%)</span></td><td>{aed(d.agencyShare)}</td>
              <td><select aria-label="Deal status" className="rounded-md border border-input bg-background px-2 py-1 text-sm" value={d.status}
                onChange={async e => { setError(''); try { await setStatus({ data: { id: d.id, status: e.target.value as 'closed' } }); await client.invalidateQueries({ queryKey: dealsQuery.queryKey }); client.invalidateQueries({ queryKey: ['home'] }); } catch { setError('Only the deal’s agent or the owner can change it.'); } }}>
                {['under offer', 'closed', 'fell through'].map(s => <option key={s} value={s}>{s}</option>)}</select>
                {d.closed_at && <div className="text-xs text-muted-foreground">{new Date(d.closed_at).toLocaleDateString('en-GB', { timeZone: 'Asia/Dubai' })}</div>}</td>
              <td className="pr-2"><Button variant="ghost" size="sm" onClick={() => setPaperwork(d.id)}><FileText className="size-4" />Paperwork</Button></td>
            </tr>))}</tbody>
        </table>
      </div>}
    {paperwork && <PaperworkDialog dealId={paperwork} onClose={() => setPaperwork(null)} />}
  </main>;
}
