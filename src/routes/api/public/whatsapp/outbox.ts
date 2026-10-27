import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';

// Called every 5 minutes by the managed schedule: sends approved / scheduled queue items when every rule allows it.
export const Route = createFileRoute('/api/public/whatsapp/outbox')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const { processOutbox } = await import('@/lib/whatsapp-outbox.server');
        try {
          const result = await processOutbox(supabaseAdmin, null, 25);
          return Response.json({ success: true, ...result });
        } catch (e) {
          console.error('WhatsApp queue run failed', e);
          return Response.json({ success: false }, { status: 500 });
        }
      },
    },
  },
});
