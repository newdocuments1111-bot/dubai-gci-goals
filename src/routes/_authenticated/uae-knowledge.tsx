import { createFileRoute } from '@tanstack/react-router';
import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { Plus, Save, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { addKnowledge, deleteKnowledge, listKnowledge, updateKnowledge } from '@/lib/knowledge.functions';
import { needsReverify, type KnowledgeFact } from '@/lib/knowledge';

const knowledgeQuery = queryOptions({ queryKey: ['uae-knowledge'], queryFn: () => listKnowledge() });

export const Route = createFileRoute('/_authenticated/uae-knowledge')({
  head: () => ({ meta: [
    { title: 'UAE Knowledge — Dubai AI GCI' }, { name: 'description', content: 'Editable UAE property facts the AI relies on, each with a source and last verified date.' },
    { property: 'og:title', content: 'UAE Knowledge — Dubai AI GCI' }, { property: 'og:description', content: 'Owner-managed UAE property knowledge base.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(knowledgeQuery),
  component: KnowledgePage,
});

function FactCard({ fact, onChanged }: { fact: KnowledgeFact; onChanged: () => void }) {
  const [topic, setTopic] = useState(fact.topic);
  const [text, setText] = useState(fact.fact);
  const [source, setSource] = useState(fact.source);
  const [busy, setBusy] = useState(false);
  const update = useServerFn(updateKnowledge), del = useServerFn(deleteKnowledge);
  const stale = needsReverify(fact);
  return <article className="rounded-lg border border-border p-4">
    <div className="mb-2 flex items-center justify-between gap-2">
      <Input aria-label="Topic" className="max-w-xs font-semibold" maxLength={200} value={topic} onChange={e => setTopic(e.target.value)} />
      <Button type="button" variant="ghost" size="sm" aria-label={`Delete ${fact.topic}`} disabled={busy}
        onClick={async () => { if (!confirm(`Delete "${fact.topic}"?`)) return; setBusy(true); await del({ data: fact.id }); onChanged(); }}>
        <Trash2 className="size-4" />
      </Button>
    </div>
    <textarea aria-label="Fact" className="min-h-20 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm" maxLength={10000} value={text} onChange={e => setText(e.target.value)} />
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Input aria-label="Source" className="h-8 max-w-56 text-xs" placeholder="Source" maxLength={500} value={source} onChange={e => setSource(e.target.value)} />
      <span>Last verified: {fact.last_verified}</span>
      {(stale || fact.needs_verification) && <span className="flex items-center gap-1 rounded bg-warning/15 px-2 py-0.5 text-warning-foreground"><AlertTriangle className="size-3" />Please re-verify</span>}
      <Button type="button" size="sm" variant="outline" className="ml-auto" disabled={busy}
        onClick={async () => { setBusy(true); try { await update({ data: { id: fact.id, topic, fact: text, source } }); onChanged(); } finally { setBusy(false); } }}>
        <Save className="size-3" />Save
      </Button>
    </div>
  </article>;
}

function KnowledgePage() {
  const { data: facts } = useSuspenseQuery(knowledgeQuery);
  const client = useQueryClient();
  const add = useServerFn(addKnowledge);
  const [topic, setTopic] = useState(''), [text, setText] = useState(''), [source, setSource] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const refresh = () => client.invalidateQueries({ queryKey: knowledgeQuery.queryKey });
  return <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
    <h1 className="mb-2 text-3xl font-bold">UAE Knowledge</h1>
    <p className="mb-6 text-sm text-muted-foreground">The AI uses only these facts and always says fees are approximate and the agent will confirm. Facts older than 6 months show "please re-verify".</p>
    <div className="space-y-4">{facts.map(f => <FactCard key={f.id} fact={f} onChanged={refresh} />)}</div>
    <section className="mt-8 rounded-lg border border-dashed border-border p-4">
      <h2 className="mb-3 font-semibold">Add a fact</h2>
      <div className="space-y-2">
        <Input aria-label="New topic" placeholder="Topic" maxLength={200} value={topic} onChange={e => setTopic(e.target.value)} />
        <textarea aria-label="New fact" placeholder="Fact" className="min-h-20 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm" maxLength={10000} value={text} onChange={e => setText(e.target.value)} />
        <Input aria-label="New source" placeholder="Source" maxLength={500} value={source} onChange={e => setSource(e.target.value)} />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button disabled={busy || !topic.trim() || !text.trim()} onClick={async () => { setBusy(true); setError('');
          try { await add({ data: { topic, fact: text, source } }); setTopic(''); setText(''); setSource(''); refresh(); }
          catch { setError('Could not add the fact.'); } finally { setBusy(false); } }}>
          <Plus className="size-4" />Add fact
        </Button>
      </div>
    </section>
  </main>;
}
