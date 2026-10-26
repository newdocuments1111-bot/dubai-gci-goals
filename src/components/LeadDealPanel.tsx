import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { FileText, Handshake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createDeal, getDealOptions } from '@/lib/deals.functions';
import { assignLead } from '@/lib/leads-app.functions';
import { dealMath, memberName } from '@/lib/agency';
import type { Lead } from '@/lib/leads-app';
import { PaperworkDialog } from './PaperworkDialog';

const aed = (n: number) => `AED ${Math.round(n).toLocaleString('en-US')}`;

/** Lead page tools: who owns the lead, turn it into a deal, and prepare paperwork. */
export function LeadDealPanel({ lead, onChanged }: { lead: Lead; onChanged: () => void }) {
  const { data } = useQuery({ queryKey: ['deal-options'], queryFn: () => getDealOptions() });
  const client = useQueryClient();
  const save = useServerFn(createDeal), assign = useServerFn(assignLead);
  const [open, setOpen] = useState(false), [paperwork, setPaperwork] = useState(false);
  const [dealType, setDealType] = useState<'sale' | 'rent'>(['tenant', 'landlord'].includes(lead.type) ? 'rent' : 'sale');
  const [listingId, setListingId] = useState(''), [price, setPrice] = useState(''), [commission, setCommission] = useState('2'), [status, setStatus] = useState<'under offer' | 'closed'>('under offer');
  const [agentId, setAgentId] = useState(lead.assigned_agent_id ?? '');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const isOwner = data?.access.isOwner ?? false;
  const split = data?.access.splitPercent ?? 50;
  const preview = dealMath({ price: Number(price.replace(/[^\d.]/g, '')) || 0, commissionPercent: Number(commission) || 0, splitPercent: split });

  return <section aria-label="Deal and paperwork" className="mb-4 rounded-lg border border-border p-4">
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="mr-auto font-semibold">Deal and paperwork</h2>
      {data && isOwner && <label className="flex items-center gap-2 text-sm">Agent
        <select aria-label="Assigned agent" className="rounded-md border border-input bg-background px-2 py-1 text-sm" value={lead.assigned_agent_id ?? ''}
          onChange={async e => { setError(''); try { await assign({ data: { id: lead.id, agentId: e.target.value } }); onChanged(); client.invalidateQueries({ queryKey: ['leads'] }); } catch (err) { setError(err instanceof Error ? err.message : 'Could not assign.'); } }}>
          {!lead.assigned_agent_id && <option value="">Unassigned</option>}
          {data.members.map(m => <option key={m.user_id} value={m.user_id}>{memberName(m)}</option>)}
        </select></label>}
      <Button variant="outline" size="sm" onClick={() => setOpen(o => !o)}><Handshake className="size-4" />Turn into a deal</Button>
      <Button variant="outline" size="sm" onClick={() => setPaperwork(true)}><FileText className="size-4" />Prepare paperwork</Button>
    </div>
    {open && data && <form className="mt-3 grid gap-3 sm:grid-cols-3" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); setMessage('');
      try {
        const r = await save({ data: { lead_id: lead.id, listing_id: listingId || null, deal_type: dealType, price_aed: Number(price.replace(/[^\d.]/g, '')) || 0, commission_percent: Number(commission) || 0, status, ...(isOwner && agentId ? { agent_id: agentId } : {}) } });
        if ('error' in r) setError(r.error ?? 'Could not save the deal.'); else { setMessage('Deal saved. See it on the Deals page.'); setOpen(false); client.invalidateQueries({ queryKey: ['deals'] }); client.invalidateQueries({ queryKey: ['home'] }); }
      } finally { setBusy(false); } }}>
      <label className="text-sm">Deal type<select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={dealType} onChange={e => setDealType(e.target.value as 'sale')}><option value="sale">Sale</option><option value="rent">Rent</option></select></label>
      <label className="text-sm">Listing (optional)<select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={listingId}
        onChange={e => { setListingId(e.target.value); const l = data.listings.find(x => x.id === e.target.value); if (l && !price) setPrice(String(l.price_aed)); }}>
        <option value="">No listing</option>{data.listings.map(l => <option key={l.id} value={l.id}>{l.title} ({l.status})</option>)}</select></label>
      <label className="text-sm">{dealType === 'rent' ? 'Annual rent (AED)' : 'Price (AED)'}<Input className="mt-1" required inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)} /></label>
      <label className="text-sm">Commission %<Input className="mt-1" type="number" min={0} max={100} step={0.1} value={commission} onChange={e => setCommission(e.target.value)} /></label>
      <label className="text-sm">Status<select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={status} onChange={e => setStatus(e.target.value as 'closed')}><option value="under offer">Under offer</option><option value="closed">Closed</option></select></label>
      {isOwner && <label className="text-sm">Deal agent<select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={agentId} onChange={e => setAgentId(e.target.value)}>
        {data.members.map(m => <option key={m.user_id} value={m.user_id}>{memberName(m)}</option>)}</select></label>}
      <p className="text-sm text-muted-foreground sm:col-span-2">GCI {aed(preview.gci)} · your share {aed(preview.agentShare)} ({split}%) · agency {aed(preview.agencyShare)}</p>
      <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save deal'}</Button>
    </form>}
    {message && <p role="status" className="mt-2 text-sm text-primary">{message}</p>}{error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    {paperwork && <PaperworkDialog leadId={lead.id} onClose={() => setPaperwork(false)} />}
  </section>;
}
