import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getSendTemplateOptions, queueTemplate } from '@/lib/whatsapp-queue.functions';
import { queueStatusLabel, renderTemplate, templateTokens } from '@/lib/whatsapp-templates';
import type { Lead } from '@/lib/leads-app';

const when = (iso: string | null | undefined) => iso ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : '';

/** Lead page: pick an approved template, fill the blanks, and it goes into the send queue. */
export function SendTemplatePanel({ lead }: { lead: Lead }) {
  const [open, setOpen] = useState(false);
  const options = useServerFn(getSendTemplateOptions), queue = useServerFn(queueTemplate);
  const client = useQueryClient();
  const key = ['send-template', lead.id];
  const { data } = useQuery({ queryKey: key, queryFn: () => options({ data: { leadId: lead.id } }), enabled: open });
  const [templateId, setTemplateId] = useState(''), [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false), [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const template = data?.templates.find(t => t.id === templateId);
  const tokens = template ? [...new Set(templateTokens(template.body))] : [];

  const choose = (id: string) => {
    setTemplateId(id); setNote(null);
    const t = data?.templates.find(x => x.id === id);
    const prefill: Record<string, string> = { name: lead.name.split(' ')[0] ?? '', area: lead.area };
    setValues(Object.fromEntries((t ? [...new Set(templateTokens(t.body))] : []).map(k => [k, prefill[k] ?? ''])));
  };

  const add = async () => {
    if (!template) return;
    setBusy(true); setNote(null);
    try {
      const r = await queue({ data: { leadId: lead.id, templateId: template.id, variables: values } }) as { error?: string | null; status?: string; block_reason?: string | null; send_after?: string };
      if (r.error && !r.status) setNote({ ok: false, text: r.error });
      else if (r.status === 'blocked') setNote({ ok: false, text: `Added to the queue but blocked: ${r.block_reason}` });
      else if (r.status === 'sent') setNote({ ok: true, text: 'Sent on WhatsApp.' });
      else if (r.status === 'scheduled') setNote({ ok: true, text: `Scheduled for ${when(r.send_after)} (9am–8pm Dubai only).` });
      else if (r.status === 'failed') setNote({ ok: false, text: `Not sent: ${r.error ?? ''}` });
      else setNote({ ok: true, text: r.status === 'pending_approval' ? 'Added to the queue. Approve it on the Queue page.' : 'Approved — it will be sent within 5 minutes.' });
      setTemplateId(''); setValues({});
      await client.invalidateQueries({ queryKey: key });
    } catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : 'Could not add it to the queue.' }); }
    finally { setBusy(false); }
  };

  return <section aria-label="Send template" className="mt-4 rounded-lg border border-border p-4">
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="font-semibold">WhatsApp template</h2>
      <Button size="sm" variant={open ? 'secondary' : 'outline'} className="ml-auto" onClick={() => setOpen(o => !o)}><MessageSquarePlus className="size-4" />Send template</Button>
    </div>
    <p className="mt-1 text-xs text-muted-foreground">Use this to start a conversation or write after 24 hours of silence. Needs the client's recorded consent.</p>
    {open && <div className="mt-3 space-y-3">
      {lead.stopped && <p role="status" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">This client asked to stop. Messages will be blocked.</p>}
      {!lead.stopped && !lead.opted_in && <p role="status" className="rounded-md bg-muted p-2 text-sm">No consent recorded yet — tick “Client agreed to future property check-ins” below first, or the message will be blocked.</p>}
      {!data ? <p className="text-sm text-muted-foreground">Loading templates…</p> : data.templates.length === 0 ? <p className="text-sm text-muted-foreground">No approved templates yet. The owner can write one on the <Link to="/templates" className="underline">Templates</Link> page.</p> : <>
        <label className="block text-sm">Template<select aria-label="Template" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={templateId} onChange={e => choose(e.target.value)}>
          <option value="">Choose an approved template…</option>
          {data.templates.map(t => <option key={t.id} value={t.id}>{t.label} ({t.category})</option>)}
        </select></label>
        {template && <>
          {tokens.length > 0 && <div className="grid gap-2 sm:grid-cols-2">{tokens.map(t => <label key={t} className="text-sm">{`{{${t}}}`}<Input className="mt-1" maxLength={500} value={values[t] ?? ''} placeholder={t === 'price' ? 'Only a confirmed price' : ''} onChange={e => setValues(v => ({ ...v, [t]: e.target.value }))} /></label>)}</div>}
          <p className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">{renderTemplate(template.body, values)}</p>
          <Button disabled={busy || tokens.some(t => !(values[t] ?? '').trim())} onClick={() => void add()}>{busy ? 'Checking…' : data.sendMode === 'auto' ? 'Send' : 'Add to queue'}</Button>
        </>}
      </>}
      {note && <p role={note.ok ? 'status' : 'alert'} className={`text-sm ${note.ok ? 'text-primary' : 'text-destructive'}`}>{note.text}</p>}
      {data && data.recent.length > 0 && <div>
        <p className="mb-1 text-sm font-medium">Recent for this client <Link to="/queue" className="text-xs font-normal underline">open queue</Link></p>
        <ul className="space-y-1 text-sm">{data.recent.map(r => <li key={r.id} className="flex gap-2"><span className="shrink-0 text-muted-foreground">{queueStatusLabel(r.status)}</span><span className="truncate">{r.preview}</span></li>)}</ul>
      </div>}
    </div>}
  </section>;
}
