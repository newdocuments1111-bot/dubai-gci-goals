import { useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Send, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sendClientMessage, sendOwnerMessage, setAiPaused } from '@/lib/leads-app.functions';
import type { ChatMessage, Lead } from '@/lib/leads-app';
import { dubaiDate } from '@/lib/listings';
import { ChatMediaInput } from './ChatMediaInput';

/** WhatsApp-style conversation. The owner plays the client in Test Chat, or replies themselves after Take over. */
export function LeadChat({ lead, messages, onChanged, playAsClient }: { lead: Lead; messages: (ChatMessage & { media_url?: string | null })[]; onChanged: () => void; playAsClient: boolean }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const sendClient = useServerFn(sendClientMessage), sendOwner = useServerFn(sendOwnerMessage), pause = useServerFn(setAiPaused);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { boxRef.current?.focus(); }, [lead.id]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);

  const send = async () => {
    const content = text.trim();
    if (!content || busy) return;
    setBusy(true); setError('');
    try {
      if (playAsClient) await sendClient({ data: { leadId: lead.id, content } });
      else await sendOwner({ data: { leadId: lead.id, content } });
      setText(''); onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not send.'); }
    finally { setBusy(false); boxRef.current?.focus(); }
  };

  return <section aria-label="Conversation" className="flex flex-col rounded-lg border border-border">
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-sm">
      <span className="font-medium">{lead.name || 'Unnamed lead'}</span>
      <span className="text-xs text-muted-foreground">{lead.timezone}</span>
      {lead.stopped && <span className="rounded bg-muted px-2 py-0.5 text-xs">Client asked to stop — the AI will never message them again</span>}
      <Button variant="outline" size="sm" className="ml-auto" onClick={async () => { await pause({ data: { id: lead.id, paused: !lead.ai_paused } }); onChanged(); }}>
        {lead.ai_paused ? <><Play className="size-4" />Hand back to AI</> : <><Pause className="size-4" />Take over</>}
      </Button>
    </div>
    <div className="max-h-[50vh] min-h-40 space-y-2 overflow-y-auto p-4">
      {messages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
      {messages.map(m => (
        <div key={m.id} className={`flex ${m.role === 'client' ? 'justify-start' : 'justify-end'}`}>
          <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.role === 'client' ? 'bg-muted' : m.role === 'owner' ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground'}`}>
            {m.media_url && m.media_kind === 'audio' && <audio controls src={m.media_url} className="mb-2 max-w-full" aria-label="Client voice note" />}
            {m.media_url && m.media_kind === 'image' && <img src={m.media_url} alt="Client photo or screenshot" width={320} height={240} loading="lazy" className="mb-2 max-h-64 max-w-full rounded object-contain" />}
            {m.media_kind === 'audio' && <p className="mb-1 text-xs opacity-70">Transcription</p>}
            <p className="whitespace-pre-wrap break-words">{m.media_kind === 'image' ? m.content.split('\nTreat screenshot claims')[0] : m.content}</p>
            {m.original_content && <p className="mt-1 border-t border-current/20 pt-1 text-xs opacity-80">{m.original_content}</p>}
            <p className="mt-1 text-[10px] opacity-70">{m.role === 'ai' ? 'AI' : m.role === 'owner' ? 'You' : 'Client'} · {dubaiDate(m.created_at)}{m.sent ? ' · Sent' : ' · Queued (quiet hours)'}</p>
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
    {playAsClient && <ChatMediaInput key={lead.id} leadId={lead.id} onChanged={onChanged} disabled={busy} />}
    <div className="flex items-end gap-2 border-t border-border p-3">
      <textarea ref={boxRef} aria-label={playAsClient ? 'Write as the client' : 'Write as yourself'} rows={1} maxLength={10000}
        placeholder={playAsClient ? 'Write as the client…' : 'Write your reply…'}
        className="max-h-32 min-h-10 flex-1 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
        value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} />
      <Button disabled={busy || !text.trim()} onClick={() => void send()} aria-label="Send"><Send className="size-4" /></Button>
    </div>
    {error && <p role="alert" className="px-3 pb-3 text-sm text-destructive">{error}</p>}
  </section>;
}
