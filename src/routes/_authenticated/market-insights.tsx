import { createFileRoute, Link } from '@tanstack/react-router';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { listMarketTransactions } from '@/lib/market.functions';
import { marketInsights } from '@/lib/market';
import { Input } from '@/components/ui/input';

const marketQuery = queryOptions({ queryKey: ['market-transactions'], queryFn: () => listMarketTransactions() });

export const Route = createFileRoute('/_authenticated/market-insights')({
  head: () => ({ meta: [
    { title: 'Market Insights — Dubai AI GCI' }, { name: 'description', content: 'Price per sq ft and trends by area, property type and month.' },
    { property: 'og:title', content: 'Market Insights — Dubai AI GCI' }, { property: 'og:description', content: 'Area price per sq ft and trends for agent pitches.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(marketQuery),
  component: InsightsPage,
});

function InsightsPage() {
  const { data } = useSuspenseQuery(marketQuery);
  const [search, setSearch] = useState('');
  const insights = useMemo(() => marketInsights(data), [data]);
  const shown = insights.filter(i => `${i.area} ${i.propertyType}`.toLowerCase().includes(search.trim().toLowerCase()));
  const sources = [...new Set(data.map(r => r.source).filter(Boolean))];
  return <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <h1 className="mb-2 text-3xl font-bold">Market Insights</h1>
    <p className="mb-1 text-sm text-muted-foreground">Average price per sq ft from recorded sales (Market Data), by area, property type and month. Trend compares the last two months with sales.</p>
    <p className="mb-6 text-xs text-muted-foreground">Use for pitches as “recorded past sales”, never as a promise of future prices.{sources.length > 0 && ` Source: ${sources.slice(0, 3).join(', ')}.`}</p>
    <Input aria-label="Search area or property type" placeholder="Search area or type…" className="mb-4 max-w-xs" value={search} onChange={e => setSearch(e.target.value)} />
    {insights.length === 0 ? <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No sales with size and price yet. <Link to="/market-data" className="underline">Import market data</Link> first.</p> :
      <div className="grid gap-4 sm:grid-cols-2">{shown.map(i => (
        <article key={`${i.area}-${i.propertyType}`} className="rounded-lg border border-border p-4">
          <div className="flex items-start justify-between gap-2">
            <div><h2 className="font-semibold">{i.area}</h2><p className="text-xs capitalize text-muted-foreground">{i.propertyType} · {i.sales} sale{i.sales === 1 ? '' : 's'}</p></div>
            <div className="text-right"><p className="text-xl font-bold">AED {i.latestPpsf.toLocaleString('en-US')}</p><p className="text-xs text-muted-foreground">per sq ft (latest month)</p></div>
          </div>
          {i.trendPct !== null && <p className={`mt-2 flex items-center gap-1 text-sm ${i.trendPct >= 0 ? 'text-primary' : 'text-destructive'}`}>
            {i.trendPct >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}{i.trendPct > 0 ? '+' : ''}{i.trendPct}% vs previous month</p>}
          <table className="mt-3 w-full text-xs"><thead><tr className="text-left text-muted-foreground"><th>Month</th><th>AED / sq ft</th><th>Sales</th></tr></thead>
            <tbody>{i.months.slice(-6).reverse().map(m => <tr key={m.month} className="border-t border-border"><td className="py-1">{m.month}</td><td>{m.avgPpsf.toLocaleString('en-US')}</td><td>{m.count}</td></tr>)}</tbody></table>
        </article>))}
      </div>}
  </main>;
}
