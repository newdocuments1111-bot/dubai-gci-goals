import { inQuietHours } from './leads-app';
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