import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Lead } from "./leads";
import { isOwnerEmail } from "./owner";

export const getLeads = createServerFn({ method: "POST" }).handler(async (): Promise<{ leads: Lead[]; error: string | null }> => {
  // Server-side check: only the signed-in owner gets HubSpot data. Anyone else gets nothing.
  const token = getRequest()?.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!token || !url || !key) return { leads: [], error: null };
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data } = await sb.auth.getUser(token);
  if (!isOwnerEmail(data.user?.email)) return { leads: [], error: null };

  const { loadLeads } = await import("./leads.server");
  try {
    return { leads: await loadLeads(), error: null };
  } catch (e) {
    return { leads: [], error: e instanceof Error ? e.message : "Could not load leads." };
  }
});
