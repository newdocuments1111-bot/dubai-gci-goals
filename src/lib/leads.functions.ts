import { createServerFn } from "@tanstack/react-start";
import type { Lead } from "./leads";

export const getLeads = createServerFn({ method: "POST" }).handler(async (): Promise<{ leads: Lead[]; error: string | null }> => {
  const { loadLeads } = await import("./leads.server");
  try {
    return { leads: await loadLeads(), error: null };
  } catch (e) {
    return { leads: [], error: e instanceof Error ? e.message : "Could not load leads." };
  }
});
