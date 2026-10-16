import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { whatsappMessage, type Listing } from '@/lib/listings';

export function ListingShareButton({ listing, photo }: { listing: Listing; photo?: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  return <div><Button variant="outline" size="sm" className="w-full" onClick={async () => {
    try {
      await navigator.clipboard.writeText(whatsappMessage(listing, photo ? new URL(photo, window.location.origin).href : undefined));
      setCopied(true); setError(''); setTimeout(() => setCopied(false), 2500);
    } catch { setError('Copy is unavailable. Please allow clipboard access and try again.'); }
  }}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? 'Copied for WhatsApp' : 'Copy for WhatsApp'}</Button>{error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}</div>;
}