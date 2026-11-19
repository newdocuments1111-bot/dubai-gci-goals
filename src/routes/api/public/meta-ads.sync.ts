import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Optional scheduled Meta Ads sync (see the commented cron block in the SQL). Same managed cron
// secret as alerts dispatch. Reads from Meta only; a few agencies per call, each about once a day.
export const Route = createFileRoute("/api/public/meta-ads/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { syncDueAgencies } = await import("@/lib/meta-ads.server");
        try {
          const result = await syncDueAgencies(supabaseAdmin);
          return Response.json({ success: true, ...result });
        } catch (e) {
          console.error("Meta Ads scheduled sync failed", e);
          return Response.json({ success: false }, { status: 500 });
        }
      },
    },
  },
});
