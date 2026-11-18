import { createFileRoute } from '@tanstack/react-router';
import { queryOptions,useQuery,useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Copy,Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getWeeklyReport } from '@/lib/weekly-report.functions';
import { getPipeline } from '@/lib/pipeline.functions';
import { adDecisions, aed as aedPipe, isOverdue, minutes, ruleFor, totals } from '@/lib/pipeline';
import { reportWhatsApp,shiftWeek,type WeeklyReport } from '@/lib/weekly-report';
const initial=queryOptions({queryKey:['weekly-report','last'],queryFn:()=>getWeeklyReport({data:{}})});
const pipelineQuery=queryOptions({queryKey:['pipeline'],queryFn:()=>getPipeline()});
export const Route=createFileRoute('/_authenticated/owner/weekly-report')({
  head:()=>({meta:[{title:'Monday report — Dubai AI GCI'},{name:'description',content:'Agency and agent weekly activity measured against saved GCI goals.'},{property:'og:title',content:'Monday report — Dubai AI GCI'},{property:'og:description',content:'Private weekly enquiries, viewings and closed-deal GCI report.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'},{name:'robots',content:'noindex'}]}),
  loader:({context})=>context.queryClient.ensureQueryData(initial),component:WeeklyReportPage,
});
const aed=(n:number)=>`AED ${Math.round(n).toLocaleString('en-GB')}`;
function ReportNumbers({r}:{r:WeeklyReport}) {
  const numbers=[['Enquiries',r.enquiries],['AI first reply average',`${Math.round(r.firstReply.averageSeconds)} seconds`],['AI within 60 seconds',`${Math.round(r.firstReply.within60Percent)}% (${r.firstReply.replied}/${r.firstReply.enquiries} replied)`],['AI-handled conversations',r.aiHandled],['Taken over by agent',r.takenOver],['Viewings booked',r.viewings.booked],['Viewings done',r.viewings.done],['No-shows',r.viewings.noShow],['After-viewing follow-ups sent',r.followupsSent],['Hot leads created',r.hotLeads],['Offers recorded',r.offers],['Missed-lead alerts',r.missed]];
  return <>
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">{numbers.map(([label,value])=><div key={label} className="border-b border-border pb-2"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-semibold">{value}</dd></div>)}</dl>
    <div className="mt-4 grid gap-4 sm:grid-cols-2"><div><h3 className="text-sm font-semibold">Sources</h3>{Object.entries(r.sources).map(([s,n])=><p key={s} className="text-sm">{s}: {n}</p>)}{!Object.keys(r.sources).length&&<p className="text-sm">0</p>}</div><div><h3 className="text-sm font-semibold">Enquiry languages</h3><p className="text-sm">English {r.languages.en} · العربية {r.languages.ar} · हिन्दी {r.languages.hi} · Русский {r.languages.ru}</p></div></div>
    <div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left"><th>Period</th><th>Closed deals</th><th>Total GCI</th><th>Agency share</th><th>Agent share</th></tr></thead><tbody>{[['Week',r.weekGci],['Month to week end',r.monthGci],['Year to week end',r.yearGci]].map(([label,v])=>{const value=v as WeeklyReport['weekGci'];return <tr key={String(label)} className="border-t border-border"><td className="py-2">{String(label)}</td><td>{value.deals}</td><td>{aed(value.gci)}</td><td>{aed(value.agencyShare)}</td><td>{aed(value.agentShare)}</td></tr>;})}</tbody></table></div>
    <p className="mt-3 text-sm">Yearly total GCI goal: <strong>{aed(r.goal.goal)}</strong> · Gap: <strong>{aed(r.goal.gap)}</strong> · Deals still needed: <strong>{r.goal.dealsNeeded??'Not calculable (zero GCI)'}</strong></p>
    {r.goal.goal===0&&<p className="text-xs text-muted-foreground">Goal not set.</p>}
    <p className="text-xs text-muted-foreground">{r.goal.assumption?'Assumption: AED 40,000 per closed deal (no closed deals this year).':`Recorded average GCI per closed deal this year: ${aed(r.goal.average)}.`}</p>
  </>;
}
function WeeklyReportPage() {
  const {data:base}=useSuspenseQuery(initial);
  const [week,setWeek]=useState(base.week),[note,setNote]=useState('');
  const {data,error,isFetching}=useQuery({queryKey:['weekly-report',week],queryFn:()=>getWeeklyReport({data:{week}}),initialData:week===base.week?base:undefined});
  const result=data??base;
  return <main className="weekly-report mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <div className="mb-6 flex flex-wrap items-center gap-3"><h1 className="mr-auto text-3xl font-bold">Monday report</h1><label className="report-controls text-sm">Week starting<Input aria-label="Report week" type="date" value={week} onChange={e=>{if(e.target.value)setWeek(e.target.value);}}/></label><Button className="report-controls" variant="outline" onClick={async()=>{try{await navigator.clipboard.writeText(reportWhatsApp(result.report,result.agencyName));setNote('Copied.');}catch{setNote('Could not copy.');}}}><Copy className="size-4"/>Copy as WhatsApp message</Button><Button className="report-controls" variant="outline" onClick={()=>window.print()}><Printer className="size-4"/>Print / PDF</Button></div>
    {error&&<p role="alert" className="text-destructive">{error.message}</p>}{note&&<p role="status">{note}</p>}
    <p className="mb-4 text-sm text-muted-foreground">{result.agencyName} · {result.week} – {new Date(Date.parse(`${shiftWeek(result.week,1)}T00:00:00Z`)-86400000).toISOString().slice(0,10)} · Dubai time · {result.snapshot?'Saved Monday snapshot':'Live recorded rows — no saved snapshot for this week'}{isFetching?' · Loading…':''}</p>
    <section className="space-y-3"><h2 className="text-xl font-semibold">Agency</h2><ReportNumbers r={result.report}/><p className="text-sm">Listings available and checked within 24h: {result.report.listings.fresh} · AI cannot offer: {result.report.listings.unavailableToAi}</p>{result.report.usage&&<p className="text-sm">AI replies: {result.report.usage.aiReplies} · WhatsApp messages: {result.report.usage.whatsappMessages}</p>}</section>
    <PipelineSection/>
    <p className="my-4 text-xs text-muted-foreground">Offers are recorded deal entries. Completion and follow-up totals exclude records without completion or send timestamps. Current assignments and commission splits apply. First-reply percentage includes unanswered enquiries. Listings freshness is as of report generation.</p>
    {result.agents.map(agent=><section key={agent.id} className="mt-8 border-t border-border pt-5"><h2 className="mb-4 text-xl font-semibold">{agent.name}</h2><ReportNumbers r={agent.report}/></section>)}
    {result.pastWeeks.length>0&&<div className="report-controls mt-6"><h2 className="font-semibold">Saved weeks</h2><div className="flex flex-wrap gap-2">{result.pastWeeks.map(w=><Button key={w} variant="outline" size="sm" onClick={()=>setWeek(w)}>{w}</Button>)}</div></div>}
  </main>;
}
/** The plan's numbers: where leads come from, which ads to keep, and what is overdue today. Live rows, not a snapshot. */
function PipelineSection() {
  const {data}=useQuery(pipelineQuery);
  if(!data) return null;
  const t=totals(data.report);
  const decisions=adDecisions(data.ads,data.report);
  const overdue=data.leads.filter(l=>isOverdue(l)).sort((a,b)=>(a.next_action_at??'').localeCompare(b.next_action_at??''));
  const open=data.leads.filter(l=>l.outcome==='open');
  const byStage=new Map<number,number>(); for(const l of open) byStage.set(l.stage,(byStage.get(l.stage)??0)+1);
  return <section className="mt-8 space-y-4 border-t border-border pt-5">
    <h2 className="text-xl font-semibold">Pipeline and sources <span className="text-sm font-normal text-muted-foreground">(live, all time)</span></h2>
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">{[['Leads',t.leads],['Replied',`${t.repliedPct}%`],['Average first reply',minutes(t.avgReplyMinutes)],['Nights and weekends',t.outOfHours],['Qualified',t.qualified],['Viewings attended',`${t.attended} / ${t.booked} booked`],['Ad spend',aedPipe(t.spend)],['Cost per attended viewing',aedPipe(t.costPerViewing)]].map(([label,value])=><div key={String(label)} className="border-b border-border pb-2"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-semibold">{value}</dd></div>)}</dl>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left"><th>Source</th><th>Leads</th><th>Replied</th><th>Reply time</th><th>Qualified</th><th>Attended</th><th>Won</th><th>Spend</th><th>Cost / viewing</th></tr></thead><tbody>{[...data.report].sort((a,b)=>Number(b.leads??0)-Number(a.leads??0)).map(r=><tr key={`${r.source}-${r.source_type}`} className="border-t border-border"><td className="py-1">{r.source}</td><td>{r.leads}</td><td>{r.replied_pct}%</td><td>{minutes(r.avg_first_reply_minutes)}</td><td>{r.qualified}</td><td>{r.viewings_attended}</td><td>{r.won}</td><td>{r.spend==null?'—':aedPipe(r.spend)}</td><td>{r.cost_per_attended_viewing==null?'—':aedPipe(r.cost_per_attended_viewing)}</td></tr>)}</tbody></table></div>
    {decisions.length>0&&<div><h3 className="text-sm font-semibold">Ads: what to decide (day-14 rule)</h3>{decisions.map(d=><p key={d.name} className="text-sm"><strong className="uppercase">{d.action}</strong> {d.name}: <span className="text-muted-foreground">{d.reason}</span></p>)}</div>}
    <div><h3 className="text-sm font-semibold">Needs a decision today</h3>{overdue.length===0?<p className="text-sm text-muted-foreground">Nothing overdue. Every open lead has its next action in the future.</p>:<table className="w-full text-sm"><thead><tr className="text-left"><th>Lead</th><th>Step</th><th>Next action</th><th>Was due</th><th>Who</th></tr></thead><tbody>{overdue.map(l=><tr key={l.id} className="border-t border-border"><td className="py-1">{l.name||'Unnamed lead'}</td><td>{l.stage}. {ruleFor(data.rules,l.stage,l.track).name}</td><td>{l.next_action}</td><td>{l.next_action_at?new Date(l.next_action_at).toLocaleString('en-GB',{timeZone:'Asia/Dubai'}):'—'}</td><td>{l.who}</td></tr>)}</tbody></table>}</div>
    <div><h3 className="text-sm font-semibold">Where every open lead sits</h3><p className="text-sm">{Array.from({length:15},(_,i)=>i+1).filter(s=>(byStage.get(s)??0)>0).map(s=>`${s}. ${ruleFor(data.rules,s,'ready').name}: ${byStage.get(s)}`).join(' · ')||'No open leads.'}</p></div>
  </section>;
}
