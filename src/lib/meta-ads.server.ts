/**
 * Meta Ads: the only code that uses an agency's Meta token. Server-only.
 * Reads from Meta's Graph API (GET only) — it never changes, pauses or creates ads.
 * The token lives in public.meta_ads_tokens, which no browser role can read; it is used only in
 * the Authorization header here and is never returned, logged or put in a URL.
 */
import type { supabaseAdmin } from "@/integrations/supabase/client.server";
import { GRAPH_API_VERSION } from "./whatsapp.server";
import {
  META_SYNC_DAYS,
  META_SYNC_GAP_MINUTES,
  graphErrorMessage,
  parseInsightRow,
  syncRange,
  type GraphError,
  type InsightRow,
  type MetaAdIds,
} from "./meta-ads";

type Admin = typeof supabaseAdmin;
type Obj = Record<string, unknown>;

const GRAPH_ORIGIN = "https://graph.facebook.com";
const INSIGHT_FIELDS = [
  "campaign_id",
  "campaign_name",
  "adset_id",
  "adset_name",
  "ad_id",
  "ad_name",
  "spend",
  "impressions",
  "clicks",
  "actions",
].join(",");
const PAGE_LIMIT = 500;
const MAX_PAGES = 100;
const UPSERT_BATCH = 500;
/** The scheduled sync picks agencies whose last sync started longer ago than this. */
export const SCHEDULED_SYNC_GAP_MINUTES = 20 * 60;

/** A failure with a message that is safe and useful to show the owner. */
export class MetaAdsError extends Error {}

const obj = (v: unknown): Obj =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {};

async function graphGet(url: string, token: string): Promise<Obj> {
  // Paging links come from Meta; never send the token anywhere else.
  if (!url.startsWith(`${GRAPH_ORIGIN}/`)) throw new MetaAdsError("Meta sent an unexpected link.");
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new MetaAdsError("Could not reach Meta. Try again in a few minutes.");
  }
  const text = await res.text();
  let body: Obj = {};
  try {
    body = obj(text ? JSON.parse(text) : {});
  } catch {
    /* not JSON: handled below */
  }
  const err = obj(body["error"]);
  if (!res.ok || Object.keys(err).length > 0) {
    const g: GraphError = { status: res.ok ? 400 : res.status };
    const code = Number(err["code"]);
    const subcode = Number(err["error_subcode"]);
    if (Number.isFinite(code) && code > 0) g.code = code;
    if (Number.isFinite(subcode) && subcode > 0) g.subcode = subcode;
    if (typeof err["message"] === "string") g.message = err["message"];
    console.error(
      `Meta Ads Graph request failed [${res.status}] code=${g.code ?? "-"} subcode=${g.subcode ?? "-"}: ${(g.message ?? "").slice(0, 300)}`,
    );
    throw new MetaAdsError(graphErrorMessage(g));
  }
  return body;
}

const graphUrl = (path: string, params: Record<string, string>) =>
  `${GRAPH_ORIGIN}/${GRAPH_API_VERSION}/${path}?${new URLSearchParams(params).toString()}`;

/** GET /{act}?fields=name,currency,account_status — also proves the token can read the account. */
export async function fetchAdAccount(adAccountId: string, token: string) {
  const body = await graphGet(
    graphUrl(adAccountId, { fields: "name,currency,account_status" }),
    token,
  );
  const currency = typeof body["currency"] === "string" ? body["currency"].toUpperCase() : "";
  return {
    name: typeof body["name"] === "string" ? body["name"].slice(0, 300) : "",
    currency: /^[A-Z]{3}$/.test(currency) ? currency : "AED",
    status: Number(body["account_status"]) || 0,
  };
}

/** GET /{act}/insights at ad level, one row per ad per day, following Meta's paging links. */
export async function fetchInsights(
  adAccountId: string,
  token: string,
  range: { since: string; until: string },
): Promise<InsightRow[]> {
  const rows: InsightRow[] = [];
  let next: string | null = graphUrl(`${adAccountId}/insights`, {
    level: "ad",
    fields: INSIGHT_FIELDS,
    time_range: JSON.stringify(range),
    time_increment: "1",
    limit: String(PAGE_LIMIT),
  });
  for (let page = 0; next && page < MAX_PAGES; page += 1) {
    const body = await graphGet(next, token);
    const data = Array.isArray(body["data"]) ? body["data"] : [];
    for (const raw of data) {
      const row = parseInsightRow(raw);
      if (row) rows.push(row);
    }
    const link = obj(body["paging"])["next"];
    next = data.length > 0 && typeof link === "string" ? link : null;
  }
  if (next) throw new MetaAdsError("This ad account has too many ads to read at once.");
  return rows;
}

async function readToken(admin: Admin, agencyId: string) {
  const { data, error } = await admin
    .from("meta_ads_tokens")
    .select("access_token")
    .eq("agency_id", agencyId)
    .maybeSingle();
  if (error) throw new MetaAdsError("Could not read the Meta connection.");
  if (!data) throw new MetaAdsError("Connect a Meta ad account first (Settings).");
  return data.access_token;
}

/** Save (or replace) the agency's connection and token after Meta accepted them. */
export async function saveConnection(
  admin: Admin,
  input: {
    agencyId: string;
    userId: string;
    adAccountId: string;
    token: string;
    account: { name: string; currency: string };
  },
) {
  const { error: tokenError } = await admin.from("meta_ads_tokens").upsert(
    {
      agency_id: input.agencyId,
      access_token: input.token,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "agency_id" },
  );
  if (tokenError) throw new MetaAdsError("Could not save the Meta connection.");
  const { error } = await admin.from("meta_ads_connections").upsert(
    {
      agency_id: input.agencyId,
      ad_account_id: input.adAccountId,
      account_name: input.account.name,
      currency: input.account.currency,
      connected_by: input.userId,
      connected_at: new Date().toISOString(),
      sync_started_at: null,
      last_sync_at: null,
      last_sync_ok: null,
      last_sync_message: "",
      last_sync_rows: 0,
    },
    { onConflict: "agency_id" },
  );
  if (error) {
    await admin.from("meta_ads_tokens").delete().eq("agency_id", input.agencyId);
    throw new MetaAdsError("Could not save the Meta connection.");
  }
}

/** Forget the token and the connection. Synced numbers stay, hidden until the same account is connected again. */
export async function removeConnection(admin: Admin, agencyId: string) {
  const { error } = await admin.from("meta_ads_tokens").delete().eq("agency_id", agencyId);
  if (error) throw new MetaAdsError("Could not disconnect Meta.");
  const { error: connError } = await admin
    .from("meta_ads_connections")
    .delete()
    .eq("agency_id", agencyId);
  if (connError) throw new MetaAdsError("Could not disconnect Meta.");
}

/**
 * Read the last `days` days from Meta and upsert them. Only one sync per agency runs at a time:
 * the start is claimed atomically, and refused if another started less than `gapMinutes` ago.
 */
export async function syncAgency(
  admin: Admin,
  agencyId: string,
  opts: { days?: number; gapMinutes?: number; now?: Date } = {},
) {
  const now = opts.now ?? new Date();
  const gap = opts.gapMinutes ?? META_SYNC_GAP_MINUTES;
  const cutoff = new Date(now.getTime() - gap * 60_000).toISOString();
  const { data: claimed, error: claimError } = await admin
    .from("meta_ads_connections")
    .update({ sync_started_at: now.toISOString() })
    .eq("agency_id", agencyId)
    .or(`sync_started_at.is.null,sync_started_at.lt."${cutoff}"`)
    .select("ad_account_id")
    .maybeSingle();
  if (claimError) throw new MetaAdsError("Could not start the sync.");
  if (!claimed) {
    const { data: exists } = await admin
      .from("meta_ads_connections")
      .select("agency_id")
      .eq("agency_id", agencyId)
      .maybeSingle();
    throw new MetaAdsError(
      exists
        ? `A sync started less than ${gap >= 60 ? `${Math.round(gap / 60)} hours` : `${gap} minutes`} ago. Try again later.`
        : "Connect a Meta ad account first (Settings).",
    );
  }
  const adAccountId = claimed.ad_account_id;
  try {
    const token = await readToken(admin, agencyId);
    const account = await fetchAdAccount(adAccountId, token);
    const range = syncRange(now, opts.days ?? META_SYNC_DAYS);
    const rows = await fetchInsights(adAccountId, token, range);
    const syncedAt = new Date().toISOString();
    for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
      const { error } = await admin.from("meta_ad_insights").upsert(
        rows.slice(i, i + UPSERT_BATCH).map((r) => ({
          ...r,
          agency_id: agencyId,
          ad_account_id: adAccountId,
          currency: account.currency,
          synced_at: syncedAt,
        })),
        { onConflict: "agency_id,ad_id,date" },
      );
      if (error) {
        console.error("Meta Ads insights save failed", error.message);
        throw new MetaAdsError("Meta answered, but the numbers could not be saved.");
      }
    }
    const message = `${rows.length} daily ad rows, ${range.since} to ${range.until}.`;
    await admin
      .from("meta_ads_connections")
      .update({
        account_name: account.name,
        currency: account.currency,
        last_sync_at: syncedAt,
        last_sync_ok: true,
        last_sync_message: message,
        last_sync_rows: rows.length,
      })
      .eq("agency_id", agencyId);
    return { rows: rows.length, ...range, currency: account.currency };
  } catch (e) {
    const message =
      e instanceof MetaAdsError ? e.message : "The sync failed. Try again in a few minutes.";
    if (!(e instanceof MetaAdsError)) console.error("Meta Ads sync failed", e);
    await admin
      .from("meta_ads_connections")
      .update({ last_sync_ok: false, last_sync_message: message.slice(0, 500) })
      .eq("agency_id", agencyId);
    throw new MetaAdsError(message);
  }
}

/** The scheduled sync: a few agencies per call, oldest first, each at most about once a day. */
export async function syncDueAgencies(admin: Admin, limit = 5, now = new Date()) {
  const cutoff = new Date(now.getTime() - SCHEDULED_SYNC_GAP_MINUTES * 60_000).toISOString();
  const { data, error } = await admin
    .from("meta_ads_connections")
    .select("agency_id")
    .or(`sync_started_at.is.null,sync_started_at.lt."${cutoff}"`)
    .order("sync_started_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) throw new Error("Could not list Meta connections.");
  let ok = 0;
  let failed = 0;
  for (const row of data ?? []) {
    try {
      await syncAgency(admin, row.agency_id, { gapMinutes: SCHEDULED_SYNC_GAP_MINUTES, now });
      ok += 1;
    } catch {
      failed += 1; // already recorded on the connection row
    }
  }
  return { ok, failed };
}

/**
 * Lead intake: remember which Meta ad sent the lead. A new lead gets the ids; a repeat of an
 * existing open lead keeps its first ad. Every intake with ids is also logged (duplicates counted).
 * Never throws: a failure here must not lose the lead.
 */
export async function recordMetaLeadAd(
  admin: Admin,
  leadId: string,
  ids: MetaAdIds,
  duplicate: boolean,
) {
  try {
    const { data: lead, error } = await admin
      .from("leads")
      .select("agency_id,meta_ad_id,meta_adset_id,meta_campaign_id")
      .eq("id", leadId)
      .maybeSingle();
    if (error || !lead) {
      if (error) console.error("Meta lead ids not saved", error.message);
      return;
    }
    if (!lead.meta_ad_id && !lead.meta_adset_id && !lead.meta_campaign_id) {
      const { error: updateError } = await admin
        .from("leads")
        .update({
          meta_ad_id: ids.ad_id,
          meta_adset_id: ids.adset_id,
          meta_campaign_id: ids.campaign_id,
        })
        .eq("id", leadId);
      if (updateError) console.error("Meta lead ids not saved", updateError.message);
    }
    const { error: hitError } = await admin.from("meta_lead_hits").insert({
      agency_id: lead.agency_id,
      lead_id: leadId,
      meta_ad_id: ids.ad_id,
      meta_adset_id: ids.adset_id,
      meta_campaign_id: ids.campaign_id,
      duplicate,
    });
    if (hitError) console.error("Meta lead hit not saved", hitError.message);
  } catch (e) {
    console.error("Meta lead ids not saved", e);
  }
}
