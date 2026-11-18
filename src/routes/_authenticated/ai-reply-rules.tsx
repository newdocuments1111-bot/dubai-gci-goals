import { createFileRoute, Link } from '@tanstack/react-router';
import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { ArrowLeft, Save, RotateCcw, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useMembership } from '@/hooks/use-membership';
import { VOICE_HELPER_TEXT, VOICE_LANGUAGES, VOICE_MAX_CHARS } from '@/lib/voice';
import { getReplySettings, saveReplySettings } from '@/lib/ai-reply-rules.functions';
import { defaultReplyRules, defaultFees, replyRuleLabels, feeLabels, feesSummary, openingPreview, type ReplySettings } from '@/lib/ai-reply-rules';

const replyQuery = queryOptions({ queryKey: ['ai-reply-settings'], queryFn: () => getReplySettings() });
export const Route = createFileRoute('/_authenticated/ai-reply-rules')({
  head: () => ({ meta: [
    { title: 'AI Reply Rules — Dubai AI GCI' }, { name: 'description', content: 'Private owner settings for future Dubai property conversations.' },
    { property: 'og:title', content: 'AI Reply Rules — Dubai AI GCI' }, { property: 'og:description', content: 'Owner-managed property reply rules and agency settings.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(replyQuery),
  component: ReplyRulesPage,
});

function ReplyRulesPage() {
  const { data } = useSuspenseQuery(replyQuery);
  const [form,setForm] = useState<ReplySettings>(data);
  const [busy,setBusy] = useState(false), [message,setMessage] = useState(''), [error,setError] = useState('');
  const save = useServerFn(saveReplySettings), client = useQueryClient();
  const { isOwner } = useMembership();
  return <main className="min-h-screen bg-background"><div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
    <Button asChild variant="ghost" className="mb-6 px-0"><Link to="/listings"><ArrowLeft className="size-4" />Back to listings</Link></Button>
    <header className="mb-8"><p className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><Lock className="size-3" />Owner only · Dubai AI GCI</p><h1 className="text-3xl font-bold">AI Reply Rules</h1><p className="mt-2 text-sm text-muted-foreground">Saved rules for future WhatsApp replies · automation not connected</p></header>
    <form className="space-y-6" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); setMessage(''); try { await save({ data: form }); await client.invalidateQueries({ queryKey: replyQuery.queryKey }); setMessage('Rules saved.'); } catch (e) { setError(e instanceof Error && e.message.startsWith('Rules saved') ? e.message : 'Could not save rules. Your changes are still here.'); } finally { setBusy(false); } }}>
      <section className="border-y border-border py-5"><h2 className="mb-3 font-semibold">Agency settings</h2><label className="text-sm">Agency name<Input className="mt-1" maxLength={200} value={form.agency_name} onChange={e => setForm(f => ({ ...f,agency_name:e.target.value }))} /></label><p className="mt-4 whitespace-pre-wrap break-words text-sm text-muted-foreground">{openingPreview(form)}</p></section>
      <section className="border-b border-border pb-5"><h2 className="mb-1 font-semibold">Fees and extra costs</h2><p className="mb-3 text-sm text-muted-foreground">The AI quotes only these amounts and always says they are approximate and the agent will confirm.</p><div className="grid gap-3 sm:grid-cols-2">{(Object.keys(feeLabels) as (keyof typeof defaultFees)[]).map(key => <label key={key} className="text-sm">{feeLabels[key]}<Input className="mt-1" type="number" min={0} step="any" value={form.fees[key]} onChange={e => setForm(f => ({ ...f,fees:{ ...f.fees,[key]:Number(e.target.value) || 0 } }))} /></label>)}</div><p className="mt-4 text-sm text-muted-foreground">{feesSummary(form.fees)}</p></section>
      <section className="border-b border-border pb-5">
        <div className="flex items-start justify-between gap-4">
          <div><h2 id="voice-replies-label" className="font-semibold">Voice replies</h2><p id="voice-replies-help" className="mt-1 text-sm text-muted-foreground">{VOICE_HELPER_TEXT}</p></div>
          <Switch aria-labelledby="voice-replies-label" aria-describedby="voice-replies-help" checked={form.voice_replies} disabled={busy || !isOwner} onCheckedChange={on => setForm(f => ({ ...f, voice_replies: on }))} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{form.voice_replies ? 'On' : 'Off'} · Only the owner can change this. The text reply is always sent too, so you can read it here with its English translation. Answers longer than {VOICE_MAX_CHARS} characters are sent as text only. The first voice reply to each client starts by saying it is {form.agency_name.trim() ? `${form.agency_name.trim()}’s` : 'your agency’s'} AI assistant{form.agency_name.trim() ? '' : ' (add the agency name above, or no voice reply is sent)'}.</p>
        <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium">Languages the Voice Agent understands ({VOICE_LANGUAGES.length})</summary>
          <p className="mt-2 text-muted-foreground">Voice-note answers are sent only in the {VOICE_LANGUAGES.filter(l => l.voiceOut).length} languages the speech service lists as supported. In the others the client gets the text reply only.</p>
          <p className="mt-2"><span className="font-medium">Voice and text:</span> {VOICE_LANGUAGES.filter(l => l.voiceOut).map(l => l.name).join(', ')}.</p>
          <p className="mt-2"><span className="font-medium">Text reply only:</span> {VOICE_LANGUAGES.filter(l => !l.voiceOut).map(l => l.name).join(', ')}.</p>
        </details>
      </section>
      <fieldset disabled={busy} className="space-y-6">{(Object.keys(replyRuleLabels) as (keyof typeof defaultReplyRules)[]).map(key => <label key={key} className="block text-sm font-medium">{replyRuleLabels[key]}<textarea aria-label={replyRuleLabels[key]} required maxLength={10000} className="mt-2 min-h-32 w-full resize-y rounded-md border border-input bg-background px-3 py-3 text-sm font-normal leading-relaxed" value={form.rules[key]} onChange={e => setForm(f => ({ ...f,rules:{ ...f.rules,[key]:e.target.value } }))} /></label>)}</fieldset>
      {message && <p role="status" className="text-sm text-primary">{message}</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-5"><Button type="button" variant="outline" disabled={busy} onClick={() => { setForm(f => ({ ...f,rules:{ ...defaultReplyRules } })); setMessage(''); }}><RotateCcw className="size-4" />Restore defaults</Button><Button type="submit" disabled={busy}><Save className="size-4" />{busy ? 'Saving…' : 'Save rules'}</Button></div>
    </form>
  </div></main>;
}