import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createLead, listLeads } from '@/lib/leads-app.functions';
import { timezoneFromPhone } from '@/lib/leads-app';

const chatLeadsQuery = queryOptions({ queryKey: ['leads'], queryFn: () => listLeads() });

export const Route = createFileRoute('/_authenticated/test-chat')({
  head: () => ({ meta: [
    { title: 'Test Chat — Dubai AI GCI' }, { name: 'description', content: 'Try the AI reply brain by playing the buyer, seller or tenant.' },
    { property: 'og:title', content: 'Test Chat — Dubai AI GCI' }, { property: 'og:description', content: 'Owner test chat for the AI reply brain.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(chatLeadsQuery),
  component: TestChatPage,
});

function TestChatPage() {
  const { data: leads } = useSuspenseQuery(chatLeadsQuery);
  const create = useServerFn(createLead);
  const navigate = useNavigate();
  const [name, setName] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');

  return <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
    <h1 className="mb-2 text-3xl font-bold">Test Chat</h1>
    <p className="mb-6 text-sm text-muted-foreground">Play the buyer, seller or tenant. The AI follows your AI Reply Rules, UAE Knowledge, and only listings that are Available and checked within 24 hours. Until WhatsApp is connected, "sent" messages appear in the conversation marked Sent.</p>
    <section className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-border p-4">
      <label className="text-sm">Pretend client name<Input className="mt-1 w-56" maxLength={200} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Test Buyer" /></label>
      <Button disabled={busy || !name.trim()} onClick={async () => { setBusy(true); setError('');
        try { const lead = await create({ data: { name, phone: '', type: 'buyer', source: 'Website', timezone: timezoneFromPhone('') } }); navigate({ to: '/lead/$leadId', params: { leadId: lead.id } }); }
        catch { setError('Could not start a conversation.'); } finally { setBusy(false); } }}>
        <Plus className="size-4" />New conversation
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
    <h2 className="mb-2 font-semibold">Conversations</h2>
    {leads.length === 0 && <p className="text-sm text-muted-foreground">No conversations yet.</p>}
    <div className="space-y-2">{leads.map(lead => (
      <Button key={lead.id} variant="outline" className="w-full justify-start" onClick={() => navigate({ to: '/lead/$leadId', params: { leadId: lead.id } })}>
        {lead.name || 'Unnamed lead'} <span className="ml-2 text-xs text-muted-foreground">{lead.type} · {lead.score}</span>
      </Button>))}
    </div>
  </main>;
}
