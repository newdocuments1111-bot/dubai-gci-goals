import { createFileRoute, Link } from '@tanstack/react-router';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { listLeads, listAlerts, markAlertRead } from '@/lib/leads-app.functions';
import { listViewings } from '@/lib/viewings.functions';
import { listFollowUps } from '@/lib/followups.functions';
import { dubaiDate } from '@/lib/listings';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';

const dashQuery = queryOptions({
  queryKey: ['dashboard'],
  queryFn: async () => {
    const [leads, viewings, followUps, alerts] = await Promise.all([listLeads(), listViewings(), listFollowUps(), listAlerts()]);
    return { leads, viewings, followUps, alerts };
  },
});

export const Route = createFileRoute('/_authenticated/dashboard')({
  head: () => ({ meta: [
    { title: 'Dashboard — Dubai AI GCI' }, { name: 'description', content: 'Today at a glance: hot leads, viewings, approvals, alerts.' },
    { property: 'og:title', content: 'Dashboard — Dubai AI GCI' }, { property: 'og:description', content: 'Owner dashboard for the Dubai AI GCI assistant.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(dashQuery),
  component: DashboardPage,
});

function DashboardPage() {
  const { data } = useSuspenseQuery(dashQuery);
  const markRead = useServerFn(markAlertRead);
  const client = useQueryClient();
  const todayDubai = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });
  const hotToday = data.leads.filter(l => l.score === 'Hot');
  const viewingsToday = data.viewings.filter(v => v.status === 'booked' && new Date(v.starts_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' }) === todayDubai);
  const pendingFollowUps = data.followUps.filter(f => f.status === 'pending');
  const unreadAlerts = data.alerts.filter(a => !a.read);

  return <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
    <h1 className="mb-6 text-3xl font-bold">Dashboard</h1>
    {unreadAlerts.length > 0 && <section aria-label="Alerts" className="mb-6 space-y-2">
      {unreadAlerts.map(a => (
        <div key={a.id} role="alert" className={`flex items-center gap-3 rounded-lg border p-3 text-sm ${a.kind === 'aml' ? 'border-warning bg-warning/10' : 'border-destructive bg-destructive/10'}`}>
          <span className="flex-1">{a.kind === 'hot' ? '🔥 ' : '⚠️ '}{a.message}</span>
          <Button variant="ghost" size="sm" onClick={async () => { await markRead({ data: a.id }); client.invalidateQueries({ queryKey: dashQuery.queryKey }); }}>Dismiss</Button>
        </div>))}
    </section>}
    <div className="grid gap-4 sm:grid-cols-2">
      <Link to="/leads" className="rounded-lg border border-border p-5 hover:border-primary">
        <p className="text-3xl font-bold">{hotToday.length}</p><p className="text-sm text-muted-foreground">Hot leads</p>
        {hotToday.slice(0, 3).map(l => <p key={l.id} className="mt-1 text-sm">🔥 {l.name || 'Unnamed'}</p>)}
      </Link>
      <Link to="/viewings" className="rounded-lg border border-border p-5 hover:border-primary">
        <p className="text-3xl font-bold">{viewingsToday.length}</p><p className="text-sm text-muted-foreground">Viewings today (Dubai time)</p>
        {viewingsToday.slice(0, 3).map(v => <p key={v.id} className="mt-1 text-sm">{dubaiDate(v.starts_at)}</p>)}
      </Link>
      <Link to="/follow-ups" className="rounded-lg border border-border p-5 hover:border-primary">
        <p className="text-3xl font-bold">{pendingFollowUps.length}</p><p className="text-sm text-muted-foreground">Follow-ups waiting for approval</p>
      </Link>
      <div className="rounded-lg border border-border p-5">
        <p className="text-3xl font-bold">{data.leads.length}</p><p className="text-sm text-muted-foreground">Total leads</p>
        <p className="mt-1 text-sm text-muted-foreground">🔥 {data.leads.filter(l => l.score === 'Hot').length} · 🟡 {data.leads.filter(l => l.score === 'Warm').length} · ❄️ {data.leads.filter(l => l.score === 'Cold').length}</p>
      </div>
    </div>
    <p className="mt-6 text-xs text-muted-foreground">Manager stats (leads by source, response times, real conversion rates) build up as conversations happen.</p>
  </main>;
}
