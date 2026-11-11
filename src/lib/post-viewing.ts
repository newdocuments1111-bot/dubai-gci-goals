import { inQuietHours } from './leads-app';
export function zonedLocalToUtc(date:string,time:string,zone:string) {
  const target=Date.parse(`${date}T${time}:00Z`);
  let guess=target;
  for(let i=0;i<3;i++) {
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(guess));
    const field=(name:string)=>parts.find(p=>p.type===name)?.value??'00';
    const local=Date.parse(`${field('year')}-${field('month')}-${field('day')}T${field('hour')}:${field('minute')}:${field('second')}Z`);
    guess+=target-local;
  }
  return guess;
}
/** Same 48-hour/no-reply/consent rule used by the hourly SQL job. */
export function secondViewingDue(input:{done:boolean;firstAt:string|null;lastClientAt:string|null;alreadyDrafted:boolean;stopped:boolean;optedIn:boolean;consentOk:boolean},now=new Date()) {
  if(!input.done||!input.firstAt||input.alreadyDrafted||input.stopped||!input.optedIn||!input.consentOk) return false;
  const first=Date.parse(input.firstAt);
  return Number.isFinite(first)&&now.getTime()-first>=48*3600000&&(!input.lastClientAt||Date.parse(input.lastClientAt)<=first);
}
export function followupApprovalBlock(input:{stopped:boolean;optedIn:boolean;consentOk:boolean;timezone:string;nextClientReply:boolean},now=new Date()) {
  if(input.stopped||!input.optedIn||!input.consentOk) return 'Client has not agreed to contact or has stopped messages.';
  if(input.nextClientReply) return 'The client has replied; this follow-up is no longer needed.';
  if(inQuietHours(input.timezone,now)) return 'Client quiet hours: approve when the client is awake.';
  const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Dubai',hour:'numeric',hour12:false}).format(now));
  if(hour<9||hour>=20) return 'Sending hours are 9am–8pm Dubai time.';
  return null;
}