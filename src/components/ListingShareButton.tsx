import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { whatsappMessage, type Listing } from '@/lib/listings';
import { useServerFn } from '@tanstack/react-start';
import { getSharePhoto } from '@/lib/listings.functions';

export function ListingShareButton({ listing }: { listing: Listing; photo?: string | undefined }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const sharePhoto = useServerFn(getSharePhoto);
  return <div><Button variant="outline" size="sm" className="w-full" disabled={busy} onClick={async () => {
    setBusy(true);
    try {
      const result = await sharePhoto({ data: listing.id });
      if (result.error) { setError(result.error); return; }
      await navigator.clipboard.writeText(whatsappMessage(listing, result.url || undefined));
      setCopied(true); setError(''); setTimeout(() => setCopied(false), 2500);
    } catch { setError('Could not copy. Please allow clipboard access and try again.'); }
    finally { setBusy(false); }
  }}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? 'Copied for WhatsApp' : 'Copy for WhatsApp'}</Button>{error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}</div>;
}