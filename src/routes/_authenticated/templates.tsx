import { createFileRoute, Link } from '@tanstack/react-router';
import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useMemo, useRef, useState } from 'react';
import { Pencil, RefreshCw, Save, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { deleteTemplate, listTemplates, saveTemplate, submitTemplate, syncTemplates } from '@/lib/whatsapp-queue.functions';
import {
  ensureStopLine, metaStatusLabel, renderTemplate, SUGGESTED_TOKENS, TEMPLATE_LANGUAGES, templateProblems, templateTokens, type TemplateCategory,
} from '@/lib/whatsapp-templates';

const templatesQuery = queryOptions({ queryKey: ['templates'], queryFn: () => listTemplates() });

export const Route = createFileRoute('/_authenticated/templates')({
  head: () => ({ meta: [
    { title: 'WhatsApp templates — Dubai AI GCI' }, { name: 'description', content: 'Write WhatsApp message templates, preview them and send them to Meta for approval.' },
    { property: 'og:title', content: 'WhatsApp templates — Dubai AI GCI' }, { property: 'og:description', content: 'Approved WhatsApp templates for starting conversations with clients.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(templatesQuery),
  component: TemplatesPage,
});

type Form = { id?: string; label: string; category: TemplateCategory; language: string; body: string; examples: Record<string, string> };
const EMPTY: Form = { label: '', category: 'marketing', language: 'en', body: '', examples: {} };
const EXAMPLE_HINTS: Record<string, string> = { name: 'Sara', property: '2-bed apartment in Marina Gate', area: 'Dubai Marina', price: 'AED 2,400,000' };

/** Known blanks get a sample value automatically (still editable). */
const withHints = (body: string, examples: Record<string, string>) => {
  const next = { ...examples };
  for (const t of templateTokens(body)) if (next[t] === undefined && EXAMPLE_HINTS[t]) next[t] = EXAMPLE_HINTS[t];
  return next;
};

const chip = (s: string) => s === 'approved' ? 'bg-primary text-primary-foreground' : s === 'rejected' || s === 'disabled' ? 'bg-destructive text-destructive-foreground' : 'bg-muted';

function TemplatesPage() {
  const { data } = useSuspenseQuery(templatesQuery);
  const client = useQueryClient();
  const save = useServerFn(saveTemplate), submit = useServerFn(submitTemplate), sync = useServerFn(syncTemplates), remove = useServerFn(deleteTemplate);
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(''), [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const refresh = () => client.invalidateQueries({ queryKey: templatesQuery.queryKey });

  const finalBody = ensureStopLine(form.body, form.category);
  const tokens = useMemo(() => [...new Set(templateTokens(finalBody))], [finalBody]);
  const problems = form.body.trim() ? templateProblems(form) : [];

  const run = async (key: string, fn: () => Promise<{ ok: boolean; text: string }>) => {
    setBusy(key); setNote(null);
    try { setNote(await fn()); } catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : 'Something went wrong.' }); }
    finally { setBusy(''); await refresh(); }
  };

  const insertToken = (token: string) => {
    const el = bodyRef.current, text = `{{${token}}}`;
    const start = el?.selectionStart ?? form.body.length, end = el?.selectionEnd ?? form.body.length;
    setForm(f => ({ ...f, body: `${f.body.slice(0, start)}${text}${f.body.slice(end)}`, examples: { ...f.examples, [token]: f.examples[token] ?? EXAMPLE_HINTS[token] ?? '' } }));
  };

  const saveDraft = async (thenSubmit: boolean) => run(thenSubmit ? 'submit-new' : 'save', async () => {
    const r = await save({ data: form });
    if ('error' in r && r.error) return { ok: false, text: r.error };
    const id = 'id' in r ? r.id : undefined;
    setForm(EMPTY);
    if (!thenSubmit || !id) return { ok: true, text: 'Draft saved. Send it to Meta when you are ready.' };
    const s = await submit({ data: { id } });
    if ('error' in s && s.error) return { ok: false, text: `Saved as a draft, but Meta did not accept it: ${s.error}` };
    return { ok: true, text: 'Sent to Meta for review. Approval usually takes minutes, sometimes up to 48 hours.' };
  });

  if (!data.canManage) {
    return <main className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold">WhatsApp templates</h1>
      <p className="text-sm text-muted-foreground">Your agency owner writes templates. Approved ones can be sent from a lead page with “Send template”.</p>
      <ul className="space-y-2">{data.templates.filter(t => t.meta_status === 'approved').map(t => <li key={t.id} className="rounded-lg border border-border p-3 text-sm"><p className="font-medium">{t.label}</p><p className="whitespace-pre-wrap text-muted-foreground">{t.body}</p></li>)}</ul>
    </main>;
  }

  return <main className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold">WhatsApp templates</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">To message a client first (or after 24 hours of silence), WhatsApp only allows templates that Meta has approved. Write one here, send it to Meta, then use it from a lead page or the <Link to="/queue" className="underline">send queue</Link>.</p>
      </div>
      <Button variant="outline" disabled={!!busy || !data.hasWaba} onClick={() => run('sync', async () => {
        const r = await sync();
        if ('error' in r && r.error) return { ok: false, text: r.error };
        return { ok: true, text: 'checked' in r ? `Checked ${r.checked} template${r.checked === 1 ? '' : 's'} with Meta; ${r.updated} changed status.` : 'Checked.' };
      })}><RefreshCw className="size-4" />{busy === 'sync' ? 'Checking…' : 'Sync status'}</Button>
    </div>
    {!data.hasWaba && <p role="status" className="rounded-md bg-muted p-3 text-sm">Add the WhatsApp Business Account ID in <Link to="/settings/whatsapp" className="underline">Settings → WhatsApp</Link> before sending templates to Meta.</p>}
    {note && <p role={note.ok ? 'status' : 'alert'} className={`rounded-md p-3 text-sm ${note.ok ? 'bg-muted' : 'bg-destructive/10 text-destructive'}`}>{note.text}</p>}

    <section aria-label="Write a template" className="space-y-4 rounded-lg border border-border p-4">
      <h2 className="font-semibold">{form.id ? 'Edit draft' : 'Write a new template'}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm sm:col-span-1">Template name<Input className="mt-1" maxLength={100} placeholder="New listing alert" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} /></label>
        <label className="text-sm">Type<select aria-label="Type" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as TemplateCategory }))}>
          <option value="marketing">Marketing (offers, new listings)</option>
          <option value="utility">Utility (viewing confirmations, updates they asked for)</option>
        </select></label>
        <label className="text-sm">Language<select aria-label="Language" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}>
          {TEMPLATE_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select></label>
      </div>
      <div>
        <label className="block text-sm">Message
          <textarea ref={bodyRef} rows={5} maxLength={1000} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Hi {{name}}, a new {{property}} just came up in {{area}} at {{price}}. Would you like the photos and a viewing time this week?" value={form.body} onChange={e => { const body = e.target.value; setForm(f => ({ ...f, body, examples: withHints(body, f.examples) })); }} />
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Add a blank:</span>
          {SUGGESTED_TOKENS.map(t => <Button key={t} type="button" size="sm" variant="secondary" onClick={() => insertToken(t)}>{`{{${t}}}`}</Button>)}
        </div>
        {form.category === 'marketing' && <p className="mt-2 text-xs text-muted-foreground">Marketing templates always end with “Reply STOP to stop.” — added automatically if you leave it out.</p>}
      </div>
      {tokens.length > 0 && <div className="space-y-2">
        <p className="text-sm font-medium">Example values <span className="font-normal text-muted-foreground">— Meta needs a sample for each blank</span></p>
        <div className="grid gap-2 sm:grid-cols-2">{tokens.map(t => <label key={t} className="text-sm">{`{{${t}}}`}<Input className="mt-1" maxLength={200} value={form.examples[t] ?? ''} onChange={e => setForm(f => ({ ...f, examples: { ...f.examples, [t]: e.target.value } }))} /></label>)}</div>
      </div>}
      {form.body.trim() && <div>
        <p className="mb-1 text-sm font-medium">Preview</p>
        <p className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">{renderTemplate(finalBody, form.examples)}</p>
      </div>}
      {problems.length > 0 && <ul role="alert" className="list-disc space-y-1 pl-5 text-sm text-destructive">{problems.map(p => <li key={p}>{p}</li>)}</ul>}
      <div className="flex flex-wrap gap-2">
        <Button disabled={!!busy || problems.length > 0 || !form.body.trim()} variant="outline" onClick={() => void saveDraft(false)}><Save className="size-4" />{busy === 'save' ? 'Saving…' : 'Save draft'}</Button>
        <Button disabled={!!busy || problems.length > 0 || !form.body.trim() || !data.hasWaba} onClick={() => void saveDraft(true)}><Send className="size-4" />{busy === 'submit-new' ? 'Sending…' : 'Save and send to Meta'}</Button>
        {form.id && <Button variant="ghost" onClick={() => setForm(EMPTY)}>Cancel edit</Button>}
      </div>
    </section>

    <section aria-label="Your templates">
      <h2 className="mb-3 font-semibold">Your templates</h2>
      {data.templates.length === 0 ? <p className="text-sm text-muted-foreground">No templates yet.</p> :
        <ul className="space-y-3">{data.templates.map(t => (
          <li key={t.id} className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{t.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${chip(t.meta_status)}`}>{metaStatusLabel(t.meta_status)}</span>
              <span className="rounded bg-secondary px-2 py-0.5 text-xs capitalize text-secondary-foreground">{t.category}</span>
              <span className="text-xs text-muted-foreground">{TEMPLATE_LANGUAGES.find(l => l.code === t.language)?.label ?? t.language} · {t.name}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{renderTemplate(t.body, t.examples as Record<string, string>)}</p>
            {t.rejection_reason && <p className="mt-2 text-sm text-destructive">Meta's reason: {t.rejection_reason}</p>}
            {t.meta_status === 'draft' && <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" disabled={!!busy || !data.hasWaba} onClick={() => run(`submit-${t.id}`, async () => {
                const r = await submit({ data: { id: t.id } });
                return 'error' in r && r.error ? { ok: false, text: r.error } : { ok: true, text: 'Sent to Meta for review. Approval usually takes minutes, sometimes up to 48 hours.' };
              })}><Send className="size-4" />{busy === `submit-${t.id}` ? 'Sending…' : 'Send to Meta'}</Button>
              <Button size="sm" variant="outline" disabled={!!busy} onClick={() => { setForm({ id: t.id, label: t.label, category: t.category as TemplateCategory, language: t.language, body: t.body, examples: t.examples as Record<string, string> }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Pencil className="size-4" />Edit</Button>
              <Button size="sm" variant="ghost" disabled={!!busy} aria-label={`Delete ${t.label}`} onClick={() => run(`del-${t.id}`, async () => { await remove({ data: { id: t.id } }); return { ok: true, text: 'Draft deleted.' }; })}><Trash2 className="size-4" /></Button>
            </div>}
          </li>))}</ul>}
      <p className="mt-4 text-xs text-muted-foreground">Status updates automatically when Meta reviews a template (subscribe the <strong>message_template_status_update</strong> webhook field in Meta). “Sync status” checks right away.</p>
    </section>
  </main>;
}
