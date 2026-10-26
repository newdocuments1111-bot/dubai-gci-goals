import { createFileRoute, redirect } from '@tanstack/react-router';
import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { Building2, Save } from 'lucide-react';
import { getHqOverview, hqCreateAgency, hqUpdateAgency } from '@/lib/team.functions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const hqQuery = queryOptions({ queryKey: ['hq'], queryFn: () => getHqOverview() });
const aed = (n: number) => `AED ${Math.round(n).toLocaleString('en-US')}`;
const STATUSES = ['active', 'trial', 'paused', 'cancelled'] as const;
type Status = (typeof STATUSES)[number];

export const Route = createFileRoute('/_authenticated/hq')({
  head: () => ({ meta: [
    { title: 'Elite Visions HQ — Dubai AI GCI' }, { name: 'description', content: 'All agencies, logins, usage, GCI and problems in one table.' },
    { property: 'og:title', content: 'Elite Visions HQ — Dubai AI GCI' }, { property: 'og:description', content: 'HQ overview of every agency.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' },
  ] }),
  beforeLoad: ({ context }) => { if (!context.membership.isHq) throw redirect({ to: '/dashboard' }); },
  loader: ({ context }) => context.queryClient.ensureQueryData(hqQuery),
  component: HqPage,
});

type Row = Awaited<ReturnType<typeof getHqOverview>>[number];

function HqPage() {
  const { data } = useSuspenseQuery(hqQuery);
  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
    <h1 className="mb-2 text-3xl font-bold">Elite Visions HQ</h1>
    <p className="mb-6 text-sm text-muted-foreground">Every agency at a glance. Usage counts this calendar month (Dubai time). WhatsApp is not connected yet, so WhatsApp messages stay at 0.</p>
    <div className="mb-8 overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[1100px] text-sm">
        <thead className="bg-muted/50 text-left text-muted-foreground"><tr>
          <th className="p-2">Agency</th><th>Status</th><th>Logins used / allowed</th><th>Fee / month</th><th>Leads</th><th>AI replies (all)</th><th>Viewings</th><th>Deals</th><th>Closed GCI</th><th>Usage this month</th><th>Problems</th><th></th>
        </tr></thead>
        <tbody>{data.map(r => <AgencyRow key={r.agency_id} row={r} />)}</tbody>
      </table>
    </div>
    <CreateAgency />
  </main>;
}

function AgencyRow({ row }: { row: Row }) {
  const update = useServerFn(hqUpdateAgency), client = useQueryClient();
  const [plan, setPlan] = useState(String(row.plan_logins)), [fee, setFee] = useState(String(row.monthly_fee_aed)), [status, setStatus] = useState<Status>(row.status as Status);
  const [note, setNote] = useState('');
  const over = row.logins_used > row.plan_logins;
  return <tr className="border-t border-border align-top">
    <td className="p-2 font-medium">{row.agency_name}</td>
    <td><select aria-label={`Status for ${row.agency_name}`} className="rounded-md border border-input bg-background px-2 py-1" value={status} onChange={e => setStatus(e.target.value as Status)}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></td>
    <td><span className={over ? 'text-destructive' : ''}>{row.logins_used}</span> / <Input aria-label={`Logins allowed for ${row.agency_name}`} className="inline-block h-8 w-16" type="number" min={1} value={plan} onChange={e => setPlan(e.target.value)} /></td>
    <td><Input aria-label={`Monthly fee for ${row.agency_name}`} className="h-8 w-24" type="number" min={0} value={fee} onChange={e => setFee(e.target.value)} /></td>
    <td>{row.leads}</td><td>{row.ai_replies}</td><td>{row.viewings}</td><td>{row.deals}</td><td>{aed(row.closed_gci_aed)}</td>
    <td>{row.ai_replies_month} AI replies<br /><span className="text-xs text-muted-foreground">{row.whatsapp_month} WhatsApp</span></td>
    <td>{row.missed_leads + row.flagged_chats === 0 ? <span className="text-muted-foreground">None</span> : <span className="text-destructive">{row.missed_leads} missed lead{row.missed_leads === 1 ? '' : 's'}<br />{row.flagged_chats} flagged chat{row.flagged_chats === 1 ? '' : 's'}</span>}</td>
    <td className="pr-2"><Button variant="outline" size="sm" onClick={async () => { setNote('');
      try { await update({ data: { id: row.agency_id, name: row.agency_name, planLogins: Math.max(1, Math.round(Number(plan) || 1)), monthlyFeeAed: Math.max(0, Number(fee) || 0), status } }); setNote('Saved'); client.invalidateQueries({ queryKey: hqQuery.queryKey }); }
      catch { setNote('Could not save'); } }}><Save className="size-4" />Save</Button>{note && <p className="text-xs">{note}</p>}</td>
  </tr>;
}

function CreateAgency() {
  const create = useServerFn(hqCreateAgency), client = useQueryClient();
  const [form, setForm] = useState({ name: '', ownerName: '', ownerEmail: '', planLogins: '3', monthlyFeeAed: '0', status: 'trial' as Status });
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));
  return <section aria-label="Create an agency" className="rounded-lg border border-border p-4">
    <h2 className="mb-1 flex items-center gap-2 font-semibold"><Building2 className="size-4" />Create an agency and invite its owner</h2>
    <p className="mb-3 text-xs text-muted-foreground">The owner gets an email to set a password. New agencies start empty — no sample data.</p>
    <form className="flex flex-wrap items-end gap-3" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); setMessage('');
      try {
        const r = await create({ data: { name: form.name, ownerName: form.ownerName, ownerEmail: form.ownerEmail, planLogins: Math.max(1, Math.round(Number(form.planLogins) || 1)), monthlyFeeAed: Math.max(0, Number(form.monthlyFeeAed) || 0), status: form.status } });
        if ('error' in r) setError(r.error ?? 'Could not create the agency.'); else { setMessage(`${form.name} created. Invite sent to ${form.ownerEmail}.`); setForm(f => ({ ...f, name: '', ownerName: '', ownerEmail: '' })); client.invalidateQueries({ queryKey: hqQuery.queryKey }); }
      } catch (err) { setError(err instanceof Error ? err.message : 'Could not create the agency.'); } finally { setBusy(false); } }}>
      <label className="text-sm">Agency name<Input className="mt-1 w-48" required maxLength={200} value={form.name} onChange={e => set('name', e.target.value)} /></label>
      <label className="text-sm">Owner name<Input className="mt-1 w-40" maxLength={200} value={form.ownerName} onChange={e => set('ownerName', e.target.value)} /></label>
      <label className="text-sm">Owner email<Input className="mt-1 w-56" type="email" required maxLength={200} value={form.ownerEmail} onChange={e => set('ownerEmail', e.target.value)} /></label>
      <label className="text-sm">Logins<Input className="mt-1 w-20" type="number" min={1} value={form.planLogins} onChange={e => set('planLogins', e.target.value)} /></label>
      <label className="text-sm">Fee / month (AED)<Input className="mt-1 w-28" type="number" min={0} value={form.monthlyFeeAed} onChange={e => set('monthlyFeeAed', e.target.value)} /></label>
      <label className="text-sm">Status<select className="mt-1 block rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.status} onChange={e => set('status', e.target.value)}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></label>
      <Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create and invite'}</Button>
    </form>
    {message && <p role="status" className="mt-2 text-sm text-primary">{message}</p>}{error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
  </section>;
}
