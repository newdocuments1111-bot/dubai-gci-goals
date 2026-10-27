import { createFileRoute } from '@tanstack/react-router';

const MAX_BODY_BYTES = 4 * 1024 * 1024;

export const Route = createFileRoute('/api/public/whatsapp/webhook')({
  server: {
    handlers: {
      // Meta's one-time verification: echo hub.challenge only when the verify token matches.
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get('hub.mode');
        const token = url.searchParams.get('hub.verify_token') ?? '';
        const challenge = url.searchParams.get('hub.challenge') ?? '';
        const expected = process.env['WHATSAPP_VERIFY_TOKEN'];
        if (!expected) return new Response('Verify token is not configured', { status: 500 });
        const { safeEqual } = await import('@/lib/whatsapp.server');
        if (mode !== 'subscribe' || !safeEqual(token, expected) || !/^[\w-]{1,200}$/.test(challenge)) return new Response('Forbidden', { status: 403 });
        return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
      },
      // Every delivery must carry Meta's X-Hub-Signature-256 made with the app secret.
      POST: async ({ request }) => {
        const secret = process.env['WHATSAPP_APP_SECRET'];
        if (!secret) return new Response('App secret is not configured', { status: 500 });
        if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return new Response('Too large', { status: 413 });
        const raw = Buffer.from(await request.arrayBuffer());
        if (raw.byteLength > MAX_BODY_BYTES) return new Response('Too large', { status: 413 });
        const { verifyMetaSignature, storeWebhook, processEvents } = await import('@/lib/whatsapp.server');
        if (!verifyMetaSignature(raw, request.headers.get('x-hub-signature-256'), secret)) return new Response('Invalid signature', { status: 401 });
        let body: unknown;
        try { body = JSON.parse(raw.toString('utf8')); } catch { return new Response('Invalid JSON', { status: 400 }); }
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        let ids: string[];
        try { ids = await storeWebhook(supabaseAdmin, body); } catch (e) {
          console.error('WhatsApp webhook could not be stored', e);
          return new Response('Could not store', { status: 500 });
        }
        try {
          // Process this delivery, plus one overdue row from earlier failures (recovery on each new delivery).
          const ok = await processEvents(supabaseAdmin, ids, 1);
          return ok ? new Response('ok') : new Response('Stored; processing will retry', { status: 500 });
        } catch (e) {
          console.error('WhatsApp webhook processing failed', e);
          return new Response('Stored; processing will retry', { status: 500 });
        }
      },
    },
  },
});
