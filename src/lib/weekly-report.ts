import { z } from 'zod';
import { dealMath } from './agency';
import { normaliseLanguage } from './reply-i18n';

const rowTime = z.string();
export const reportSourceSchema = z.object({
  agency_name: z.string(), goal: z.coerce.number(), generated_at: rowTime,
  members: z.array(z.object({ user_id:z.string(), display_name:z.string(), email:z.string(), split_percent:z.coerce.number(), annual_gci_goal_aed:z.coerce.number().nullable(), role:z.string() })),
  leads: z.array(z.object({ id:z.string(), assigned_agent_id:z.string().nullable(), created_at:rowTime, source:z.string(), language:z.string(), score:z.string() })),
  messages: z.array(z.object({ id:z.string(), lead_id:z.string(), role:z.string(), created_at:rowTime, sent:z.boolean(), author_id:z.string().nullable(), wa_sent_at:rowTime.nullable(), wa_status:z.string().nullable() })),
  viewings: z.array(z.object({ id:z.string(), lead_id:z.string().nullable(), created_at:rowTime, starts_at:rowTime, status:z.string(), done_at:rowTime.nullable() })),
  deals: z.array(z.object({ agent_id:z.string(), lead_id:z.string().nullable(), price_aed:z.coerce.number(), commission_percent:z.coerce.number(), status:z.string(), closed_at:rowTime.nullable(), created_at:rowTime })),
  alerts: z.array(z.object({ lead_id:z.string().nullable(), kind:z.string(), created_at:rowTime })),
  listings: z.array(z.object({ last_checked:rowTime, needs_check:z.boolean(), status:z.string() })),
  followups: z.array(z.object({ lead_id:z.string().nullable(), kind:z.string(), viewing_id:z.string().nullable(), sent_at:rowTime.nullable(), chat_message_id:z.string().nullable() })),
  usage: z.array(z.object({ type:z.string(), created_at:rowTime })),
});
export type ReportSource = z.infer<typeof reportSourceSchema>;
export function mondayOfWeek(now = new Date()) {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Dubai', year:'numeric',month:'2-digit',day:'2-digit' }).format(now);
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay()+6)%7);
  return d.toISOString().slice(0,10);
}
export function shiftWeek(week:string, weeks:number) { return new Date(Date.parse(`${week}T00:00:00Z`)+weeks*7*86400000).toISOString().slice(0,10); }
export function weekBounds(week:string) {
  const start=Date.parse(`${week}T00:00:00+04:00`);
  return { start, end:start+7*86400000 };
}
export function goalGap(goal:number, gciYear:number, closedYear:number) {
  const gap=Math.max(0,goal-gciYear);
  const average=closedYear ? gciYear/closedYear : 40000;
  return { goal, gap, average, assumption:closedYear===0, dealsNeeded:average>0 ? Math.ceil(gap/average) : null };
}
export function canReadReport(isOwner:boolean,isHq:boolean) { return isOwner || isHq; }
export function buildWeeklyReport(raw:ReportSource,week:string,agentId?:string) {
  const {start,end}=weekBounds(week);
  const asOf=Math.min(Date.parse(raw.generated_at),end);
  const inWeek=(time:string|null) => !!time && Date.parse(time)>=start && Date.parse(time)<end && Date.parse(time)<=asOf;
  const included=new Set(raw.leads.filter(l=>!agentId || l.assigned_agent_id===agentId).map(l=>l.id));
  const own=(id:string|null) => !agentId || (id!==null && included.has(id));
  const enquiries=raw.leads.filter(l=>own(l.id)&&inWeek(l.created_at));
  const languages={ en:0,ar:0,hi:0,ru:0 };
  const sources:Record<string,number>={};
  for(const l of enquiries) { languages[normaliseLanguage(l.language)]++; sources[l.source]=(sources[l.source]??0)+1; }
  const delays:number[]=[];
  let repliedWithin60=0,firstEnquiries=0;
  for(const l of raw.leads.filter(l=>own(l.id))) {
    const thread=raw.messages.filter(m=>m.lead_id===l.id).sort((a,b)=>a.created_at.localeCompare(b.created_at));
    const first=thread.find(m=>m.role==='client');
    if(!first || !inWeek(first.created_at)) continue;
    firstEnquiries++;
    const response=thread.find(m=>m.role==='ai'&&m.sent&&Date.parse(m.wa_sent_at??m.created_at)>=Date.parse(first.created_at)&&Date.parse(m.wa_sent_at??m.created_at)<=asOf);
    if(response) { const seconds=(Date.parse(response.wa_sent_at??response.created_at)-Date.parse(first.created_at))/1000; delays.push(seconds); if(seconds<=60) repliedWithin60++; }
  }
  const messages=raw.messages.filter(m=>own(m.lead_id)&&inWeek(m.created_at));
  const takenOver=new Set(messages.filter(m=>m.role==='owner').map(m=>m.lead_id));
  const aiHandled=new Set(messages.filter(m=>m.role==='ai'&&!takenOver.has(m.lead_id)).map(m=>m.lead_id));
  const viewings=raw.viewings.filter(v=>own(v.lead_id));
  const ref=new Date(asOf-1).toLocaleDateString('en-CA',{ timeZone:'Asia/Dubai' });
  const monthStart=Date.parse(`${ref.slice(0,7)}-01T00:00:00+04:00`),yearStart=Date.parse(`${ref.slice(0,4)}-01-01T00:00:00+04:00`);
  const split=new Map(raw.members.map(m=>[m.user_id,m.split_percent]));
  const closed=raw.deals.filter(d=>d.status==='closed'&&d.closed_at&&(!agentId||d.agent_id===agentId));
  const sum=(since:number) => {
    const out={ deals:0,gci:0,agencyShare:0,agentShare:0 };
    for(const d of closed) {
      const at=Date.parse(d.closed_at ?? ''); if(at<since || at>=end || at>asOf) continue;
      const money=dealMath({price:d.price_aed,commissionPercent:d.commission_percent,splitPercent:split.get(d.agent_id)??50});
      out.deals++;out.gci+=money.gci;out.agencyShare+=money.agencyShare;out.agentShare+=money.agentShare;
    }
    return out;
  };
  const weekGci=sum(start),monthGci=sum(monthStart),yearGci=sum(yearStart);
  const goal=agentId ? raw.members.find(m=>m.user_id===agentId)?.annual_gci_goal_aed??0 : raw.goal;
  const followups=raw.followups.filter(f=>own(f.lead_id) && (f.viewing_id!==null || ['follow-up','viewing_followup','viewing_2day'].includes(f.kind)));
  const followupsSent=followups.filter(f=>{
    if(inWeek(f.sent_at)) return true;
    const m=raw.messages.find(m=>m.id===f.chat_message_id);
    return !!m&&m.sent&&inWeek(m.wa_sent_at??m.created_at);
  }).length;
  const fresh=raw.listings.filter(l=>l.status==='Available'&&!l.needs_check&&Date.parse(l.last_checked)>Date.parse(raw.generated_at)-86400000&&Date.parse(l.last_checked)<=Date.parse(raw.generated_at)).length;
  return {
    week,generatedAt:raw.generated_at,enquiries:enquiries.length,sources,languages,
    firstReply:{ averageSeconds:delays.length?delays.reduce((a,b)=>a+b,0)/delays.length:0,within60Percent:firstEnquiries?repliedWithin60/firstEnquiries*100:0,replied:delays.length,enquiries:firstEnquiries },
    aiHandled:aiHandled.size,takenOver:takenOver.size,
    viewings:{booked:viewings.filter(v=>inWeek(v.created_at)).length,done:viewings.filter(v=>v.status==='done'&&inWeek(v.done_at)).length,noShow:viewings.filter(v=>v.status==='no-show'&&inWeek(v.starts_at)).length},
    followupsSent,hotLeads:enquiries.filter(l=>l.score==='Hot').length,
    offers:raw.deals.filter(d=>(!agentId||d.agent_id===agentId)&&inWeek(d.created_at)).length,
    weekGci,monthGci,yearGci,goal:goalGap(goal,yearGci.gci,yearGci.deals),
    missed:raw.alerts.filter(a=>own(a.lead_id)&&a.kind==='missed'&&inWeek(a.created_at)).length,
    listings:{ fresh,unavailableToAi:raw.listings.length-fresh },
    usage:agentId?null:{ aiReplies:raw.usage.filter(u=>u.type==='ai_reply'&&inWeek(u.created_at)).length,whatsappMessages:raw.usage.filter(u=>u.type==='whatsapp_message'&&inWeek(u.created_at)).length },
  };
}
export type WeeklyReport = ReturnType<typeof buildWeeklyReport>;
export function reportWhatsApp(r:WeeklyReport,agency:string) {
  return `${agency} — Monday report (${r.week})\n${r.enquiries} enquiries · ${r.hotLeads} Hot leads\nAI first reply: ${Math.round(r.firstReply.averageSeconds)}s average; ${Math.round(r.firstReply.within60Percent)}% within 60s\n${r.viewings.booked} viewings booked · ${r.viewings.done} done · ${r.viewings.noShow} no-show\n${r.weekGci.deals} deals closed · AED ${r.weekGci.gci.toLocaleString('en-GB')} GCI\nYear: AED ${r.yearGci.gci.toLocaleString('en-GB')} / AED ${r.goal.goal.toLocaleString('en-GB')} goal\nGap: AED ${r.goal.gap.toLocaleString('en-GB')} · ${r.goal.dealsNeeded??'not calculable'} deals needed${r.goal.assumption?' (assumption: AED 40,000 per deal)':''}\n${r.missed} missed alerts · ${r.listings.unavailableToAi} listings AI cannot offer`;
}