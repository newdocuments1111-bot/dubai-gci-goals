import { createFileRoute, Link } from '@tanstack/react-router';
import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { ArrowLeft, Copy, PlugZap, Save, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { checkWhatsAppConnection, getWhatsAppSettings, saveWhatsAppSettings, sendWhatsAppTestMessage } from '@/lib/whatsapp.functions';
import { normalizeRecipients, VERIFY_TOKEN_NAME, WEBHOOK_URL } from '@/lib/whatsapp';
import { dubaiDate } from '@/lib/listings';

const waQuery = queryOptions({ queryKey: ['whatsapp-settings'], queryFn: () => getWhatsAppSettings() });

export const Route = createFileRoute('/_authenticated/settings/whatsapp')({
  head: () => ({ meta: [
    { title: 'WhatsApp — Dubai AI GCI' }, { name: 'description', content: 'Connect your agency WhatsApp number, check the connection and send a test message.' },
    { property: 'og:title', content: 'WhatsApp — Dubai AI GCI' }, { property: 'og:description', content: 'WhatsApp connection settings for the Dubai AI GCI assistant.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(waQuery),
  component: WhatsAppPage,
});

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return <div className="text-sm">
    <p className="mb-1 font-medium">{label}</p>
    <div className="flex gap-2">
      <code className="flex-1 overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs">{value}</code>
      <Button type="button" variant="outline" size="sm" aria-label={`Copy ${label}`} onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
        <Copy className="size-4" />{copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  </div>;
}

function WhatsAppPage() {
  const { data } = useSuspenseQuery(waQuery);
  const client = useQueryClient();
  const s = data.settings;
  const [form, setForm] = useState({
    phone_number_id: s?.phone_number_id ?? '', waba_id: s?.waba_id ?? '', display_number: s?.display_number ?? '',
    test_mode: s?.test_mode ?? true, recipients: (s?.test_recipients ?? []).map(n => `+${n}`).join('\n'),
  });
  const [busy, setBusy] = useState(''), [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [testTo, setTestTo] = useState(s?.test_recipients[0] ?? '');
  const save = useServerFn(saveWhatsAppSettings), check = useServerFn(checkWhatsAppConnection), test = useServerFn(sendWhatsAppTestMessage);
  const refresh = () => client.invalidateQueries({ queryKey: waQuery.queryKey });
  const run = async (key: string, fn: () => Promise<{ ok: boolean; text: string }>) => {
    setBusy(key); setNote(null);
    try { setNote(await fn()); } catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : 'Something went wrong.' }); }
    finally { setBusy(''); await refresh(); }
  };
  const missing = Object.entries(data.secrets).filter(([, set]) => !set).map(([n]) => n);
  const status = !s?.phone_number_id ? 'Not set up' : s.status === 'connected' ? 'Connected' : s.status === 'error' ? 'Problem' : 'Not checked yet';

  return <main className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6">
    <div>
      <Link to="/settings" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Settings</Link>
      <h1 className="text-3xl font-bold">WhatsApp</h1>
      <p className="mt-1 text-sm text-muted-foreground">{data.agencyName}: buyers who message your WhatsApp number get the same AI replies as Test Chat.</p>
    </div>

    <section aria-label="Connection status" className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${s?.status === 'connected' ? 'bg-primary text-primary-foreground' : s?.status === 'error' ? 'bg-destructive text-destructive-foreground' : 'bg-muted'}`}>{status}</span>
        {s?.test_mode && <span className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground">Test mode on — safety list only</span>}
        {data.canTest && s?.phone_number_id && <Button variant="outline" size="sm" className="ml-auto" disabled={!!busy} onClick={() => run('check', async () => { const r = await check(); return { ok: r.ok, text: r.ok ? `All checks passed: ${r.detail}` : r.detail }; })}>
          <PlugZap className="size-4" />{busy === 'check' ? 'Checking…' : 'Check connection'}
        </Button>}
      </div>
      {s?.status_detail && <p className="mt-2 text-sm text-muted-foreground">{s.status_detail}{s.checked_at ? ` · checked ${dubaiDate(s.checked_at)}` : ''}</p>}
      <p className="mt-2 text-sm text-muted-foreground">Last message from Meta: {s?.last_webhook_at ? dubaiDate(s.last_webhook_at) : 'none received yet'}</p>
      {missing.length > 0 && <p role="status" className="mt-3 rounded-md bg-muted p-3 text-sm">Still to add in Project Settings → Secrets: <strong>{missing.join(', ')}</strong></p>}
    </section>

    <section className="space-y-3">
      <h2 className="font-semibold">Paste these into Meta</h2>
      <p className="text-sm text-muted-foreground">Meta developer app → WhatsApp → Configuration → Webhook → Edit. Then subscribe to the <strong>messages</strong> field.</p>
      <CopyRow label="Callback URL" value={WEBHOOK_URL} />
      <p className="text-sm">Verify token: the same value you saved as the secret <code className="rounded bg-muted px-1">{VERIFY_TOKEN_NAME}</code>.</p>
    </section>

    <form className="space-y-4" onSubmit={e => { e.preventDefault(); void run('save', async () => {
      await save({ data: { phone_number_id: form.phone_number_id, waba_id: form.waba_id, display_number: form.display_number, test_mode: form.test_mode, test_recipients: form.recipients.split(/[\n,]/) } });
      return { ok: true, text: 'WhatsApp settings saved.' };
    }); }}>
      <h2 className="font-semibold">Number details</h2>
      {!data.canEdit && <p role="status" className="rounded-md bg-muted p-3 text-sm">Elite Visions HQ sets up WhatsApp numbers. Contact HQ to change these.</p>}
      <fieldset disabled={!data.canEdit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">Phone number ID<Input className="mt-1" inputMode="numeric" maxLength={30} value={form.phone_number_id} onChange={e => setForm(f => ({ ...f, phone_number_id: e.target.value.replace(/\D/g, '') }))} /></label>
          <label className="text-sm">WhatsApp Business Account ID<Input className="mt-1" inputMode="numeric" maxLength={30} value={form.waba_id} onChange={e => setForm(f => ({ ...f, waba_id: e.target.value.replace(/\D/g, '') }))} /></label>
          <label className="text-sm">Display number<Input className="mt-1" maxLength={40} value={form.display_number} onChange={e => setForm(f => ({ ...f, display_number: e.target.value }))} /></label>
        </div>
        <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
          <input type="checkbox" className="mt-1" checked={form.test_mode} onChange={e => setForm(f => ({ ...f, test_mode: e.target.checked }))} />
          <span><strong>Test mode</strong><br /><span className="text-muted-foreground">While on, the app refuses to send to any number that is not on the safety list below.</span></span>
        </label>
        <label className="block text-sm">Safety list (one number per line, with country code)
          <textarea rows={3} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.recipients} onChange={e => setForm(f => ({ ...f, recipients: e.target.value }))} />
        </label>
      </fieldset>
      {data.canEdit && <Button type="submit" disabled={!!busy}><Save className="size-4" />{busy === 'save' ? 'Saving…' : 'Save WhatsApp settings'}</Button>}
    </form>

    {data.canTest && <section className="space-y-3">
      <h2 className="font-semibold">Send test message</h2>
      <p className="text-sm text-muted-foreground">Sends Meta's “Hello World” message to a number on the safety list.</p>
      <div className="flex flex-wrap gap-2">
        <select aria-label="Test recipient" className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={testTo} onChange={e => setTestTo(e.target.value)}>
          {normalizeRecipients(s?.test_recipients ?? []).map(n => <option key={n} value={n}>+{n}</option>)}
        </select>
        <Button type="button" disabled={!!busy || !testTo} onClick={() => run('test', async () => { const r = await test({ data: { to: testTo } }); return { ok: r.ok, text: r.detail }; })}>
          <Send className="size-4" />{busy === 'test' ? 'Sending…' : 'Send test message'}
        </Button>
      </div>
    </section>}

    {note && <p role={note.ok ? 'status' : 'alert'} className={`rounded-md p-3 text-sm ${note.ok ? 'bg-muted' : 'bg-destructive/10 text-destructive'}`}>{note.text}</p>}

    {data.canTest && <section>
      <h2 className="mb-2 font-semibold">Recent activity from Meta</h2>
      {data.events.length === 0 ? <p className="text-sm text-muted-foreground">Nothing received yet.</p> :
        <ul className="divide-y divide-border rounded-lg border border-border text-sm">{data.events.map(e => (
          <li key={e.id} className="flex flex-wrap gap-x-3 px-3 py-2">
            <span className="w-16 shrink-0 font-medium capitalize">{e.kind}</span>
            <span className="text-muted-foreground">{dubaiDate(e.received_at)}</span>
            <span className="flex-1">{e.processed_at ? e.outcome : e.processing_error ? `Waiting to retry: ${e.processing_error}` : 'Processing…'}</span>
          </li>))}</ul>}
    </section>}
  </main>;
}
