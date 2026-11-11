import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { getAccess } from './agency-access';
import { buildWeeklyReport, canReadReport, mondayOfWeek, reportSourceSchema, shiftWeek } from './weekly-report';
import { z } from 'zod';
export const getWeeklyReport = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator(z.object({week:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),current:z.boolean().optional(),agencyId:z.string().uuid().optional()}))
  .handler(async({data,context})=>{
    const access=await getAccess(context.supabase,context.userId);
    if(!canReadReport(access.isOwner,access.isHq)) throw new Error('Only agency owners and HQ can read Monday reports.');
    const agencyId=access.isHq&&data.agencyId?data.agencyId:access.agencyId;
    const week=data.week?mondayOfWeek(new Date(`${data.week}T12:00:00+04:00`)):shiftWeek(mondayOfWeek(),data.current?0:-1);
    const [{data:snapshot,error:se},{data:past,error:pe}]=await Promise.all([
      context.supabase.from('weekly_reports').select('report,generated_at').eq('agency_id',agencyId).eq('week_start',week).maybeSingle(),
      context.supabase.from('weekly_reports').select('week_start').eq('agency_id',agencyId).order('week_start',{ascending:false}),
    ]);
    if(se||pe) throw new Error('Could not load the Monday report.');
    let source=snapshot?.report;
    if(!source) {
      const result=await context.supabase.rpc('weekly_report_source',{p_agency:agencyId});
      if(result.error) throw new Error('Could not load the Monday report.');
      source=result.data;
    }
    const raw=reportSourceSchema.parse(source);
    return {agencyName:raw.agency_name,week,snapshot:!!snapshot,pastWeeks:(past??[]).map(p=>p.week_start),report:buildWeeklyReport(raw,week),agents:raw.members.map(m=>({id:m.user_id,name:m.display_name||m.email,report:buildWeeklyReport(raw,week,m.user_id)}))};
  });