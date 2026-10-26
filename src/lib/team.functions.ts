import { createServerFn } from '@tanstack/react-start';
import { getRequestHeader } from '@tanstack/react-start/server';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { getAccess, requireHq, requireOwner } from './agency-access';
import { canInvite, canOwnerSetOthersGoal, loginLimitMessage } from './agency';
import { z } from 'zod';

type Ctx = { supabase: Parameters<typeof getAccess>[0]; userId: string };

const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email').max(200);
const nameSchema = z.string().trim().max(200);

/** Invite one login into an agency. The database re-checks the plan limit and who may add which role. */
async function inviteLogin(context: Ctx, input: { agencyId: string; email: string; displayName: string; role: 'owner' | 'agent' }) {
  const [{ data: agency, error: agencyError }, { data: members, error: membersError }] = await Promise.all([
    context.supabase.from('agencies').select('name,plan_logins').eq('id', input.agencyId).single(),
    context.supabase.from('agency_members').select('user_id,role,email').eq('agency_id', input.agencyId),
  ]);
  if (agencyError || membersError || !agency) throw new Error('Could not check this agency.');
  const logins = (members ?? []).filter(m => m.role !== 'hq_admin');
  if (logins.some(m => m.email.toLowerCase() === input.email)) return { error: 'This person is already in the agency.' };
  if (!canInvite(new Set(logins.map(m => m.user_id)).size, agency.plan_logins)) return { error: loginLimitMessage(agency.plan_logins) };

  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const origin = getRequestHeader('origin') || 'https://dubai-gci-goals.lovable.app';
  const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(input.email, { redirectTo: `${origin}/welcome`, data: { agency_name: agency.name, display_name: input.displayName } });
  if (error || !invited.user) {
    console.error('Invite failed', error?.code, error?.message);
    return { error: /already|exists/i.test(`${error?.code} ${error?.message}`) ? 'This email already has a login. Each person can belong to one agency — use another email.' : 'Could not send the invite email. Please try again.' };
  }
  const { error: insertError } = await context.supabase.from('agency_members').insert({ agency_id: input.agencyId, user_id: invited.user.id, email: input.email, role: input.role, display_name: input.displayName });
  if (insertError) {
    await supabaseAdmin.auth.admin.deleteUser(invited.user.id);
    return { error: insertError.message.startsWith('Your plan has') ? insertError.message : 'Could not add this person.' };
  }
  return { success: true as const };
}

export const getTeam = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const access = await getAccess(context.supabase, context.userId);
  const [{ data: members, error }, { data: agency }] = await Promise.all([
    context.supabase.from('agency_members').select('id,user_id,email,role,display_name,split_percent,annual_gci_goal_aed,created_at').eq('agency_id', access.agencyId).in('role', ['owner', 'agent']).order('created_at'),
    context.supabase.from('agencies').select('name,plan_logins,goal_setting_mode').eq('id', access.agencyId).single(),
  ]);
  if (error || !agency) throw new Error('Could not load your team.');
  return { access, members: members ?? [], planLogins: agency.plan_logins, used: new Set((members ?? []).map(m => m.user_id)).size };
});

export const inviteAgent = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ email: emailSchema, displayName: nameSchema })).handler(async ({ data, context }) => {
    const access = await requireOwner(context.supabase, context.userId);
    return inviteLogin(context, { agencyId: access.agencyId, email: data.email, displayName: data.displayName, role: 'agent' });
  });

export const updateMember = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), displayName: nameSchema, splitPercent: z.number().min(0).max(100), goal: z.number().min(0).max(1_000_000_000).nullable() }))
  .handler(async ({ data, context }) => {
    const access = await requireOwner(context.supabase, context.userId);
    const { data: member } = await context.supabase.from('agency_members').select('user_id,annual_gci_goal_aed').eq('id', data.id).eq('agency_id', access.agencyId).single();
    if (!member) throw new Error('Member not found.');
    const goalChanged = Number(member.annual_gci_goal_aed ?? -1) !== Number(data.goal ?? -1);
    if (goalChanged && member.user_id !== context.userId && !canOwnerSetOthersGoal(access.goalMode)) return { error: 'In this agency agents set their own goals. Change this in Settings.' };
    const { error } = await context.supabase.from('agency_members').update({ display_name: data.displayName, split_percent: data.splitPercent, ...(goalChanged ? { annual_gci_goal_aed: data.goal } : {}) }).eq('id', data.id);
    if (error) return { error: error.message.includes('goals') ? error.message : 'Could not save this member.' };
    return { success: true as const };
  });

export const removeAgent = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid()).handler(async ({ data, context }) => {
    const access = await requireOwner(context.supabase, context.userId);
    const { data: member } = await context.supabase.from('agency_members').select('user_id,role').eq('id', data).eq('agency_id', access.agencyId).single();
    if (!member || member.role !== 'agent') return { error: 'Only agents can be removed here.' };
    const { count } = await context.supabase.from('leads').select('id', { count: 'exact', head: true }).eq('agency_id', access.agencyId).eq('assigned_agent_id', member.user_id);
    if (count) return { error: `Reassign this agent's ${count} lead${count === 1 ? '' : 's'} first (Leads page).` };
    const { error } = await context.supabase.from('agency_members').delete().eq('id', data);
    if (error) throw new Error('Could not remove this agent.');
    return { success: true as const };
  });

export const setMyGoal = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.number().min(0).max(1_000_000_000)).handler(async ({ data, context }) => {
    await getAccess(context.supabase, context.userId);
    const { error } = await context.supabase.rpc('set_my_goal', { _goal: data });
    if (error) return { error: error.message };
    return { success: true as const };
  });

/** Self sign-up: the signed-in person creates their own agency and becomes its owner. */
export const createMyAgency = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ name: z.string().trim().min(1, 'Enter your agency name').max(200), displayName: nameSchema })).handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('create_my_agency', { _name: data.name, _display_name: data.displayName });
    if (error) return { error: error.message };
    return { success: true as const };
  });

// ---------- Elite Visions HQ ----------

export const getHqOverview = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await requireHq(context.supabase);
  await context.supabase.rpc('check_missed_leads');
  const { data, error } = await context.supabase.rpc('hq_agency_overview');
  if (error) throw new Error('Could not load agencies.');
  return data.map(r => ({ ...r, monthly_fee_aed: Number(r.monthly_fee_aed), closed_gci_aed: Number(r.closed_gci_aed) }));
});

const agencyFields = z.object({
  name: z.string().trim().min(1, 'Enter the agency name').max(200),
  planLogins: z.number().int().min(1).max(1000),
  monthlyFeeAed: z.number().min(0).max(10_000_000),
  status: z.enum(['active', 'trial', 'paused', 'cancelled']),
});

export const hqCreateAgency = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(agencyFields.extend({ ownerEmail: emailSchema, ownerName: nameSchema })).handler(async ({ data, context }) => {
    await requireHq(context.supabase);
    const { data: agency, error } = await context.supabase.from('agencies').insert({ name: data.name, plan_logins: data.planLogins, monthly_fee_aed: data.monthlyFeeAed, status: data.status }).select('id').single();
    if (error || !agency) throw new Error('Could not create the agency.');
    const result = await inviteLogin(context, { agencyId: agency.id, email: data.ownerEmail, displayName: data.ownerName, role: 'owner' });
    if ('error' in result) {
      await context.supabase.from('agencies').delete().eq('id', agency.id);
      return result;
    }
    return { success: true as const };
  });

export const hqUpdateAgency = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(agencyFields.extend({ id: z.string().uuid() })).handler(async ({ data, context }) => {
    await requireHq(context.supabase);
    const { error } = await context.supabase.from('agencies').update({ name: data.name, plan_logins: data.planLogins, monthly_fee_aed: data.monthlyFeeAed, status: data.status }).eq('id', data.id);
    if (error) throw new Error('Could not save the agency.');
    return { success: true as const };
  });
