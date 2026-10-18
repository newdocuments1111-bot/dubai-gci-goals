import { useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Mic, Square, ImagePlus, AudioLines, X, Send } from 'lucide-react';
import { Button } from './ui/button';
import { prepareChatMedia } from '@/lib/chat-media.functions';
import { sendClientMessage } from '@/lib/leads-app.functions';

export function ChatMediaInput({ leadId, onChanged, disabled }: { leadId: string; onChanged: () => void; disabled: boolean }) {
  const prepare = useServerFn(prepareChatMedia), send = useServerFn(sendClientMessage);
  const [file, setFile] = useState<File>(), [recording, setRecording] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null), recorder = useRef<MediaRecorder | undefined>(undefined), stream = useRef<MediaStream | undefined>(undefined), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; if (timer.current) clearTimeout(timer.current); if (recorder.current?.state === 'recording') recorder.current.stop(); stream.current?.getTracks().forEach(t => t.stop()); }; }, []);
  const record = async () => {
    setError('');
    if (recording) { recorder.current?.stop(); return; }
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Recording is unavailable here. Upload a voice note instead.');
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ['audio/webm','audio/mp4','audio/ogg'].find(t => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined); recorder.current = r;
      const chunks: Blob[] = [];
      r.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      r.onstop = () => {
        if (timer.current) clearTimeout(timer.current);
        stream.current?.getTracks().forEach(t => t.stop());
        if (!active.current) return;
        const type = r.mimeType || 'audio/webm';
        setFile(new File(chunks, `voice-note.${type.includes('mp4') ? 'm4a' : 'webm'}`, { type })); setRecording(false);
      };
      r.start(); setRecording(true); timer.current = setTimeout(() => { if (r.state === 'recording') r.stop(); }, 120000);
    } catch (e) { stream.current?.getTracks().forEach(t => t.stop()); setError(e instanceof Error ? e.message : 'Could not record.'); }
  };
  const upload = async () => {
    if (!file || busy) return;
    setBusy(true); setError('');
    try {
      const form = new FormData(); form.set('file', file); form.set('leadId', leadId);
      const prepared = await prepare({ data: form });
      if (!prepared.rejected) await send({ data: { leadId, content: prepared.content, media: { path: prepared.path, kind: prepared.kind } } });
      setFile(undefined); onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not process this file.'); onChanged(); }
    finally { setBusy(false); }
  };
  return <div className="border-t border-border px-3 py-2">
    <input ref={input} className="hidden" type="file" aria-label="Client attachment" accept="audio/*,image/jpeg,image/png,image/webp" onChange={e => { setFile(e.target.files?.[0]); e.target.value = ''; setError(''); }} />
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="ghost" size="icon" title="Upload photo or screenshot" aria-label="Upload photo or screenshot" disabled={busy || disabled || recording} onClick={() => { if (input.current) input.current.accept = 'image/jpeg,image/png,image/webp'; input.current?.click(); }}><ImagePlus className="size-4" /></Button>
      <Button variant="ghost" size="icon" title="Upload voice note" aria-label="Upload voice note" disabled={busy || disabled || recording} onClick={() => { if (input.current) input.current.accept = 'audio/*'; input.current?.click(); }}><AudioLines className="size-4" /></Button>
      <Button variant={recording ? 'destructive' : 'ghost'} size="icon" title={recording ? 'Stop recording' : 'Record voice note'} aria-label={recording ? 'Stop recording' : 'Record voice note'} disabled={busy || disabled} onClick={() => void record()}>{recording ? <Square className="size-4" /> : <Mic className="size-4" />}</Button>
      {recording && <span role="status" className="text-xs text-destructive">Recording…</span>}
      {file && <><span className="min-w-0 max-w-48 truncate text-xs">{file.name}</span><Button size="icon" variant="ghost" aria-label="Remove attachment" disabled={busy} onClick={() => setFile(undefined)}><X className="size-4" /></Button><Button size="sm" disabled={busy || disabled} onClick={() => void upload()}><Send className="size-4" />{busy ? 'Processing…' : 'Send attachment'}</Button></>}
    </div>
    {error && <p role="alert" className="mt-1 text-sm text-destructive">{error}</p>}
  </div>;
}