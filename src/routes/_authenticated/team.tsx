import { createFileRoute, redirect } from '@tanstack/react-router';
import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { Mail, Save, Trash2 } from 'lucide-react';
import { getTeam, inviteAgent, removeAgent, updateMember, updateMemberTeam } from '@/lib/team.functions';
import { TargetsCard } from '@/components/TargetsCard';
import { canInvite, canOwnerSetOthersGoal, goalModeLabels, loginLimitMessage } from '@/lib/agency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const teamQuery = queryOptions({ queryKey: ['team'], queryFn: () => getTeam() });

export const Route = createFileRoute('/_authenticated/team')({
  head: () => ({ meta: [
    { title: 'Team — Dubai AI GCI' }, { name: 'description', content: 'Invite agents, set splits and yearly GCI goals.' },
    { property: 'og:title', content: 'Team — Dubai AI GCI' }, { property: 'og:description', content: 'Manage your agency team.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' },
  ] }),
  beforeLoad: ({ context }) => { if (!context.membership.isOwner) throw redirect({ to: '/dashboard' }); },
  loader: ({ context }) => context.queryClient.ensureQueryData(teamQuery),
  component: TeamPage,
});

type Member = Awaited<ReturnType<typeof getTeam>>['members'][number];

function TeamPage() {
  const { data } = useSuspenseQuery(teamQuery);
  const client = useQueryClient();
  const invite = useServerFn(inviteAgent);
  const [email, setEmail] = useState(''), [name, setName] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const full = !canInvite(data.used, data.planLogins);
  const refresh = () => client.invalidateQueries({ queryKey: teamQuery.queryKey });
  return <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
    <h1 className="mb-2 text-3xl font-bold">Team</h1>
    <p className="mb-6 text-sm text-muted-foreground">Logins used: <strong>{data.used} of {data.planLogins}</strong>. Goal setting: {goalModeLabels[data.access.goalMode]} (change in Settings).</p>

    <section aria-label="Invite an agent" className="mb-6 rounded-lg border border-border p-4">
      <h2 className="mb-2 font-semibold">Invite an agent by email</h2>
      {full && <p role="alert" className="mb-2 text-sm text-destructive">{loginLimitMessage(data.planLogins)}</p>}
      <form className="flex flex-wrap items-end gap-3" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); setMessage('');
        try { const r = await invite({ data: { email, displayName: name } }); if ('error' in r) setError(r.error ?? 'Could not invite.'); else { setMessage(`Invite sent to ${email}. They set a password from the email.`); setEmail(''); setName(''); refresh(); } }
        catch (err) { setError(err instanceof Error ? err.message : 'Could not invite.'); } finally { setBusy(false); } }}>
        <label className="text-sm">Agent name<Input className="mt-1 w-48" maxLength={200} value={name} onChange={e => setName(e.target.value)} /></label>
        <label className="text-sm">Email<Input className="mt-1 w-64" type="email" required maxLength={200} value={email} onChange={e => setEmail(e.target.value)} /></label>
        <Button type="submit" disabled={busy || full || !email.trim()}><Mail className="size-4" />{busy ? 'Sending…' : 'Send invite'}</Button>
      </form>
      {message && <p role="status" className="mt-2 text-sm text-primary">{message}</p>}{error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    </section>

    <section aria-label="Team members" className="space-y-3">
      {data.members.map(m => <MemberRow key={m.id} member={m} members={data.members} canSetGoal={m.user_id === data.access.userId || canOwnerSetOthersGoal(data.access.goalMode)} onChanged={refresh} />)}
    </section>
    <div className="mt-6"><TargetsCard /></div>
  </main>;
}

function MemberRow({ member, members, canSetGoal, onChanged }: { member: Member; members: Member[]; canSetGoal: boolean; onChanged: () => void }) {
  const update = useServerFn(updateMember), remove = useServerFn(removeAgent), updateTeam = useServerFn(updateMemberTeam);
  const client = useQueryClient();
  const [leader, setLeader] = useState(member.team_leader_id ?? ''), [tGci, setTGci] = useState(member.target_gci_month_aed === null ? '' : String(member.target_gci_month_aed));
  const [tView, setTView] = useState(member.target_viewings_month === null ? '' : String(member.target_viewings_month)), [tCalls, setTCalls] = useState(member.target_calls_month === null ? '' : String(member.target_calls_month));
  const numOrNull = (v: string) => v.trim() ? Math.max(0, Math.round(Number(v.replace(/[^\d.]/g, '')) || 0)) : null;
  const [name, setName] = useState(member.display_name), [split, setSplit] = useState(String(member.split_percent)), [goal, setGoal] = useState(member.annual_gci_goal_aed === null ? '' : String(member.annual_gci_goal_aed));
  const [note, setNote] = useState('');
  return <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4">
    <div className="min-w-48 flex-1"><p className="font-medium">{member.display_name || member.email}</p><p className="text-xs text-muted-foreground">{member.email} · {member.role === 'owner' ? 'Owner' : 'Agent'}</p></div>
    <label className="text-sm">Name<Input className="mt-1 w-40" maxLength={200} value={name} onChange={e => setName(e.target.value)} /></label>
    <label className="text-sm">Split %<Input className="mt-1 w-20" type="number" min={0} max={100} value={split} onChange={e => setSplit(e.target.value)} /></label>
    <label className="text-sm">Yearly GCI goal (AED)<Input className="mt-1 w-36" inputMode="numeric" disabled={!canSetGoal} title={canSetGoal ? '' : 'Agents set their own goals in this agency'} value={goal} onChange={e => setGoal(e.target.value)} /></label>
    <Button variant="outline" size="sm" onClick={async () => { setNote('');
      const r = await update({ data: { id: member.id, displayName: name, splitPercent: Math.min(100, Math.max(0, Number(split) || 0)), goal: goal.trim() ? Math.max(0, Number(goal.replace(/[^\d.]/g, '')) || 0) : null } });
      setNote('error' in r ? r.error ?? 'Could not save.' : 'Saved.'); onChanged(); }}><Save className="size-4" />Save</Button>
    {member.role === 'agent' && <Button variant="ghost" size="sm" aria-label={`Remove ${member.email}`} onClick={async () => { if (!confirm(`Remove ${member.email} from the agency?`)) return; const r = await remove({ data: member.id }); if ('error' in r) setNote(r.error ?? ''); else onChanged(); }}><Trash2 className="size-4" /></Button>}
    <div className="flex w-full flex-wrap items-end gap-3 border-t border-border pt-3">
      <span className="w-full text-xs font-medium text-muted-foreground">Team and monthly targets</span>
      {member.role === 'agent' && <label className="text-sm">Reports to<select aria-label={`Team leader for ${member.email}`} className="mt-1 block h-9 w-44 rounded-md border border-input bg-background px-2 text-sm" value={leader} onChange={e => setLeader(e.target.value)}>
        <option value="">Owner only</option>
        {members.filter(x => x.user_id !== member.user_id && x.role === 'agent').map(x => <option key={x.user_id} value={x.user_id}>{x.display_name || x.email}</option>)}
      </select></label>}
      <label className="text-sm">GCI a month (AED)<Input className="mt-1 w-32" inputMode="numeric" value={tGci} onChange={e => setTGci(e.target.value)} /></label>
      <label className="text-sm">Viewings a month<Input className="mt-1 w-24" inputMode="numeric" value={tView} onChange={e => setTView(e.target.value)} /></label>
      <label className="text-sm">Calls a month<Input className="mt-1 w-24" inputMode="numeric" value={tCalls} onChange={e => setTCalls(e.target.value)} /></label>
      <Button variant="outline" size="sm" onClick={async () => { setNote('');
        try { await updateTeam({ data: { id: member.id, teamLeaderId: member.role === 'agent' && leader ? leader : null, targetGci: numOrNull(tGci), targetViewings: numOrNull(tView), targetCalls: numOrNull(tCalls) } }); setNote('Targets saved.'); client.invalidateQueries({ queryKey: ['targets'] }); onChanged(); }
        catch (e) { setNote(e instanceof Error ? e.message : 'Could not save targets.'); } }}><Save className="size-4" />Save targets</Button>
      {leader && <span className="text-xs text-muted-foreground">Their team leader sees and works this agent's leads.</span>}
    </div>
    {note && <p role="status" className="w-full text-xs">{note}</p>}
  </div>;
}
