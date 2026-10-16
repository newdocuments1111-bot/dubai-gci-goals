import { createFileRoute } from '@tanstack/react-router';
import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { importMarketData, listMarketTransactions } from '@/lib/market.functions';
import { marketCsvColumns, parseMarketCsv } from '@/lib/market';
import { dubaiDate } from '@/lib/listings';

const marketQuery = queryOptions({ queryKey: ['market-data'], queryFn: () => listMarketTransactions() });

export const Route = createFileRoute('/_authenticated/market-data')({
  head: () => ({ meta: [
    { title: 'Market Data — Dubai AI GCI' }, { name: 'description', content: 'Real Dubai transaction data imported from CSV, used for value updates.' },
    { property: 'og:title', content: 'Market Data — Dubai AI GCI' }, { property: 'og:description', content: 'Owner-managed Dubai market transactions.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(marketQuery),
  component: MarketDataPage,
});

function MarketDataPage() {
  const { data: rows } = useSuspenseQuery(marketQuery);
  const client = useQueryClient();
  const importFn = useServerFn(importMarketData);
  const fileRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState('Dubai Land Department open data');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');

  const downloadTemplate = () => {
    const csv = `${marketCsvColumns.join(',')}\n2026-09-15,Dubai Marina,Marina Gate,apartment,1100,1850000\n`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'market-data-template.csv'; a.click(); URL.revokeObjectURL(a.href);
  };

  const onFile = async (file: File) => {
    setBusy(true); setError(''); setMessage('');
    try {
      const parsedRows = parseMarketCsv(await file.text());
      const result = await importFn({ data: { source, rows: parsedRows } });
      await client.invalidateQueries({ queryKey: marketQuery.queryKey });
      setMessage(`Imported ${result.count} transactions.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not import the file.'); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  return <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <h1 className="mb-2 text-3xl font-bold">Market Data</h1>
    <p className="mb-6 text-sm text-muted-foreground">Real Dubai transactions only. Value updates and market facts use this data — never predictions. Each import shows its source and date.</p>
    <section className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-border p-4">
      <label className="text-sm">Source<Input className="mt-1 w-64" maxLength={200} value={source} onChange={e => setSource(e.target.value)} /></label>
      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void onFile(f); }} />
      <Button variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}><Upload className="size-4" />{busy ? 'Importing…' : 'Import CSV'}</Button>
      <Button variant="ghost" onClick={downloadTemplate}><Download className="size-4" />Download CSV template</Button>
      {message && <p role="status" className="text-sm text-primary">{message}</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
    {rows.length === 0 ? <p className="text-sm text-muted-foreground">No transactions yet. Import a CSV to get started.</p> : (
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-muted/50 text-left">
            <th className="px-3 py-2">Date</th><th className="px-3 py-2">Area</th><th className="px-3 py-2">Building</th><th className="px-3 py-2">Type</th>
            <th className="px-3 py-2 text-right">Size (sq ft)</th><th className="px-3 py-2 text-right">Price (AED)</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Imported</th>
          </tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.id} className="border-b border-border last:border-0">
              <td className="px-3 py-2">{r.transaction_date}</td><td className="px-3 py-2">{r.area}</td><td className="px-3 py-2">{r.building}</td><td className="px-3 py-2">{r.property_type}</td>
              <td className="px-3 py-2 text-right">{Number(r.size_sqft).toLocaleString('en-US')}</td>
              <td className="px-3 py-2 text-right">{Number(r.price_aed).toLocaleString('en-US')}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">{r.source}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">{dubaiDate(r.imported_at)}</td>
            </tr>))}
          </tbody>
        </table>
      </div>)}
  </main>;
}
