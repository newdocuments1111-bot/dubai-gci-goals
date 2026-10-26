import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { CheckCircle2, Circle, Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getPaperwork } from '@/lib/deals.functions';
import { checklistWithStatus, DRAFT_LABEL, paperworkDraft } from '@/lib/paperwork';

/** "Prepare paperwork": document checklist from the vault plus a pre-filled Form F / Ejari draft. */
export function PaperworkDialog({ leadId, dealId, onClose }: { leadId?: string; dealId?: string; onClose: () => void }) {
  const { data, error, isLoading } = useQuery({ queryKey: ['paperwork', leadId ?? '', dealId ?? ''], queryFn: () => getPaperwork({ data: { ...(leadId ? { leadId } : {}), ...(dealId ? { dealId } : {}) } }) });
  const [copied, setCopied] = useState(false);
  const draft = data ? paperworkDraft(data) : null;
  const groups = data ? checklistWithStatus(data.dealType, data.vaultFiles) : [];
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
      <DialogTitle>Prepare paperwork</DialogTitle>
      <DialogDescription>{data ? (data.dealType === 'sale' ? 'Sale — Form F (MOU)' : 'Rental — Ejari') : 'Loading…'} · documents are checked against this client's Document Vault.</DialogDescription>
      {isLoading && <p className="text-sm text-muted-foreground">Preparing…</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error.message}</p>}
      {data && draft && <>
        <section aria-label="Documents needed" className="space-y-3">
          {groups.map(g => <div key={g.party}>
            <h3 className="text-sm font-semibold">{g.party}</h3>
            <ul className="mt-1 space-y-1 text-sm">{g.items.map(i => <li key={i.item} className="flex items-center gap-2">
              {i.received ? <CheckCircle2 className="size-4 text-primary" aria-label="Received" /> : <Circle className="size-4 text-muted-foreground" aria-label="Missing" />}{i.item}</li>)}</ul>
          </div>)}
          {!data.lead && <p className="text-xs text-muted-foreground">No client linked, so vault documents can't be checked.</p>}
        </section>
        <section aria-label={draft.title} className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="font-semibold">{draft.title}</h3>
            <span className="rounded bg-warning/15 px-2 py-0.5 text-xs font-medium">{DRAFT_LABEL}</span>
          </div>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{draft.text}</pre>
          <Button className="mt-2" variant="outline" size="sm" onClick={async () => { await navigator.clipboard.writeText(draft.text); setCopied(true); }}><Copy className="size-4" />{copied ? 'Copied' : 'Copy draft'}</Button>
        </section>
      </>}
    </DialogContent>
  </Dialog>;
}
