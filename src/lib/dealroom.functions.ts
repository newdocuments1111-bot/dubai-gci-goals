import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAccess, requireOwner } from "./agency-access";
import { DEFAULT_SPLIT_PERCENT } from "./agency";
import { leadFolder } from "./documents";
import { EMPTY_COMPLIANCE } from "./aml";
import {
  DEFAULT_FEES,
  buyerCosts,
  dealKind,
  dealMoney,
  dueForNext,
  initialSteps,
  type Fees,
  type StepRow,
} from "./dealroom";

type Ctx = { supabase: Parameters<typeof getAccess>[0]; userId: string };
const guard = (context: Ctx) => getAccess(context.supabase, context.userId);
const STEP_COLS = "id,key,label,who,position,due_at,done_at,skipped,note";

async function loadDeal(context: Ctx, dealId: string) {
  const { data: deal, error } = await context.supabase
    .from("deals")
    .select("*, leads(id,name,phone,agency_id), listings(title,community,permit_number)")
    .eq("id", dealId)
    .maybeSingle();
  if (error || !deal) throw new Error("Deal not found.");
  return deal;
}

function feesFrom(s: Partial<Fees> | null | undefined): Fees {
  const n = (v: unknown, d: number) => (v == null || Number.isNaN(Number(v)) ? d : Number(v));
  return {
    vat_percent: n(s?.vat_percent, DEFAULT_FEES.vat_percent),
    dld_fee_percent: n(s?.dld_fee_percent, DEFAULT_FEES.dld_fee_percent),
    dld_admin_aed: n(s?.dld_admin_aed, DEFAULT_FEES.dld_admin_aed),
    trustee_fee_low_aed: n(s?.trustee_fee_low_aed, DEFAULT_FEES.trustee_fee_low_aed),
    trustee_fee_high_aed: n(s?.trustee_fee_high_aed, DEFAULT_FEES.trustee_fee_high_aed),
    mortgage_reg_percent: n(s?.mortgage_reg_percent, DEFAULT_FEES.mortgage_reg_percent),
  };
}

/** Everything on one deal's page: steps (created on first open), money, documents, payments and invoices. */
export const getDealRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid())
  .handler(async ({ data: dealId, context }) => {
    const access = await guard(context);
    const deal = await loadDeal(context, dealId);
    const kind = dealKind(deal);
    const { data: canEdit } = await context.supabase.rpc("can_edit_deal", { _deal: dealId });

    let { data: steps } = await context.supabase
      .from("deal_steps")
      .select(STEP_COLS)
      .eq("deal_id", dealId)
      .order("position");
    if ((!steps || steps.length === 0) && canEdit) {
      const rows = initialSteps(kind, new Date().toISOString()).map((s) => ({
        ...s,
        deal_id: dealId,
        agency_id: deal.agency_id,
      }));
      await context.supabase
        .from("deal_steps")
        .upsert(rows, { onConflict: "deal_id,key", ignoreDuplicates: true });
      ({ data: steps } = await context.supabase
        .from("deal_steps")
        .select(STEP_COLS)
        .eq("deal_id", dealId)
        .order("position"));
    }

    const lead = deal.leads as {
      id: string;
      name: string;
      phone: string;
      agency_id: string;
    } | null;
    const [
      { data: payments },
      { data: invoices },
      { data: settings },
      { data: member },
      { data: compliance },
    ] = await Promise.all([
      context.supabase
        .from("deal_payments")
        .select("*")
        .eq("deal_id", dealId)
        .order("paid_on", { ascending: false }),
      context.supabase
        .from("deal_invoices")
        .select("id,number,issued_at")
        .eq("deal_id", dealId)
        .order("issued_at", { ascending: false }),
      context.supabase
        .from("app_settings")
        .select("*")
        .eq("agency_id", deal.agency_id)
        .maybeSingle(),
      context.supabase
        .from("agency_members")
        .select("display_name,email,split_percent")
        .eq("agency_id", deal.agency_id)
        .eq("user_id", deal.agent_id)
        .maybeSingle(),
      context.supabase.from("deal_compliance").select("*").eq("deal_id", dealId).maybeSingle(),
    ]);

    let vaultFiles: string[] = [];
    if (lead) {
      const { data: allowed } = await context.supabase.rpc("can_access_lead_documents", {
        _lead: lead.id,
      });
      if (allowed === true) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: files } = await supabaseAdmin.storage
          .from("documents")
          .list(leadFolder(lead.agency_id, lead.id), { limit: 200 });
        vaultFiles = (files ?? [])
          .map((f) => f.name)
          .filter((n) => n !== ".emptyFolderPlaceholder");
      }
    }

    const fees = feesFrom(settings as Partial<Fees> | null);
    const price = Number(deal.price_aed);
    const totalPercent =
      deal.total_commission_percent == null
        ? Number(deal.commission_percent)
        : Number(deal.total_commission_percent);
    const split = member ? Number(member.split_percent) : DEFAULT_SPLIT_PERCENT;
    const money = dealMoney({
      price,
      totalCommissionPercent: totalPercent,
      coBrokerPercent: Number(deal.co_broker_percent),
      splitPercent: split,
      vatPercent: Number(deal.vat_percent),
    });
    return {
      isOwner: access.isOwner,
      canEdit: canEdit === true,
      kind,
      deal: {
        id: deal.id,
        deal_type: deal.deal_type,
        track: deal.track,
        status: deal.status,
        price_aed: price,
        total_commission_percent: totalPercent,
        co_broker_name: deal.co_broker_name,
        co_broker_percent: Number(deal.co_broker_percent),
        vat_percent: Number(deal.vat_percent),
        loan_aed: deal.loan_aed == null ? null : Number(deal.loan_aed),
        seller_name: deal.seller_name,
        created_at: deal.created_at,
        closed_at: deal.closed_at,
        lead_id: deal.lead_id,
      },
      lead: lead ? { id: lead.id, name: lead.name, phone: lead.phone } : null,
      listing: deal.listings as { title: string; community: string; permit_number: string } | null,
      agent: {
        name: member ? member.display_name || member.email : "Former agent",
        splitPercent: split,
      },
      steps: (steps ?? []) as (StepRow & { id: string; note: string })[],
      payments: (payments ?? []).map((p) => ({ ...p, amount_aed: Number(p.amount_aed) })),
      invoices: invoices ?? [],
      money,
      costs:
        deal.deal_type === "sale" && deal.track !== "offplan"
          ? buyerCosts(price, deal.loan_aed == null ? null : Number(deal.loan_aed), fees)
          : null,
      agency: {
        name: (settings?.agency_name as string | undefined) || access.agencyName,
        rera_brn: (settings?.rera_brn as string | undefined) ?? "",
        trn: (settings?.company_trn as string | undefined) ?? "",
      },
      vaultFiles,
      compliance: compliance
        ? { ...compliance, cash_aed: Number(compliance.cash_aed) }
        : { ...EMPTY_COMPLIANCE, updated_at: null as string | null },
    };
  });

export const updateStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      dealId: z.string().uuid(),
      key: z.string().max(40),
      action: z.enum(["done", "undo", "skip", "due", "note"]),
      due: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      note: z.string().trim().max(500).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await guard(context);
    const deal = await loadDeal(context, data.dealId);
    const now = new Date().toISOString();
    const patch =
      data.action === "done"
        ? { done_at: now, done_by: context.userId, skipped: false }
        : data.action === "undo"
          ? { done_at: null, done_by: null, skipped: false }
          : data.action === "skip"
            ? { skipped: true, done_at: null }
            : data.action === "due"
              ? { due_at: data.due ? new Date(`${data.due}T18:00:00+04:00`).toISOString() : null }
              : { note: data.note ?? "" };
    const { error } = await context.supabase
      .from("deal_steps")
      .update(patch)
      .eq("deal_id", data.dealId)
      .eq("key", data.key);
    if (error) throw new Error("Only the deal's agent or the owner can change its steps.");
    if (data.action === "done" || data.action === "skip") {
      const { data: steps } = await context.supabase
        .from("deal_steps")
        .select(STEP_COLS)
        .eq("deal_id", data.dealId);
      const next = dueForNext(dealKind(deal), (steps ?? []) as StepRow[], now);
      if (next)
        await context.supabase
          .from("deal_steps")
          .update({ due_at: next.due_at })
          .eq("deal_id", data.dealId)
          .eq("key", next.key);
    }
    return { success: true };
  });

export const dealTermsSchema = z.object({
  dealId: z.string().uuid(),
  track: z.enum(["ready", "offplan"]),
  total_commission_percent: z.number().min(0).max(20),
  co_broker_name: z.string().trim().max(200),
  co_broker_percent: z.number().min(0).max(100),
  vat_percent: z.number().min(0).max(20),
  loan_aed: z.number().min(0).max(100_000_000_000).nullable(),
  seller_name: z.string().trim().max(200),
});

/** Commission terms, co-broker and track. Changing the track restarts the steps only while none is done. */
export const updateDealTerms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(dealTermsSchema)
  .handler(async ({ data, context }) => {
    await guard(context);
    const deal = await loadDeal(context, data.dealId);
    const { dealId, ...fields } = data;
    const trackChanged = deal.deal_type === "sale" && deal.track !== fields.track;
    if (trackChanged) {
      const { count } = await context.supabase
        .from("deal_steps")
        .select("id", { count: "exact", head: true })
        .eq("deal_id", dealId)
        .not("done_at", "is", null);
      if ((count ?? 0) > 0)
        throw new Error("Undo the finished steps before switching between ready and off-plan.");
    }
    const { error } = await context.supabase.from("deals").update(fields).eq("id", dealId);
    if (error) throw new Error("Only the deal's agent or the owner can change the terms.");
    if (trackChanged) {
      await context.supabase.from("deal_steps").delete().eq("deal_id", dealId);
      const rows = initialSteps(
        dealKind({ deal_type: deal.deal_type, track: fields.track }),
        new Date().toISOString(),
      ).map((s) => ({ ...s, deal_id: dealId, agency_id: deal.agency_id }));
      await context.supabase.from("deal_steps").insert(rows);
    }
    return { success: true };
  });

export const addDealPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      dealId: z.string().uuid(),
      kind: z.enum(["deposit", "commission_received", "co_broker_paid", "agent_paid", "other"]),
      amount_aed: z.number().positive().max(100_000_000_000),
      paid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      note: z.string().trim().max(300),
    }),
  )
  .handler(async ({ data, context }) => {
    await guard(context);
    const deal = await loadDeal(context, data.dealId);
    const { dealId, ...fields } = data;
    const { error } = await context.supabase
      .from("deal_payments")
      .insert({ ...fields, deal_id: dealId, agency_id: deal.agency_id });
    if (error) throw new Error("Only the deal's agent or the owner can record payments.");
    return { success: true };
  });

export const deleteDealPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid())
  .handler(async ({ data, context }) => {
    await requireOwner(context.supabase, context.userId);
    const { error } = await context.supabase.from("deal_payments").delete().eq("id", data);
    if (error) throw new Error("Could not remove the payment.");
    return { success: true };
  });

/** Issue a numbered commission invoice; the amounts are frozen in the invoice so later edits never change it. */
export const issueInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid())
  .handler(async ({ data: dealId, context }) => {
    const access = await guard(context);
    const deal = await loadDeal(context, dealId);
    const [{ data: settings }, { data: member }] = await Promise.all([
      context.supabase
        .from("app_settings")
        .select("*")
        .eq("agency_id", deal.agency_id)
        .maybeSingle(),
      context.supabase
        .from("agency_members")
        .select("split_percent")
        .eq("agency_id", deal.agency_id)
        .eq("user_id", deal.agent_id)
        .maybeSingle(),
    ]);
    const lead = deal.leads as { name: string; phone: string } | null;
    const listing = deal.listings as { title: string; community: string } | null;
    const totalPercent =
      deal.total_commission_percent == null
        ? Number(deal.commission_percent)
        : Number(deal.total_commission_percent);
    const money = dealMoney({
      price: Number(deal.price_aed),
      totalCommissionPercent: totalPercent,
      coBrokerPercent: Number(deal.co_broker_percent),
      splitPercent: member ? Number(member.split_percent) : DEFAULT_SPLIT_PERCENT,
      vatPercent: Number(deal.vat_percent),
    });
    if (money.gci <= 0) throw new Error("Set the price and commission before issuing an invoice.");
    const snapshot = {
      agency: {
        name: (settings?.agency_name as string | undefined) || access.agencyName,
        rera_brn: (settings?.rera_brn as string | undefined) ?? "",
        trn: (settings?.company_trn as string | undefined) ?? "",
        bank: (settings?.bank_details as string | undefined) ?? "",
      },
      client: { name: lead?.name ?? "", phone: lead?.phone ?? "" },
      property: listing
        ? `${listing.title}${listing.community ? `, ${listing.community}` : ""}`
        : "",
      dealType: deal.deal_type,
      price: Number(deal.price_aed),
      totalCommissionPercent: totalPercent,
      coBrokerName: deal.co_broker_name,
      coBrokerPercent: Number(deal.co_broker_percent),
      vatPercent: Number(deal.vat_percent),
      gci: money.gci,
      vat: money.vat,
      total: money.invoiceTotal,
    };
    const { data: number, error } = await context.supabase.rpc("issue_deal_invoice", {
      _deal: dealId,
      _snapshot: snapshot,
    });
    if (error || !number)
      throw new Error("Only the deal's agent or the owner can issue an invoice.");
    return { number };
  });

export const getInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.string().uuid())
  .handler(async ({ data, context }) => {
    await guard(context);
    const { data: inv, error } = await context.supabase
      .from("deal_invoices")
      .select("*")
      .eq("id", data)
      .maybeSingle();
    if (error || !inv) throw new Error("Invoice not found.");
    return inv;
  });

/** Owner: invoice details and the fee figures used for buyer cost estimates. */
export const dealSettingsSchema = z.object({
  company_trn: z.string().trim().max(30),
  bank_details: z.string().trim().max(500),
  default_commission_percent: z.number().min(0).max(20),
  vat_percent: z.number().min(0).max(20),
  dld_fee_percent: z.number().min(0).max(20),
  dld_admin_aed: z.number().min(0).max(100_000),
  trustee_fee_low_aed: z.number().min(0).max(100_000),
  trustee_fee_high_aed: z.number().min(0).max(100_000),
  mortgage_reg_percent: z.number().min(0).max(5),
});

export const getDealSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = await requireOwner(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("app_settings")
      .select("*")
      .eq("agency_id", access.agencyId)
      .maybeSingle();
    const s = (data ?? {}) as Record<string, unknown>;
    const fees = feesFrom(s as Partial<Fees>);
    return {
      company_trn: String(s["company_trn"] ?? ""),
      bank_details: String(s["bank_details"] ?? ""),
      default_commission_percent: Number(s["default_commission_percent"] ?? 2),
      ...fees,
    };
  });

export const saveDealSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(dealSettingsSchema)
  .handler(async ({ data, context }) => {
    const access = await requireOwner(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("app_settings")
      .upsert(
        { agency_id: access.agencyId, ...data, updated_at: new Date().toISOString() },
        { onConflict: "agency_id" },
      );
    if (error) throw new Error("Could not save the deal settings.");
    return { success: true };
  });

export const complianceSchema = z.object({
  dealId: z.string().uuid(),
  buyer_id_collected: z.boolean(),
  seller_id_collected: z.boolean(),
  is_company: z.boolean(),
  company_papers_collected: z.boolean(),
  payer_is_the_buyer: z.boolean(),
  payer_name: z.string().trim().max(200),
  cash_aed: z.number().min(0).max(100_000_000_000),
  virtual_asset: z.boolean(),
  source_of_funds: z.string().trim().max(500),
  politically_exposed: z.boolean(),
  rear_filed: z.boolean(),
  rear_reference: z.string().trim().max(100),
  rear_filed_on: z.string().date().nullable(),
  notes: z.string().trim().max(2000),
});

/** Save the deal's money-and-ID record. Only the deal's agent or the owner, and every change is logged. */
export const saveCompliance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(complianceSchema)
  .handler(async ({ data, context }) => {
    const { dealId, ...row } = data;
    const deal = await loadDeal(context, dealId);
    const { data: canEdit } = await context.supabase.rpc("can_edit_deal", { _deal: dealId });
    if (canEdit !== true)
      throw new Error("Only the deal's agent or the agency owner can change this record.");
    const { error } = await context.supabase.from("deal_compliance").upsert(
      {
        ...row,
        deal_id: dealId,
        agency_id: deal.agency_id,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "deal_id" },
    );
    if (error) throw new Error("Could not save the record.");
    return { success: true };
  });
