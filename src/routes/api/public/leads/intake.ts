import { createFileRoute } from "@tanstack/react-router";

const MAX_BODY_BYTES = 32 * 1024;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/**
 * Public lead intake for portals, Zapier, Make, Meta lead forms and websites.
 * The agency's secret key (Settings → Lead routing) comes in the `x-intake-key` header or `?key=`.
 * Accepts JSON or a form post. The database matches the key, merges repeat phone numbers and routes the lead.
 */
export const Route = createFileRoute("/api/public/leads/intake")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const key = (
          request.headers.get("x-intake-key") ??
          url.searchParams.get("key") ??
          ""
        ).trim();
        if (!/^[a-f0-9]{48}$/.test(key)) return json({ error: "Missing or invalid key." }, 401);
        if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES)
          return json({ error: "Too large." }, 413);
        const raw = await request.text();
        if (raw.length > MAX_BODY_BYTES) return json({ error: "Too large." }, 413);
        let body: unknown;
        const type = request.headers.get("content-type") ?? "";
        try {
          body = type.includes("application/x-www-form-urlencoded")
            ? Object.fromEntries(new URLSearchParams(raw))
            : JSON.parse(raw);
        } catch {
          return json({ error: "Send JSON or a form post." }, 400);
        }
        const { parseIntake } = await import("@/lib/inbox");
        const parsed = parseIntake(body);
        if ("error" in parsed) return json({ error: parsed.error }, 422);
        const { timezoneFromPhone } = await import("@/lib/leads-app");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("intake_lead", {
          _token: key,
          _lead: { ...parsed.lead, timezone: timezoneFromPhone(parsed.lead.phone) },
        });
        if (error) {
          console.error("Lead intake failed", error.message);
          return json({ error: "Could not save the lead." }, 500);
        }
        const result = data as { id?: string; duplicate?: boolean; error?: string } | null;
        if (!result || result.error) return json({ error: "Missing or invalid key." }, 401);
        return json(
          { id: result.id, duplicate: result.duplicate === true },
          result.duplicate ? 200 : 201,
        );
      },
    },
  },
});
