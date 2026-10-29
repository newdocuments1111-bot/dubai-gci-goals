import type { supabase as browserClient } from "@/integrations/supabase/client";
import { defaultSettings } from "./settings";
import { calculateFreeSlots, type SlotSettings } from "./viewing-slots";

/** The agency's working schedule and every booked time (including other agents' clients, times only). */
export async function loadSchedule(supabase: typeof browserClient, agencyId: string, privileged = false) {
  const [{ data: s, error: settingsError }, booked] = await Promise.all([
    supabase.from("app_settings").select("*").eq("agency_id", agencyId).maybeSingle(),
    privileged
      ? supabase
          .from("viewings")
          .select("starts_at")
          .eq("agency_id", agencyId)
          .eq("status", "booked")
          .then((r) => ({ data: (r.data ?? []).map((v) => v.starts_at), error: r.error }))
      : supabase.rpc("agency_booked_times"),
  ]);
  if (settingsError || booked.error) throw new Error("Could not check appointment times.");
  const settings: SlotSettings = {
    working_days: s?.working_days ?? defaultSettings.working_days,
    holidays: s?.holidays ?? defaultSettings.holidays,
    work_start: String(s?.work_start ?? defaultSettings.work_start).slice(0, 5),
    work_end: String(s?.work_end ?? defaultSettings.work_end).slice(0, 5),
    viewing_minutes: s?.viewing_minutes ?? defaultSettings.viewing_minutes,
  };
  return { settings, booked: (booked.data ?? []) as string[] };
}

/** `privileged` = the server's own database access (no signed-in person), so booked times are read directly by agency. */
export async function availableViewingSlots(supabase: typeof browserClient, agencyId: string, privileged = false) {
  const { settings, booked } = await loadSchedule(supabase, agencyId, privileged);
  return calculateFreeSlots(settings, booked);
}
