import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import type { GoalMode, Membership } from './agency';

type Client = SupabaseClient<Database>;

/** Reads the caller's agency membership with their own access rules. Never trust an agency id sent by the browser. */
export async function getAccess(supabase: Client, userId: string): Promise<Membership> {
  const { data, error } = await supabase.from('agency_members')
    .select('agency_id,role,display_name,split_percent,annual_gci_goal_aed,agencies(name,goal_setting_mode)')
    .eq('user_id', userId);
  if (error) throw new Error('Could not check your access.');
  const main = data.find(r => r.role === 'owner') ?? data.find(r => r.role === 'agent');
  if (!main) throw new Error('Create or join an agency first.');
  const agency = main.agencies as unknown as { name: string; goal_setting_mode: GoalMode } | null;
  return {
    userId,
    agencyId: main.agency_id,
    agencyName: agency?.name ?? '',
    role: main.role as 'owner' | 'agent',
    isOwner: main.role === 'owner',
    isHq: data.some(r => r.role === 'hq_admin'),
    displayName: main.display_name,
    splitPercent: Number(main.split_percent),
    goal: main.annual_gci_goal_aed === null ? null : Number(main.annual_gci_goal_aed),
    goalMode: agency?.goal_setting_mode ?? 'both',
  };
}

export async function requireOwner(supabase: Client, userId: string) {
  const access = await getAccess(supabase, userId);
  if (!access.isOwner) throw new Error('Only the agency owner can do this.');
  return access;
}

export async function requireHq(supabase: Client) {
  const { data, error } = await supabase.rpc('is_hq_admin');
  if (error || data !== true) throw new Error('Only Elite Visions HQ can do this.');
  return true;
}
