import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Called by the database right after an agent alert is created, and every minute as a backup.
export const Route = createFileRoute("/api/public/alerts/dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { deliverAlerts } = await import("@/lib/alerts.server");
        try {
          const result = await deliverAlerts(supabaseAdmin, new URL(request.url).origin);
          return Response.json({ success: true, ...result });
        } catch (e) {
          console.error("Alert delivery failed", e);
          return Response.json({ success: false }, { status: 500 });
        }
      },
    },
  },
});
