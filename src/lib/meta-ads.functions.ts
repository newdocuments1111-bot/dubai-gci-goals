import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOwner } from "./agency-access";
import {
  isValidMetaToken,
  normaliseAdAccountId,
  syncRange,
  type InsightRow,
  type ReportDeal,
  type ReportHit,
  type ReportLead,
  type ReportViewing,
} from "./meta-ads";

type Ctx = { supabase: Parameters<typeof requireOwner>[0]; userId: string };
const owner = (context: Ctx) => requireOwner(context.supabase, context.userId);

const adminClient = async () =>
  (await import("@/integrations/supabase/client.server")).supabaseAdmin;
const server = () => import("./meta-ads.server");

/** Plain message from a MetaAdsError; anything else becomes a generic line. */
async function plain(e: unknown, fallback: string): Promise<never> {
  const { MetaAdsError } = await server();
  throw new Error(e instanceof MetaAdsError ? e.message : fallback);
}

export type MetaConnection = {
  connected: boolean;
  /** True when the database tables for Meta Ads have not been added yet. */
  setupMissing: boolean;
  adAccountId: string;
  accountName: string;
  currency: string;
  connectedAt: string | null;
  lastSyncAt: string | null;
  lastSyncOk: boolean | null;
  lastSyncMessage: string;
};

const NOT_CONNECTED: MetaConnection = {
  connected: false,
  setupMissing: false,
  adAccountId: "",
  accountName: "",
  currency: "AED",
  connectedAt: null,
  lastSyncAt: null,
  lastSyncOk: null,
  lastSyncMessage: "",
};

/** The connection as the owner may see it. Never includes the token (it is in another table). */
async function readConnection(context: Ctx, agencyId: string): Promise<MetaConnection> {
  const { data, error } = await context.supabase
    .from("meta_ads_connections")
    .select(
      "ad_account_id,account_name,currency,connected_at,last_sync_at,last_sync_ok,last_sync_message",
    )
    .eq("agency_id", agencyId)
    .maybeSingle();
  if (error) {
    // Table not created yet (SQL not run): say so instead of failing the page.
    if (error.code === "42P01" || error.code === "PGRST205")
      return { ...NOT_CONNECTED, setupMissing: true };
    throw new Error("Could not load the Meta connection.");
  }
  if (!data) return NOT_CONNECTED;
  return {
    connected: true,
    setupMissing: false,
    adAccountId: data.ad_account_id,
    accountName: data.account_name,
    currency: data.currency,
    connectedAt: data.connected_at,
    lastSyncAt: data.last_sync_at,
    lastSyncOk: data.last_sync_ok,
    lastSyncMessage: data.last_sync_message,
  };
}

export const getMetaAdsConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await owner(context);
    return readConnection(context, access.agencyId);
  });

/** Owner connects an ad account. Meta must accept the token for that account before anything is saved. */
export const connectMetaAds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      adAccountId: z.string().trim().max(40),
      token: z.string().trim().max(2000),
    }),
  )
  .handler(async ({ data, context }) => {
    const access = await owner(context);
    const adAccountId = normaliseAdAccountId(data.adAccountId);
    if (!adAccountId)
      throw new Error(
        "The ad account ID is the number after act_ in Ads Manager, e.g. act_1234567890.",
      );
    if (!isValidMetaToken(data.token))
      throw new Error("That does not look like a Meta access token. Copy the whole token again.");
    const { fetchAdAccount, saveConnection, syncAgency } = await server();
    const admin = await adminClient();
    let account: Awaited<ReturnType<typeof fetchAdAccount>>;
    try {
      account = await fetchAdAccount(adAccountId, data.token);
    } catch (e) {
      return plain(e, "Could not check the token with Meta.");
    }
    try {
      await saveConnection(admin, {
        agencyId: access.agencyId,
        userId: context.userId,
        adAccountId,
        token: data.token,
        account,
      });
    } catch (e) {
      return plain(e, "Could not save the Meta connection.");
    }
    // First sync straight away; the connection stays even if it fails (the reason is shown).
    let syncError = "";
    try {
      await syncAgency(admin, access.agencyId);
    } catch (e) {
      syncError = e instanceof Error ? e.message : "The first sync failed.";
    }
    return { success: true, accountName: account.name, currency: account.currency, syncError };
  });

export const disconnectMetaAds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await owner(context);
    const { removeConnection } = await server();
    try {
      await removeConnection(await adminClient(), access.agencyId);
    } catch (e) {
      return plain(e, "Could not disconnect Meta.");
    }
    return { success: true };
  });

export const syncMetaAdsNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await owner(context);
    const { syncAgency } = await server();
    try {
      return await syncAgency(await adminClient(), access.agencyId);
    } catch (e) {
      return plain(e, "The sync failed. Try again in a few minutes.");
    }
  });

const PAGE = 1000;
const ID_CHUNK = 150;

/** Every row of a paged PostgREST read (the server returns at most 1000 at a time). */
async function readAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error("Could not load the Meta ads numbers.");
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

const chunks = <T>(xs: T[], size: number) =>
  Array.from({ length: Math.ceil(xs.length / size) }, (_, i) => xs.slice(i * size, (i + 1) * size));

/**
 * Owner only: synced insights for the period plus the agency's leads that carry a Meta id, their
 * viewings and deals, and duplicate intakes. The browser builds the table with meta-ads.ts.
 */
export const getMetaAdsReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ days: z.union([z.literal(7), z.literal(30), z.literal(90)]) }))
  .handler(async ({ data, context }) => {
    const access = await owner(context);
    const connection = await readConnection(context, access.agencyId);
    const { since, until } = syncRange(new Date(), data.days);
    const empty = {
      connection,
      since,
      until,
      insights: [] as InsightRow[],
      leads: [] as ReportLead[],
      viewings: [] as ReportViewing[],
      deals: [] as ReportDeal[],
      hits: [] as ReportHit[],
      untagged: 0,
    };
    if (!connection.connected) return empty;
    const sb = context.supabase;
    const fromIso = new Date(`${since}T00:00:00+04:00`).toISOString();

    const [insights, leads, hits, untagged] = await Promise.all([
      readAll<InsightRow>((a, b) =>
        sb
          .from("meta_ad_insights")
          .select(
            "date,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,meta_leads",
          )
          .eq("agency_id", access.agencyId)
          .eq("ad_account_id", connection.adAccountId)
          .gte("date", since)
          .lte("date", until)
          .order("date")
          .order("ad_id")
          .range(a, b),
      ),
      readAll<Omit<ReportLead, "client_replied"> & { whatsapp_last_inbound_at: string | null }>(
        (a, b) =>
          sb
            .from("leads")
            .select(
              "id,name,score,created_at,whatsapp_last_inbound_at,meta_ad_id,meta_adset_id,meta_campaign_id",
            )
            .eq("agency_id", access.agencyId)
            .gte("created_at", fromIso)
            .or("meta_ad_id.not.is.null,meta_adset_id.not.is.null,meta_campaign_id.not.is.null")
            .order("created_at")
            .order("id")
            .range(a, b),
      ),
      readAll<ReportHit>((a, b) =>
        sb
          .from("meta_lead_hits")
          .select("created_at,duplicate,meta_ad_id,meta_adset_id,meta_campaign_id")
          .eq("agency_id", access.agencyId)
          .eq("duplicate", true)
          .gte("created_at", fromIso)
          .order("created_at")
          .order("id")
          .range(a, b),
      ),
      sb
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("agency_id", access.agencyId)
        .gte("created_at", fromIso)
        .in("source", ["Facebook", "Instagram"])
        .is("meta_ad_id", null)
        .is("meta_adset_id", null)
        .is("meta_campaign_id", null),
    ]);

    const ids = leads.map((l) => l.id);
    const viewings: ReportViewing[] = [];
    const deals: ReportDeal[] = [];
    const answered = new Set<string>();
    for (const part of chunks(ids, ID_CHUNK)) {
      const [v, d, calls] = await Promise.all([
        sb
          .from("viewings")
          .select("lead_id,status")
          .eq("agency_id", access.agencyId)
          .in("lead_id", part),
        sb
          .from("deals")
          .select("lead_id,status,price_aed,commission_percent")
          .eq("agency_id", access.agencyId)
          .in("lead_id", part),
        sb
          .from("lead_calls")
          .select("lead_id")
          .eq("agency_id", access.agencyId)
          .in("outcome", ["answered", "call_back"])
          .in("lead_id", part),
      ]);
      if (v.error || d.error || calls.error)
        throw new Error("Could not load the Meta ads numbers.");
      viewings.push(...(v.data ?? []));
      deals.push(...(d.data ?? []));
      for (const c of calls.data ?? []) answered.add(c.lead_id);
    }
    return {
      ...empty,
      insights: insights.map((r) => ({ ...r, spend: Number(r.spend) })),
      // "Replied" means the client answered: a WhatsApp message in, or an answered call.
      leads: leads.map(({ whatsapp_last_inbound_at, ...l }) => ({
        ...l,
        client_replied: whatsapp_last_inbound_at != null || answered.has(l.id),
      })),
      viewings,
      deals,
      hits,
      untagged: untagged.count ?? 0,
    };
  });
