import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { isOwnerEmail } from './owner';
import { leadSchema, scoreLead, amlRedFlags, inQuietHours } from './leads-app';
import { feesSummary } from './ai-reply-rules';
import { eligibleForAI, mapsLink } from './listings';
import { z } from 'zod';

const guard = (email: string | undefined) => { if (!isOwnerEmail(email)) throw new Error('Owner access required.'); };

export const listLeads = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  guard(context.claims.email as string | undefined);
  const { data, error } = await context.supabase.from('leads').select('*').order('last_message_at', { ascending: false, nullsFirst: false });
  if (error) throw new Error('Could not load leads.');
  const order = { Hot: 0, Warm: 1, Cold: 2 };
  return data.sort((a, b) => order[a.score as keyof typeof order] - order[b.score as keyof typeof order]);
});

export const createLead = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(leadSchema).handler(async ({ data, context }) => {
    guard(context.claims.email as string | undefined);
    const { data: lead, error } = await context.supabase.from('leads').insert(data).select('id').single();
    if (error) throw new Error('Could not create the lead.');
    return lead;
  });

export const updateLead = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(leadSchema.partial().extend({ id: z.string().uuid() })).handler(async ({ data, context }) => {
    guard(context.claims.email as string | undefined);
    const { id, ...fields } = data;
    const clean: { name?: string; phone?: string; type?: string; source?: string; timezone?: string } = {};
    if (fields.name !== undefined) clean.name = fields.name;
    if (fields.phone !== undefined) clean.phone = fields.phone;
    if (fields.type !== undefined) clean.type = fields.type;
    if (fields.source !== undefined) clean.source = fields.source;
    if (fields.timezone !== undefined) clean.timezone = fields.timezone;
    const { error } = await context.supabase.from('leads').update(clean).eq('id', id);
    if (error) throw new Error('Could not update the lead.');
    return { success: true };
  });

export const getLeadThread = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid()).handler(async ({ data, context }) => {
    guard(context.claims.email as string | undefined);
    const [{ data: lead, error }, { data: messages }] = await Promise.all([
      context.supabase.from('leads').select('*').eq('id', data).single(),
      context.supabase.from('chat_messages').select('*').eq('lead_id', data).order('created_at'),
    ]);
    if (error || !lead) throw new Error('Lead not found.');
    return { lead, messages: messages ?? [] };
  });

/** Pause or resume the AI on a conversation. The AI never replies while paused. */
export const setAiPaused = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), paused: z.boolean() })).handler(async ({ data, context }) => {
    guard(context.claims.email as string | undefined);
    const { error } = await context.supabase.from('leads').update({ ai_paused: data.paused }).eq('id', data.id);
    if (error) throw new Error('Could not update the conversation.');
    return { success: true };
  });

async function buildAiContext(supabase: typeof import('@/integrations/supabase/client').supabase) {
  const [{ data: rules }, { data: knowledge }, { data: listings }, { data: settings }] = await Promise.all([
    supabase.from('ai_reply_settings').select('agency_name,rules,fees').eq('id', 'owner').maybeSingle(),
    supabase.from('uae_knowledge').select('topic,fact,last_verified'),
    supabase.from('listings').select('*').eq('status', 'Available'),
    supabase.from('app_settings').select('*').eq('id', 'owner').maybeSingle(),
  ]);
  const eligible = (listings ?? []).filter(l => eligibleForAI(l)).map(l => ({
    title: l.title, community: l.community, project: l.project, type: l.property_type, bedrooms: l.bedrooms,
    size_sqft: l.size_sqft, price_aed: l.price_aed, completion: l.completion, handover_date: l.handover_date,
    description: l.description, map: mapsLink(l), highlights: l.agent_highlights, do_not_mention: l.do_not_mention,
    details: { schools: l.nearby_schools, parks: l.nearby_parks, clinics: l.nearby_clinics, metro: l.nearby_metro, malls: l.nearby_malls, beach: l.nearby_beach, supermarket: l.nearby_supermarket, pool: l.amenity_pool, gym: l.amenity_gym, kids_play_area: l.amenity_kids_play_area, security: l.amenity_security, parking_spaces: l.parking_spaces, floor: l.floor, view: l.view, furnishing: l.furnishing, developer: l.developer, payment_plan: l.payment_plan, construction_percent: l.construction_percent, service_charge_aed_sqft_year: l.service_charge_aed_sqft_year, video_tour_url: l.video_tour_url },
  }));
  const r = (rules?.rules ?? {}) as Record<string, string>;
  return {
    agency: rules?.agency_name || settings?.agency_name || '',
    rules: Object.values(r).filter(Boolean),
    fees: feesSummary({ dld_transfer_pct: 4, admin_fee_min: 2000, admin_fee_max: 4000, trustee_fee_min: 2000, trustee_fee_max: 4000, developer_noc_min: 500, developer_noc_max: 5000, mortgage_registration_pct: 0.25, ...((rules?.fees ?? {}) as object) }),
    knowledge: (knowledge ?? []).map(k => `${k.topic}: ${k.fact}`),
    listings: eligible,
    settings: settings ? { agent_name: settings.agent_name, working_days: settings.working_days, work_start: settings.work_start, work_end: settings.work_end, viewing_minutes: settings.viewing_minutes, holidays: settings.holidays, mortgage_partner: settings.mortgage_partner } : null,
  };
}

const CHAT_SYSTEM = `You are the WhatsApp reply brain for a Dubai real estate agency. Follow the reply rules, UAE knowledge and listings below exactly.
Hard rules: never promise or negotiate price, fees, discounts, profit or future prices; never explain contract terms; never give legal, tax or mortgage advice; never claim to be the agent or a human (answer honestly if asked); never invent details; respect each listing's "do_not_mention"; say fees are approximate and the agent will confirm. If unsure, or the question is legal, financial or about contract terms, say the agent will confirm and set "flag": true.
Reply in the same language the client writes in, and switch if they switch. Keep names, prices and numbers exactly correct. If the client says stop/unsubscribe (any language), confirm once and set "stopped": true.
If the client wants to make an offer or book a valuation, reply warmly that the agent will call today and set "hot": true (with "hotReason").
If the client needs financing, offer to connect them with the mortgage adviser partner from settings; never give mortgage advice or rates.
Detect the conversation type: buyer, seller, landlord or tenant, and learn naturally: budget, location (area/community/project), move_in time, property type, off-plan or ready, cash or mortgage; for sellers/landlords learn the property and offer a valuation at the next free slot; for tenants learn budget per year, move-in date, cheques and family size.
Answer property questions only from the eligible listings given (Available and checked within 24 hours). Otherwise say you will confirm with the agent first thing in the morning.
Respond with JSON only: {"reply":"...","language":"en","learned":{"budget":null,"location":null,"move_in":null},"type":"buyer|seller|landlord|tenant|other","hot":false,"hotReason":"","flag":false,"stopped":false}`;

/** Owner plays the client in Test Chat: stores the message, then the AI replies unless paused or stopped. */
export const sendClientMessage = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ leadId: z.string().uuid(), content: z.string().trim().min(1).max(10000) }))
  .handler(async ({ data, context }) => {
    guard(context.claims.email as string | undefined);
    const { data: lead, error: leadError } = await context.supabase.from('leads').select('*').eq('id', data.leadId).single();
    if (leadError || !lead) throw new Error('Lead not found.');

    await context.supabase.from('chat_messages').insert({ lead_id: data.leadId, role: 'client', content: data.content, sent: true });
    await context.supabase.from('leads').update({ last_message_at: new Date().toISOString() }).eq('id', data.leadId);

    // AML red flags — private, never shown to the client. The AI never accepts payments.
    const flags = amlRedFlags(data.content);
    if (flags.length) {
      await context.supabase.from('alerts').insert({ lead_id: data.leadId, kind: 'aml', message: `AML red flags from ${lead.name || 'this lead'}: ${flags.join('; ')}. Report via REAR on goAML if required.` });
    }
    if (lead.ai_paused || lead.stopped) return { replied: false };

    const { data: history } = await context.supabase.from('chat_messages').select('role,content').eq('lead_id', data.leadId).order('created_at').limit(40);
    const ctx = await buildAiContext(context.supabase);
    const { generateJson } = await import('./chat.server');
    let ai: { reply?: string; language?: string; learned?: Record<string, unknown>; type?: string; hot?: boolean; hotReason?: string; flag?: boolean; stopped?: boolean };
    try {
      ai = await generateJson({
        system: `${CHAT_SYSTEM}\n\nReply rules:\n${ctx.rules.join('\n')}\n\nFees: ${ctx.fees}\n\nUAE knowledge:\n${ctx.knowledge.join('\n')}\n\nEligible listings:\n${JSON.stringify(ctx.listings)}\n\nSettings:\n${JSON.stringify(ctx.settings)}`,
        user: JSON.stringify({ lead: { name: lead.name, type: lead.type, learned: lead.learned }, history }),
      }) as typeof ai;
    } catch (e) {
      console.error(e);
      throw new Error('AI could not reply. Your message is saved — try again.');
    }

    const reply = String(ai.reply ?? '').trim();
    if (reply) {
      const quiet = inQuietHours(lead.timezone);
      await context.supabase.from('chat_messages').insert({ lead_id: data.leadId, role: 'ai', content: reply, language: ai.language ?? 'en', sent: !quiet });
    }
    const learned = { ...(lead.learned as Record<string, unknown>), ...(ai.learned ?? {}) };
    const score = scoreLead(learned);
    const type = ai.type && ['buyer', 'seller', 'landlord', 'tenant'].includes(ai.type) ? ai.type : lead.type;
    await context.supabase.from('leads').update({ learned: learned as Record<string, string>, score, type, flagged: lead.flagged || Boolean(ai.flag), stopped: lead.stopped || Boolean(ai.stopped) }).eq('id', data.leadId);
    if (ai.stopped) await context.supabase.from('consent_log').insert({ lead_id: data.leadId, agreed_to: 'Stopped all messages', how: 'Client said stop in chat' });
    if (ai.hot && score === 'Hot') {
      await context.supabase.from('alerts').insert({ lead_id: data.leadId, kind: 'hot', message: `HOT: ${lead.name || 'A lead'} ${ai.hotReason || 'is ready to move'}. Call them today.` });
    }
    return { replied: Boolean(reply) };
  });

/** Owner's own message while taking over a conversation. */
export const sendOwnerMessage = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ leadId: z.string().uuid(), content: z.string().trim().min(1).max(10000) }))
  .handler(async ({ data, context }) => {
    guard(context.claims.email as string | undefined);
    const { error } = await context.supabase.from('chat_messages').insert({ lead_id: data.leadId, role: 'owner', content: data.content, sent: true });
    if (error) throw new Error('Could not send the message.');
    await context.supabase.from('leads').update({ last_message_at: new Date().toISOString() }).eq('id', data.leadId);
    return { success: true };
  });

export const saveLeadToHubSpot = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid()).handler(async ({ data, context }) => {
    guard(context.claims.email as string | undefined);
    const { data: lead } = await context.supabase.from('leads').select('*').eq('id', data).single();
    if (!lead) throw new Error('Lead not found.');
    const { data: messages } = await context.supabase.from('chat_messages').select('role,content').eq('lead_id', data).order('created_at').limit(30);
    const summary = (messages ?? []).map(m => `${m.role}: ${m.content}`).join('\n').slice(0, 5000) || '(no messages yet)';
    const { saveContactToHubSpot } = await import('./chat.server');
    const id = await saveContactToHubSpot({ name: lead.name || 'Unnamed lead', phone: lead.phone, note: `Dubai AI GCI chat summary (${lead.type}, ${lead.score}):\n${summary}`, existingId: lead.hubspot_id });
    await context.supabase.from('leads').update({ hubspot_id: id }).eq('id', data);
    return { success: true };
  });

export const listAlerts = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  guard(context.claims.email as string | undefined);
  const { data, error } = await context.supabase.from('alerts').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) throw new Error('Could not load alerts.');
  return data;
});

export const markAlertRead = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid()).handler(async ({ data, context }) => {
    guard(context.claims.email as string | undefined);
    await context.supabase.from('alerts').update({ read: true }).eq('id', data);
    return { success: true };
  });
