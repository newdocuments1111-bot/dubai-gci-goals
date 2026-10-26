import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { getAccess } from './agency-access';
import { dealMath, DEFAULT_SPLIT_PERCENT } from './agency';
import { clientFolder } from './documents';
import { z } from 'zod';

const dealStatus = z.enum(['under offer', 'closed', 'fell through']);

export const listDeals = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const access = await getAccess(context.supabase, context.userId);
  const [{ data: deals, error }, { data: members }] = await Promise.all([
    context.supabase.from('deals').select('*, leads(name), listings(title)').eq('agency_id', access.agencyId).order('created_at', { ascending: false }),
    context.supabase.from('agency_members').select('user_id,display_name,email,split_percent').eq('agency_id', access.agencyId).in('role', ['owner', 'agent']),
  ]);
  if (error) throw new Error('Could not load deals.');
  const byUser = new Map((members ?? []).map(m => [m.user_id, m]));
  return {
    access,
    members: members ?? [],
    deals: (deals ?? []).map(d => {
      const m = byUser.get(d.agent_id);
      const split = m ? Number(m.split_percent) : DEFAULT_SPLIT_PERCENT;
      return { ...d, price_aed: Number(d.price_aed), commission_percent: Number(d.commission_percent), agentName: m ? (m.display_name || m.email) : 'Former agent', splitPercent: split, ...dealMath({ price: Number(d.price_aed), commissionPercent: Number(d.commission_percent), splitPercent: split }) };
    }),
  };
});

export const dealInputSchema = z.object({
  lead_id: z.string().uuid().nullable(),
  listing_id: z.string().uuid().nullable(),
  agent_id: z.string().uuid().optional(),
  deal_type: z.enum(['sale', 'rent']),
  price_aed: z.number().min(0).max(100_000_000_000),
  commission_percent: z.number().min(0).max(100),
  status: dealStatus,
});

/** Turn a lead into a deal. Agents always record deals as themselves; owners may choose the agent. */
export const createDeal = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(dealInputSchema).handler(async ({ data, context }) => {
  const access = await getAccess(context.supabase, context.userId);
  const agent_id = access.isOwner && data.agent_id ? data.agent_id : context.userId;
  const { data: row, error } = await context.supabase.from('deals').insert({ ...data, agent_id }).select('id').single();
  if (error || !row) return { error: error?.message.startsWith('Choose') ? error.message : 'Could not save the deal.' };
  return { id: row.id };
});

export const setDealStatus = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), status: dealStatus })).handler(async ({ data, context }) => {
    await getAccess(context.supabase, context.userId);
    const { error } = await context.supabase.from('deals').update({ status: data.status }).eq('id', data.id);
    if (error) throw new Error('Could not update the deal.');
    return { success: true };
  });

/** Everything needed to prepare paperwork: lead, listing, deal, agency details and the client's vault file names. */
export const getPaperwork = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ leadId: z.string().uuid().optional(), dealId: z.string().uuid().optional() }).refine(v => v.leadId || v.dealId, 'Choose a lead or a deal.'))
  .handler(async ({ data, context }) => {
    const access = await getAccess(context.supabase, context.userId);
    let deal: { id: string; lead_id: string | null; listing_id: string | null; deal_type: string; price_aed: number; commission_percent: number; status: string } | null = null;
    if (data.dealId) {
      const { data: d } = await context.supabase.from('deals').select('id,lead_id,listing_id,deal_type,price_aed,commission_percent,status').eq('id', data.dealId).maybeSingle();
      if (!d) throw new Error('Deal not found.');
      deal = d;
    } else {
      const { data: d } = await context.supabase.from('deals').select('id,lead_id,listing_id,deal_type,price_aed,commission_percent,status').eq('lead_id', data.leadId!).neq('status', 'fell through').order('created_at', { ascending: false }).limit(1).maybeSingle();
      deal = d ?? null;
    }
    const leadId = deal?.lead_id ?? data.leadId ?? null;
    const [{ data: lead }, { data: listing }, { data: settings }] = await Promise.all([
      leadId ? context.supabase.from('leads').select('id,name,phone,type').eq('id', leadId).maybeSingle() : Promise.resolve({ data: null }),
      deal?.listing_id ? context.supabase.from('listings').select('title,community,project,property_type,bedrooms,size_sqft,permit_number').eq('id', deal.listing_id).maybeSingle() : Promise.resolve({ data: null }),
      context.supabase.from('app_settings').select('agency_name,agent_name,rera_brn').eq('agency_id', access.agencyId).maybeSingle(),
    ]);
    let vaultFiles: string[] = [];
    if (lead) {
      const { data: files } = await context.supabase.storage.from('documents').list(clientFolder(access.agencyId, lead.name || lead.id), { limit: 200 });
      vaultFiles = (files ?? []).map(f => f.name).filter(n => n !== '.emptyFolderPlaceholder');
    }
    const dealType: 'sale' | 'rent' = deal ? (deal.deal_type as 'sale' | 'rent') : lead && ['tenant', 'landlord'].includes(lead.type) ? 'rent' : 'sale';
    return {
      dealType,
      lead: lead ? { name: lead.name, phone: lead.phone } : null,
      listing: listing ? { ...listing, size_sqft: Number(listing.size_sqft) } : null,
      deal: deal ? { price_aed: Number(deal.price_aed), commission_percent: Number(deal.commission_percent), status: deal.status } : null,
      agency: { name: settings?.agency_name || access.agencyName, rera_brn: settings?.rera_brn ?? '', agent_name: access.displayName || settings?.agent_name || '' },
      vaultFiles,
    };
  });

/** Light listing + team options for the deal form. */
export const getDealOptions = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const access = await getAccess(context.supabase, context.userId);
  const [{ data: listings }, { data: members }] = await Promise.all([
    context.supabase.from('listings').select('id,title,price_aed,status,completion').eq('agency_id', access.agencyId).order('created_at', { ascending: false }),
    context.supabase.from('agency_members').select('user_id,display_name,email').eq('agency_id', access.agencyId).in('role', ['owner', 'agent']),
  ]);
  return { access, listings: (listings ?? []).map(l => ({ ...l, price_aed: Number(l.price_aed) })), members: [...new Map((members ?? []).map(m => [m.user_id, m])).values()] };
});
