import { createFileRoute } from '@tanstack/react-router';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { getManagerStats } from '@/lib/stats.functions';

const statsQuery = queryOptions({ queryKey: ['manager-stats'], queryFn: () => getManagerStats() });

export const Route = createFileRoute('/_authenticated/stats')({
  head: () => ({ meta: [
    { title: 'Statistics — Dubai AI GCI' }, { name: 'description', content: 'Manager statistics: leads by source, scores, viewings and reply times.' },
    { property: 'og:title', content: 'Statistics — Dubai AI GCI' }, { property: 'og:description', content: 'Owner manager statistics.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(statsQuery),
  component: StatsPage,
});

function StatsPage() {
  const { data: s } = useSuspenseQuery(statsQuery);
  const sources = Object.keys(s.leadsBySource).sort();
  return <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
    <h1 className="mb-6 text-3xl font-bold">Statistics</h1>

    <section aria-label="This week and month" className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[
        ['Leads this week', s.weekly.leads], ['Viewings this week', s.weekly.viewings],
        ['Leads this month', s.monthly.leads], ['Viewings this month', s.monthly.viewings],
      ].map(([label, value]) => (
        <div key={label} className="rounded-lg border border-border p-4">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
        </div>
      ))}
    </section>

    <section aria-label="Totals" className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
      {[
        ['Total leads', s.totals.leads], ['Viewings', s.totals.viewings], ['Valuations', s.totals.valuations], ['Offers', s.totals.offers],
        ['Avg AI first reply', s.avgFirstReplyMinutes === null ? '—' : `${s.avgFirstReplyMinutes} min`],
      ].map(([label, value]) => (
        <div key={label} className="rounded-lg border border-border p-4">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
        </div>
      ))}
    </section>

    <section aria-label="Leads by source" className="rounded-lg border border-border p-4">
      <h2 className="mb-3 font-semibold">Leads by source</h2>
      {sources.length === 0 && <p className="text-sm text-muted-foreground">No leads yet.</p>}
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
          <th className="py-2 pr-2 font-medium">Source</th><th className="py-2 pr-2 font-medium">Leads</th>
          <th className="py-2 pr-2 font-medium">Hot</th><th className="py-2 pr-2 font-medium">Warm</th><th className="py-2 font-medium">Cold</th>
        </tr></thead>
        <tbody>{sources.map(source => (
          <tr key={source} className="border-b border-border last:border-0">
            <td className="py-2 pr-2">{source}</td>
            <td className="py-2 pr-2 tabular-nums">{s.leadsBySource[source]}</td>
            <td className="py-2 pr-2 tabular-nums">{s.scoreBySource[source]?.['Hot'] ?? 0}</td>
            <td className="py-2 pr-2 tabular-nums">{s.scoreBySource[source]?.['Warm'] ?? 0}</td>
            <td className="py-2 tabular-nums">{s.scoreBySource[source]?.['Cold'] ?? 0}</td>
          </tr>
        ))}</tbody>
      </table>
    </section>
  </main>;
}
