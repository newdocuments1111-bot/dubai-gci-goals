import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOwner } from "./agency-access";
import { prepareSellerCampaignSchema, resolveSellerAudience } from "./seller-campaign";

/**
 * Seller Finder → campaign, step 1 (owner only, read only): which picked owners and past buyers can be
 * reached through a consenting lead of this agency. Returns lead ids and counts only. Nothing is sent or
 * written; the campaign page checks every lead again on preview and on Start.
 */
export const prepareSellerCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(prepareSellerCampaignSchema)
  .handler(async ({ data, context }) => {
    const access = await requireOwner(context.supabase, context.userId);
    const a = access.agencyId;
    const ownerIds = [...new Set(data.picks.filter((p) => p.kind === "owner").map((p) => p.id))];
    const ownerPages = await Promise.all(
      Array.from({ length: Math.ceil(ownerIds.length / 100) }, (_, i) =>
        context.supabase
          .from("owners")
          .select("id,phone")
          .eq("agency_id", a)
          .in("id", ownerIds.slice(i * 100, i * 100 + 100)),
      ),
    );
    // Every lead of the agency (phones are needed to match owners and to find STOP / do-not-call on the same phone).
    const leadRows: {
      id: string;
      phone: string;
      opted_in: boolean;
      stopped: boolean;
      do_not_call: boolean;
    }[] = [];
    for (let from = 0; from < 50_000; from += 1000) {
      const { data: page, error } = await context.supabase
        .from("leads")
        .select("id,phone,opted_in,stopped,do_not_call")
        .eq("agency_id", a)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, from + 999);
      if (error) throw new Error("Could not read your leads.");
      leadRows.push(...(page ?? []));
      if (!page || page.length < 1000) break;
    }
    if (ownerPages.some((p) => p.error)) throw new Error("Could not read your owners.");
    const audience = resolveSellerAudience({
      picks: data.picks,
      owners: ownerPages.flatMap((p) => p.data ?? []),
      leads: leadRows,
    });
    return {
      label: data.label,
      picked: audience.rows.length,
      leadIds: audience.leadIds,
      skipped: audience.skipped,
    };
  });
