import { useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, Download, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { deleteDocument, finishDocumentUpload, listDocuments, openDocument, startDocumentUpload } from '@/lib/documents.functions';
import { checklistFor, documentReceived } from '@/lib/documents';
import type { Lead } from '@/lib/leads-app';

const docsQuery = (leadId: string) => queryOptions({ queryKey: ['documents', leadId], queryFn: () => listDocuments({ data: { leadId } }) });

/** Document Vault for one lead: checklist + private uploads with 10-minute signed links. */
export function LeadDocuments({ lead }: { lead: Lead }) {
  const leadId = lead.id;
  const { data: files } = useSuspenseQuery(docsQuery(leadId));
  const queryClient = useQueryClient();
  const startUpload = useServerFn(startDocumentUpload), finishUpload = useServerFn(finishDocumentUpload), open = useServerFn(openDocument), del = useServerFn(deleteDocument);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [note, setNote] = useState('');
  const checklist = checklistFor(lead.type, {});
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['documents', leadId] });

  const upload = async (file: File) => {
    setBusy(true); setError(''); setNote('');
    try {
      // The server checks access and hands out a one-time upload link; the vault itself is closed to the browser.
      const { path, token } = await startUpload({ data: { leadId, filename: file.name } });
      const { error: upError } = await supabase.storage.from('documents').uploadToSignedUrl(path, token, file);
      if (upError) throw upError;
      await finishUpload({ data: { leadId, path } });
      setNote('Uploaded.'); refresh();
    } catch { setError('Could not upload the document.'); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  return <section aria-label="Document vault" className="rounded-lg border border-border p-4">
    <h2 className="mb-1 font-semibold">Document Vault</h2>
    <p className="mb-3 text-xs text-muted-foreground">Private — only the agency owner, the assigned agent and HQ can open these, via 10-minute links. Every upload, view and deletion is logged. Never share documents in chat.</p>
    <h3 className="mb-2 text-sm font-medium">Checklist ({lead.type})</h3>
    <ul className="mb-4 space-y-1 text-sm">
      {checklist.map(item => {
        const received = documentReceived(item, files.map(f => f.name));
        return <li key={item} className="flex items-center gap-2">{received ? <CheckCircle2 className="size-4 text-primary" /> : <Circle className="size-4 text-muted-foreground" />}{item}</li>;
      })}
    </ul>
    <input ref={fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
    <Button variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}><Upload className="size-4" />{busy ? 'Uploading…' : 'Upload document'}</Button>
    {note && <p role="status" className="mt-2 text-xs text-primary">{note}</p>}{error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
    {files.length > 0 && <ul className="mt-3 space-y-1 text-sm">{files.map(f => (
      <li key={f.path} className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate">{f.name.replace(/^\d+-/, '')}</span>
        <Button variant="ghost" size="sm" aria-label={`Open ${f.name}`} onClick={async () => { const r = await open({ data: { leadId, path: f.path } }); window.open(r.url, '_blank', 'noopener'); }}><Download className="size-4" /></Button>
        <Button variant="ghost" size="sm" aria-label={`Delete ${f.name}`} onClick={async () => { const r = await del({ data: { leadId, path: f.path } }); if (r.error) { setError(r.error); return; } refresh(); }}><Trash2 className="size-4" /></Button>
      </li>))}
    </ul>}
  </section>;
}
