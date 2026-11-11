import { createFileRoute, Link } from '@tanstack/react-router';
import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getSettings, saveSettings, saveGoalMode } from '@/lib/settings.functions';
import { goalModeLabels, type GoalMode } from '@/lib/agency';
import { WEEKDAYS, type AppSettings } from '@/lib/settings';

const settingsQuery = queryOptions({ queryKey: ['app-settings'], queryFn: () => getSettings() });

export const Route = createFileRoute('/_authenticated/settings/')({
  head: () => ({ meta: [
    { title: 'Settings — Dubai AI GCI' }, { name: 'description', content: 'Private owner settings: agent, working hours, holidays, compliance and document retention.' },
    { property: 'og:title', content: 'Settings — Dubai AI GCI' }, { property: 'og:description', content: 'Owner settings for the Dubai AI GCI assistant.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQuery),
  component: SettingsPage,
});

function SettingsPage() {
  const { data } = useSuspenseQuery(settingsQuery);
  const [form, setForm] = useState<AppSettings>(data.settings);
  const [goalMode, setGoalMode] = useState<GoalMode>(data.goalMode);
  const saveMode = useServerFn(saveGoalMode);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [holidayInput, setHolidayInput] = useState('');
  const save = useServerFn(saveSettings), client = useQueryClient();
  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => setForm(f => ({ ...f, [key]: value }));

  return <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
    <h1 className="mb-6 text-3xl font-bold">Settings</h1>
    {data.isOwner && <Link to="/settings/whatsapp" className="mb-6 flex items-center justify-between rounded-lg border border-border p-4 text-sm hover:bg-muted">
      <span><strong>WhatsApp</strong><br /><span className="text-muted-foreground">Connection, test mode, safety list and test message</span></span><span aria-hidden>→</span>
    </Link>}
    <form className="space-y-6" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); setMessage('');
      try { await save({ data: form }); if (goalMode !== data.goalMode) await saveMode({ data: goalMode }); await client.invalidateQueries({ queryKey: settingsQuery.queryKey }); setMessage('Settings saved.'); }
      catch { setError('Could not save settings. Your changes are still here.'); } finally { setBusy(false); } }}>
      {!data.isOwner && <p role="status" className="rounded-md bg-muted p-3 text-sm">Only your agency owner can change these settings.</p>}
      <fieldset disabled={!data.isOwner} className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Agent name<Input className="mt-1" maxLength={200} value={form.agent_name} onChange={e => set('agent_name', e.target.value)} /></label>
        <label className="text-sm">Agency name<Input className="mt-1" maxLength={200} value={form.agency_name} onChange={e => set('agency_name', e.target.value)} /></label>
        <label className="text-sm">Agency yearly GCI goal (AED, total commission)<Input className="mt-1" type="number" min={0} value={form.annual_gci_goal_aed} onChange={e => set('annual_gci_goal_aed', Math.max(0, Number(e.target.value) || 0))} /></label>
        <label className="text-sm">RERA / BRN number<Input className="mt-1" maxLength={100} value={form.rera_brn} onChange={e => set('rera_brn', e.target.value)} /></label>
        <label className="text-sm">Mortgage adviser partner<Input className="mt-1" maxLength={200} value={form.mortgage_partner} onChange={e => set('mortgage_partner', e.target.value)} /></label>
        <label className="text-sm">Compliance officer email<Input className="mt-1" type="email" maxLength={200} value={form.compliance_email} onChange={e => set('compliance_email', e.target.value)} /></label>
        <label className="text-sm">Document retention (years)<Input className="mt-1" type="number" min={1} max={30} value={form.retention_years} onChange={e => set('retention_years', Number(e.target.value) || 5)} /></label>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Working days and hours</h2>
        <div className="mb-3 flex flex-wrap gap-2">{WEEKDAYS.map(day => (
          <label key={day} className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm ${form.working_days.includes(day) ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>
            <input type="checkbox" className="sr-only" checked={form.working_days.includes(day)} onChange={() => set('working_days', form.working_days.includes(day) ? form.working_days.filter(d => d !== day) : [...form.working_days, day])} />{day.slice(0, 3)}
          </label>))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">Work starts<Input className="mt-1" type="time" value={form.work_start} onChange={e => set('work_start', e.target.value)} /></label>
          <label className="text-sm">Work ends<Input className="mt-1" type="time" value={form.work_end} onChange={e => set('work_end', e.target.value)} /></label>
          <label className="text-sm">Viewing length (minutes)<Input className="mt-1" type="number" min={10} max={480} value={form.viewing_minutes} onChange={e => set('viewing_minutes', Number(e.target.value) || 30)} /></label>
        </div>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Holidays</h2>
        <p className="mb-2 text-sm text-muted-foreground">Pre-filled with UAE public holidays — edit as needed. The AI never offers viewings on these days.</p>
        <div className="mb-2 flex flex-wrap gap-2">{form.holidays.map(h => (
          <span key={h} className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">{h}
            <button type="button" aria-label={`Remove holiday ${h}`} className="text-muted-foreground hover:text-destructive" onClick={() => set('holidays', form.holidays.filter(x => x !== h))}>×</button>
          </span>))}
        </div>
        <div className="flex gap-2">
          <Input type="date" value={holidayInput} onChange={e => setHolidayInput(e.target.value)} className="w-auto" />
          <Button type="button" variant="outline" onClick={() => { if (holidayInput && !form.holidays.includes(holidayInput)) { set('holidays', [...form.holidays, holidayInput].sort()); setHolidayInput(''); } }}>Add holiday</Button>
        </div>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Team, alerts and estimates</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">Missed-lead alert after (minutes)<Input className="mt-1" type="number" min={1} max={1440} value={form.missed_lead_minutes} onChange={e => set('missed_lead_minutes', Math.max(1, Math.round(Number(e.target.value) || 15)))} /></label>
          <label className="text-sm">Minutes saved per AI reply (for the estimate)<Input className="mt-1" type="number" min={0} max={120} step={0.5} value={form.minutes_per_ai_reply} onChange={e => set('minutes_per_ai_reply', Math.max(0, Number(e.target.value) || 0))} /></label>
          <label className="text-sm">Who sets yearly GCI goals<select aria-label="Who sets yearly GCI goals" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={goalMode} onChange={e => setGoalMode(e.target.value as GoalMode)}>
            {(Object.keys(goalModeLabels) as GoalMode[]).map(m => <option key={m} value={m}>{goalModeLabels[m]}</option>)}
          </select></label>
        </div>
      </section>
      </fieldset>
      {message && <p role="status" className="text-sm text-primary">{message}</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy || !data.isOwner}><Save className="size-4" />{busy ? 'Saving…' : 'Save settings'}</Button>
    </form>
  </main>;
}
