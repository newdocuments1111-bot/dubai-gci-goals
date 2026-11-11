import { expect,it } from 'vitest';
import { secondViewingDue,followupApprovalBlock,zonedLocalToUtc } from './post-viewing';
const input={done:true,firstAt:'2026-11-09T06:00:00Z',lastClientAt:'2026-11-08T05:00:00Z',alreadyDrafted:false,stopped:false,optedIn:true,consentOk:true};
it('queues next morning at exactly 10am in the client timezone',()=>{expect(new Date(zonedLocalToUtc('2026-11-12','10:00','Asia/Dubai')).toISOString()).toBe('2026-11-12T06:00:00.000Z');expect(new Date(zonedLocalToUtc('2026-11-12','10:00','Asia/Kolkata')).toISOString()).toBe('2026-11-12T04:30:00.000Z');});
it('requires a full 48 hours',()=>{expect(secondViewingDue(input,new Date('2026-11-11T05:59:59Z'))).toBe(false);expect(secondViewingDue(input,new Date('2026-11-11T06:00:00Z'))).toBe(true);});
it('creates no second draft after a reply or duplicate',()=>{expect(secondViewingDue({...input,lastClientAt:'2026-11-10T06:00:00Z'},new Date('2026-11-11T06:00:00Z'))).toBe(false);expect(secondViewingDue({...input,alreadyDrafted:true},new Date('2026-11-11T06:00:00Z'))).toBe(false);});
it.each([{stopped:true},{optedIn:false},{consentOk:false},{done:false},{firstAt:null}])('requires completed viewing and consent: %j',changes=>expect(secondViewingDue({...input,...changes},new Date('2026-11-11T06:00:00Z'))).toBe(false));
it('blocks quiet hours and late Dubai sending hours',()=>{
 const safe={stopped:false,optedIn:true,consentOk:true,timezone:'Asia/Dubai',nextClientReply:false};
 expect(followupApprovalBlock(safe,new Date('2026-11-11T06:00:00Z'))).toBeNull();
 expect(followupApprovalBlock(safe,new Date('2026-11-11T17:00:00Z'))).toContain('quiet hours');
 expect(followupApprovalBlock({...safe,timezone:'Europe/London'},new Date('2026-11-11T16:00:00Z'))).toContain('9am');
});