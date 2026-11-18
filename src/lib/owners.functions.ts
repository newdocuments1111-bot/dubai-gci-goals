import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAccess } from "./agency-access";
import { z } from "zod";
import { findSellers } from "./seller-finder";

const guard = (context: { supabase: Parameters<typeof getAccess>[0]; userId: string }) =>
  getAccess(context.supabase, context.userId);

export const ownerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  phone: z.string().trim().max(50),
  agreed_to_updates: z.boolean(),
  handover_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  kind: z.enum(["owner", "investor"]),
  update_frequency: z.enum(["quarterly", "monthly"]),
  area: z.string().trim().max(200),
  building: z.string().trim().max(200),
  lease_end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  stage: z
    .enum(["prospect", "valuation", "form_a", "listed", "under_offer", "closed", "lost"])
    .default("prospect"),
  intent: z.enum(["sell", "rent", "unknown"]).default("unknown"),
  asking_price_aed: z.number().min(0).max(100_000_000_000).nullable().default(null),
  next_action_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
  notes: z.string().trim().max(2000).default(""),
  tenant_name: z.string().trim().max(200).default(""),
  annual_rent_aed: z.number().min(0).max(100_000_000_000).nullable().default(null),
});
export type OwnerInput = z.infer<typeof ownerSchema>;
export const emptyOwner = (): OwnerInput => ({
  name: "",
  phone: "",
  agreed_to_updates: false,
  handover_date: null,
  kind: "owner",
  update_frequency: "quarterly",
  area: "",
  building: "",
  lease_end: null,
  stage: "prospect",
  intent: "unknown",
  asking_price_aed: null,
  next_action_on: null,
  notes: "",
  tenant_name: "",
  annual_rent_aed: null,
});

export const listOwners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await guard(context);
    const { data, error } = await context.supabase
      .from("owners")
      .select("*")
      .eq("agency_id", access.agencyId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load owners.");
    return data;
  });

export const saveOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(ownerSchema.extend({ id: z.string().uuid().optional() }))
  .handler(async ({ data, context }) => {
    await guard(context);
    const { id, ...fields } = data;
    const { error } = id
      ? await context.supabase.from("owners").update(fields).eq("id", id)
      : await context.supabase.from("owners").insert(fields);
    if (error) throw new Error("Could not save the owner.");
    return { success: true };
  });

export const deleteOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid())
  .handler(async ({ data, context }) => {
    await guard(context);
    const { error } = await context.supabase.from("owners").delete().eq("id", data);
    if (error) throw new Error("Could not delete the owner.");
    return { success: true };
  });

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const FINDER_LEAD = "id,name,phone,do_not_call,stopped,opted_in";

/** Seller and landlord board: owners, their listings, rent cheques and what the owner update needs. */
export const getSellerBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await guard(context);
    const a = access.agencyId;
    const [
      { data: owners, error },
      { data: listings },
      { data: cheques },
      { data: viewings },
      { data: leads },
      soldDeals,
      blocked,
    ] = await Promise.all([
      context.supabase
        .from("owners")
        .select("*")
        .eq("agency_id", a)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("listings")
        .select(
          "id,title,community,project,price_aed,bedrooms,status,owner_id,created_at,handover_date",
        )
        .eq("agency_id", a),
      context.supabase
        .from("rent_cheques")
        .select("id,owner_id,amount_aed,due_date,status,cheque_no,note")
        .eq("agency_id", a)
        .order("due_date"),
      context.supabase
        .from("viewings")
        .select("listing_id,status")
        .eq("agency_id", a)
        .not("listing_id", "is", null),
      context.supabase
        .from("leads")
        .select("id,area,budget,type,outcome,portal_ref")
        .eq("agency_id", a)
        .eq("outcome", "open")
        .limit(5000),
      // Seller Finder (read only): closed sales and the people who asked not to be contacted, under the caller's own access rules.
      context.supabase
        .from("deals")
        .select("id,lead_id,listing_id,deal_type,track,status,closed_at")
        .eq("agency_id", a)
        .eq("status", "closed")
        .eq("deal_type", "sale")
        .not("lead_id", "is", null)
        .not("closed_at", "is", null)
        .order("closed_at")
        .limit(5000),
      context.supabase
        .from("leads")
        .select(FINDER_LEAD)
        .eq("agency_id", a)
        .or("stopped.eq.true,do_not_call.eq.true")
        .limit(5000),
    ]);
    if (error) throw new Error("Could not load owners.");
    const deals = soldDeals.data ?? [];
    const buyerIds = [
      ...new Set(deals.map((d) => d.lead_id).filter((x): x is string => x !== null)),
    ];
    const buyerPages = await Promise.all(
      Array.from({ length: Math.ceil(buyerIds.length / 100) }, (_, i) =>
        context.supabase
          .from("leads")
          .select(FINDER_LEAD)
          .eq("agency_id", a)
          .in("id", buyerIds.slice(i * 100, i * 100 + 100)),
      ),
    );
    const finderLeads = new Map(
      [...(blocked.data ?? []), ...buyerPages.flatMap((p) => p.data ?? [])].map((l) => [l.id, l]),
    );
    const likelyComplete = !soldDeals.error && !blocked.error && buyerPages.every((p) => !p.error);
    const likely = findSellers({
      owners: owners ?? [],
      listings: listings ?? [],
      deals,
      leads: [...finderLeads.values()],
    });
    const { matchBuyers } = await import("./inbox");
    const stats = (listings ?? []).map((l) => {
      const vs = (viewings ?? []).filter((v) => v.listing_id === l.id);
      const row = {
        id: l.id,
        title: l.title,
        community: l.community,
        project: l.project,
        price_aed: Number(l.price_aed),
        bedrooms: l.bedrooms,
        status: l.status,
      };
      return {
        id: l.id,
        owner_id: l.owner_id,
        title: l.title,
        status: l.status,
        price_aed: Number(l.price_aed),
        listedAt: l.created_at,
        viewingsBooked: vs.filter((v) => v.status === "booked").length,
        viewingsDone: vs.filter((v) => v.status === "done").length,
        matchingBuyers: matchBuyers(row, leads ?? [], 500).length,
        enquiries:
          (leads ?? []).filter((x) => x.portal_ref && x.portal_ref === l.id).length + vs.length,
      };
    });
    return {
      agentName: access.displayName || access.agencyName,
      owners: (owners ?? []).map((o) => ({
        ...o,
        asking_price_aed: o.asking_price_aed === null ? null : Number(o.asking_price_aed),
        annual_rent_aed: o.annual_rent_aed === null ? null : Number(o.annual_rent_aed),
      })),
      listings: stats,
      cheques: (cheques ?? []).map((c) => ({ ...c, amount_aed: Number(c.amount_aed) })),
      /** Owners and past buyers who may be ready to sell or list; `likelyComplete` is false when part of the data could not be read. */
      likely,
      likelyComplete,
    };
  });

export const setOwnerStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      stage: z.enum(["prospect", "valuation", "form_a", "listed", "under_offer", "closed", "lost"]),
    }),
  )
  .handler(async ({ data, context }) => {
    await guard(context);
    const { error } = await context.supabase
      .from("owners")
      .update({ stage: data.stage })
      .eq("id", data.id);
    if (error) throw new Error("Could not move the owner.");
    return { success: true };
  });

export const linkListingOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ listingId: z.string().uuid(), ownerId: z.string().uuid().nullable() }))
  .handler(async ({ data, context }) => {
    const access = await guard(context);
    const { error } = await context.supabase
      .from("listings")
      .update({ owner_id: data.ownerId })
      .eq("id", data.listingId)
      .eq("agency_id", access.agencyId);
    if (error) throw new Error("Could not link the listing.");
    return { success: true };
  });

export const addCheque = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      ownerId: z.string().uuid(),
      amount_aed: z.number().positive().max(100_000_000_000),
      first_due: day,
      count: z.number().int().min(1).max(12),
      every_months: z.number().int().min(1).max(12),
      cheque_no: z.string().trim().max(60),
    }),
  )
  .handler(async ({ data, context }) => {
    const access = await guard(context);
    const [y, m, d] = data.first_due.split("-").map(Number) as [number, number, number];
    const rows = Array.from({ length: data.count }, (_, i) => {
      const due = new Date(Date.UTC(y, m - 1 + i * data.every_months, d));
      const n =
        data.cheque_no && /^\d+$/.test(data.cheque_no)
          ? String(Number(data.cheque_no) + i).padStart(data.cheque_no.length, "0")
          : data.cheque_no;
      return {
        agency_id: access.agencyId,
        owner_id: data.ownerId,
        amount_aed: data.amount_aed,
        due_date: due.toISOString().slice(0, 10),
        cheque_no: n,
      };
    });
    const { error } = await context.supabase.from("rent_cheques").insert(rows);
    if (error) throw new Error("Could not add the cheques.");
    return { success: true };
  });

export const setChequeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      status: z.enum(["pending", "deposited", "cleared", "bounced"]),
    }),
  )
  .handler(async ({ data, context }) => {
    await guard(context);
    const { error } = await context.supabase
      .from("rent_cheques")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error("Could not update the cheque.");
    return { success: true };
  });

export const deleteCheque = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid())
  .handler(async ({ data, context }) => {
    await guard(context);
    const { error } = await context.supabase.from("rent_cheques").delete().eq("id", data);
    if (error) throw new Error("Could not remove the cheque.");
    return { success: true };
  });
