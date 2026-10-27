import { createFileRoute, Link } from '@tanstack/react-router';
import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { Check, Pencil, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { approveQueueItem, cancelQueueItem, editQueueVariables, getQueue, saveSendSettings } from '@/lib/whatsapp-queue.functions';
import { canApprove, canCancel, canEditVariables, QUEUE_PURPOSES, QUEUE_STATUSES, queueStatusLabel, type QueueStatus } from '@/lib/whatsapp-templates';
import { waStatusLabel } from '@/lib/whatsapp';

type Filters = { status?: QueueStatus | undefined; purpose?: (typeof QUEUE_PURPOSES)[number] | undefined };
const queueQuery = (f: Filters) => queryOptions({ queryKey: ['queue', f.status ?? '', f.purpose ?? ''], queryFn: () => getQueue({ data: f }) });

export const Route = createFileRoute('/_authenticated/queue')({
  head: () => ({ meta: [
    { title: 'WhatsApp send queue — Dubai AI GCI' }, { name: 'description', content: 'Approve, edit or cancel WhatsApp template messages before they are sent, and see the send log.' },
    { property: 'og:title', content: 'WhatsApp send queue — Dubai AI GCI' }, { property: 'og:description', content: 'Every WhatsApp template message waits here and is checked again before sending.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(queueQuery({})),
  component: QueuePage,
});

const when = (iso: string | null | undefined) => iso ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : '—';
const PURPOSE_LABEL: Record<string, string> = { manual: 'Sent by hand', listing_match: 'Listing match', launch: 'New launch', renewal: 'Renewal', referral: 'Referral' };
const chip = (s: string) => s === 'sent' ? 'bg-primary text-primary-foreground' : s === 'failed' || s === 'blocked' ? 'bg-destructive text-destructive-foreground' : s === 'cancelled' ? 'bg-muted text-muted-foreground' : 'bg-secondary text-secondary-foreground';

function QueuePage() {
  const [filters, setFilters] = useState<Filters>({});
  const { data } = useSuspenseQuery(queueQuery(filters));
  const client = useQueryClient();
  const approve = useServerFn(approveQueueItem), cancel = useServerFn(cancelQueueItem), edit = useServerFn(editQueueVariables), saveSettings = useServerFn(saveSendSettings);
  const [busy, setBusy] = useState(''), [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string; values: Record<string, string> } | null>(null);
  const [mode, setMode] = useState(data.settings.send_mode), [gap, setGap] = useState(String(data.settings.marketing_gap_days));
  const refresh = () => client.invalidateQueries({ queryKey: ['queue'] });

  const run = async (key: string, fn: () => Promise<{ ok: boolean; text: string }>) => {
    setBusy(key); setNote(null);
    try { setNote(await fn()); } catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : 'Something went wrong.' }); }
    finally { setBusy(''); await refresh(); }
  };
  const outcome = (r: { error?: string | null; status?: string; block_reason?: string | null; send_after?: string } & Record<string, unknown>) => {
    if (typeof r.error === 'string' && r.error && !r.status) return { ok: false, text: r.error };
    if (r.status === 'sent') return { ok: true, text: 'Sent on WhatsApp.' };
    if (r.status === 'scheduled') return { ok: true, text: `Outside 9am–8pm Dubai time, so it will go at ${when(r.send_after)}.` };
    if (r.status === 'blocked') return { ok: false, text: `Blocked: ${r.block_reason ?? ''}` };
    if (r.status === 'failed') return { ok: false, text: `Not sent: ${typeof r.error === 'string' ? r.error : ''}` };
    return { ok: true, text: 'Approved. It will be sent within 5 minutes.' };
  };

  const log = data.items.filter(i => i.status === 'sent' || i.status === 'failed');

  return <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
    <div>
      <h1 className="text-3xl font-bold">WhatsApp send queue</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Template messages wait here. Right before each send the app checks again: client consent on record, not stopped, template approved by Meta, 9am–8pm Dubai time, one marketing message per {data.settings.marketing_gap_days} days{data.settings.test_mode ? ', and the test-mode safety list' : ''}. {data.isManager ? '' : 'You see only your own leads.'}</p>
    </div>

    {data.isManager && <section aria-label="Sending settings" className="space-y-3 rounded-lg border border-border p-4">
      <h2 className="font-semibold">Sending settings</h2>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="radio" name="mode" checked={mode === 'approve'} onChange={() => setMode('approve')} />Owner/agent approves before sending</label>
        <label className="flex items-center gap-2"><input type="radio" name="mode" checked={mode === 'auto'} onChange={() => setMode('auto')} />Send automatically</label>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Days between marketing messages to the same client<Input className="mt-1 w-28" type="number" min={1} max={90} value={gap} onChange={e => setGap(e.target.value)} /></label>
        <Button variant="outline" disabled={!!busy} onClick={() => run('settings', async () => {
          const r = await saveSettings({ data: { send_mode: mode as 'approve', marketing_gap_days: Math.min(90, Math.max(1, Math.round(Number(gap) || 7))) } });
          return 'error' in r && r.error ? { ok: false, text: r.error } : { ok: true, text: 'Sending settings saved.' };
        })}><Save className="size-4" />Save</Button>
      </div>
    </section>}

    <div className="flex flex-wrap gap-3">
      <label className="text-sm">Status<select aria-label="Filter by status" className="ml-2 rounded-md border border-input bg-background px-3 py-2 text-sm" value={filters.status ?? ''} onChange={e => setFilters(f => ({ ...f, status: (e.target.value || undefined) as QueueStatus | undefined }))}>
        <option value="">All</option>{QUEUE_STATUSES.map(s => <option key={s} value={s}>{queueStatusLabel(s)}</option>)}
      </select></label>
      <label className="text-sm">Purpose<select aria-label="Filter by purpose" className="ml-2 rounded-md border border-input bg-background px-3 py-2 text-sm" value={filters.purpose ?? ''} onChange={e => setFilters(f => ({ ...f, purpose: (e.target.value || undefined) as Filters['purpose'] }))}>
        <option value="">All</option>{QUEUE_PURPOSES.map(p => <option key={p} value={p}>{PURPOSE_LABEL[p]}</option>)}
      </select></label>
    </div>

    {note && <p role={note.ok ? 'status' : 'alert'} className={`rounded-md p-3 text-sm ${note.ok ? 'bg-muted' : 'bg-destructive/10 text-destructive'}`}>{note.text}</p>}

    <section aria-label="Queue">
      {data.items.length === 0 ? <p className="text-sm text-muted-foreground">Nothing here yet. Open a lead and press “Send template”.</p> :
        <ul className="space-y-3">{data.items.map(i => {
          const lead = i.leads as { name: string; phone: string } | null;
          const delivery = i.chat_messages as { wa_status: string | null; wa_error: string | null } | null;
          return <li key={i.id} className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Link to="/lead/$leadId" params={{ leadId: i.lead_id }} className="font-medium underline-offset-2 hover:underline">{lead?.name || lead?.phone || 'Lead'}</Link>
              <span className={`rounded-full px-2 py-0.5 text-xs ${chip(i.status)}`}>{queueStatusLabel(i.status)}</span>
              <span className="rounded bg-muted px-2 py-0.5 text-xs">{PURPOSE_LABEL[i.purpose] ?? i.purpose}</span>
              <span className="text-xs capitalize text-muted-foreground">{i.category} · {i.template_name}</span>
              <span className="ml-auto text-xs text-muted-foreground">Added {when(i.created_at)}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{i.preview}</p>
            {i.status === 'scheduled' && <p className="mt-1 text-sm text-muted-foreground">Will send at {when(i.send_after)} (Dubai time)</p>}
            {i.status === 'blocked' && i.block_reason && <p className="mt-1 text-sm text-destructive">Blocked: {i.block_reason}</p>}
            {i.status === 'failed' && i.error && <p className="mt-1 text-sm text-destructive">Not sent: {i.error}</p>}
            {i.status === 'sent' && <p className="mt-1 text-sm text-muted-foreground">Sent {when(i.sent_at)} · {waStatusLabel(delivery?.wa_status, delivery?.wa_error)}</p>}
            {editing?.id === i.id && <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {[...new Set(i.template_variables)].map(t => <label key={t} className="text-sm">{`{{${t}}}`}<Input className="mt-1" maxLength={500} value={editing.values[t] ?? ''} onChange={e => setEditing(ed => ed && ({ ...ed, values: { ...ed.values, [t]: e.target.value } }))} /></label>)}
            </div>}
            <div className="mt-3 flex flex-wrap gap-2">
              {canApprove(i.status) && <Button size="sm" disabled={!!busy} onClick={() => run(`a-${i.id}`, async () => outcome(await approve({ data: { id: i.id } })))}><Check className="size-4" />{busy === `a-${i.id}` ? 'Checking…' : i.status === 'blocked' ? 'Check again and approve' : 'Approve'}</Button>}
              {canEditVariables(i.status) && (editing?.id === i.id
                ? <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run(`e-${i.id}`, async () => { const r = await edit({ data: { id: i.id, variables: editing.values } }); setEditing(null); return 'error' in r && r.error ? { ok: false, text: r.error } : { ok: true, text: 'Changes saved.' }; })}><Save className="size-4" />Save changes</Button>
                : <Button size="sm" variant="outline" disabled={!!busy} onClick={() => setEditing({ id: i.id, values: (i.variables ?? {}) as Record<string, string> })}><Pencil className="size-4" />Edit variables</Button>)}
              {canCancel(i.status) && <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => run(`c-${i.id}`, async () => { const r = await cancel({ data: { id: i.id } }); return 'error' in r && r.error ? { ok: false, text: r.error } : { ok: true, text: 'Cancelled.' }; })}><X className="size-4" />Cancel</Button>}
            </div>
          </li>;
        })}</ul>}
    </section>

    <section aria-label="Send log">
      <h2 className="mb-2 font-semibold">Send log</h2>
      {log.length === 0 ? <p className="text-sm text-muted-foreground">No messages sent yet.</p> :
        <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full text-sm">
          <thead className="bg-muted text-left"><tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Client</th><th className="px-3 py-2">Template</th><th className="px-3 py-2">Result</th></tr></thead>
          <tbody>{log.map(i => {
            const lead = i.leads as { name: string; phone: string } | null;
            const delivery = i.chat_messages as { wa_status: string | null; wa_error: string | null } | null;
            return <tr key={i.id} className="border-t border-border">
              <td className="px-3 py-2">{when(i.sent_at ?? i.updated_at)}</td>
              <td className="px-3 py-2">{lead?.name || lead?.phone}</td>
              <td className="px-3 py-2">{i.template_name}</td>
              <td className="px-3 py-2">{i.status === 'sent' ? waStatusLabel(delivery?.wa_status, delivery?.wa_error) : `Not sent: ${i.error ?? ''}`}</td>
            </tr>;
          })}</tbody>
        </table></div>}
    </section>
  </main>;
}
