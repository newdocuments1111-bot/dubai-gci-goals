import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Building2, MessageCircle, Phone, Settings2 } from "lucide-react";
import { getInbox, claimLead } from "@/lib/inbox.functions";
import { assignLead } from "@/lib/leads-app.functions";
import { PORTAL_SOURCES, matchListings, replyState, elapsed, whatsappLink } from "@/lib/inbox";
import { aed } from "@/lib/pipeline";
import { Button } from "@/components/ui/button";
import { useLang } from "@/hooks/use-lang";

const inboxQuery = queryOptions({ queryKey: ["inbox"], queryFn: () => getInbox() });

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({
    meta: [
      { title: "Inbox — Dubai AI GCI" },
      {
        name: "description",
        content: "Every new lead from portals, ads and your website, with reply time and agent.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(inboxQuery),
  component: InboxPage,
});

// 44px tall on phones for thumbs, the usual 36px from `md` up.
const selectCls = "h-11 rounded-md border border-input bg-background px-2 text-sm md:h-9";
// Filters sit two to a row on phones.
const filterCls = `${selectCls} min-w-0 grow basis-[calc(50%-0.25rem)] md:grow-0 md:basis-auto`;
const memberName = (m: { display_name: string | null; email: string | null } | undefined) =>
  m ? m.display_name || m.email || "Agent" : "Unassigned";

function SourceBadge({ source }: { source: string }) {
  const portal = (PORTAL_SOURCES as readonly string[]).includes(source);
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${portal ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
    >
      {portal && <Building2 className="size-3" aria-hidden />}
      {source}
    </span>
  );
}

function InboxPage() {
  const { data } = useSuspenseQuery(inboxQuery);
  const { t } = useLang();
  const client = useQueryClient();
  const claim = useServerFn(claimLead);
  const assign = useServerFn(assignLead);
  const [tab, setTab] = useState<"assigned" | "pool">("assigned");
  const [source, setSource] = useState("all");
  const [agent, setAgent] = useState("all");
  const [reply, setReply] = useState<"all" | "waiting" | "replied">("all");
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const isOwner = data.access.isOwner;
  const now = new Date();

  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["inbox"] });
    void client.invalidateQueries({ queryKey: ["leads"] });
    void client.invalidateQueries({ queryKey: ["pipeline"] });
  };
  const run = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    setError("");
    try {
      await fn();
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Something went wrong."));
    } finally {
      setBusy(null);
    }
  };

  const leads = useMemo(
    () =>
      data.leads.filter((l) => {
        if (source !== "all" && l.source !== source) return false;
        if (agent !== "all" && l.assigned_agent_id !== agent) return false;
        const r = replyState(l, now);
        if (reply === "waiting" && r.replied) return false;
        if (reply === "replied" && !r.replied) return false;
        return true;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.leads, source, agent, reply],
  );
  const waiting = data.leads.filter((l) => !l.first_reply_at && l.outcome === "open").length;
  const sources = [...new Set(data.leads.map((l) => l.source))].sort();

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Inbox")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("New leads from portals, ads and your website, newest first. Last 30 days.")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Stat label={t("New")} value={data.leads.length} />
          <Stat label={t("Waiting for reply")} value={waiting} alert={waiting > 0} />
          <Stat label={t("In pool")} value={data.pool.length} alert={data.pool.length > 0} />
          {isOwner && (
            <Button asChild variant="outline" size="sm">
              <Link to="/settings/routing">
                <Settings2 className="size-4" />
                {t("Routing and portals")}
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div
          role="tablist"
          aria-label={t("Inbox view")}
          className="flex w-full rounded-lg border border-border p-1 text-sm md:w-auto"
        >
          {(
            [
              ["assigned", t("Assigned ({n})", { n: data.leads.length })],
              ["pool", t("Pool ({n})", { n: data.pool.length })],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              role="tab"
              aria-selected={tab === v}
              onClick={() => setTab(v)}
              className={`flex-1 rounded-md px-3 py-3 md:flex-none md:py-1.5 ${tab === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "assigned" && (
          <>
            <select
              aria-label={t("Source")}
              className={filterCls}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="all">{t("All sources")}</option>
              {sources.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            {isOwner && (
              <select
                aria-label={t("Agent")}
                className={filterCls}
                value={agent}
                onChange={(e) => setAgent(e.target.value)}
              >
                <option value="all">{t("All agents")}</option>
                {data.members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {memberName(m)}
                  </option>
                ))}
              </select>
            )}
            <select
              aria-label={t("Reply")}
              className={filterCls}
              value={reply}
              onChange={(e) => setReply(e.target.value as typeof reply)}
            >
              <option value="all">{t("Replied or waiting")}</option>
              <option value="waiting">{t("Waiting for reply")}</option>
              <option value="replied">{t("Replied")}</option>
            </select>
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {tab === "assigned" ? (
        leads.length === 0 ? (
          <Empty isOwner={isOwner} />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
            {leads.map((l) => {
              const r = replyState(l, now);
              const matches = matchListings(l, data.listings);
              const wa = whatsappLink(l.phone);
              const expanded = open === l.id;
              return (
                <li key={l.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="min-w-0 flex-1 basis-full md:basis-64">
                      <div className="flex flex-wrap items-center gap-2">
                        <SourceBadge source={l.source} />
                        <Link
                          to="/lead/$leadId"
                          params={{ leadId: l.id }}
                          className="truncate font-medium hover:underline"
                        >
                          {l.name || t("Unnamed lead")}
                        </Link>
                        {l.portal_ref && (
                          <span className="text-xs text-muted-foreground">
                            {t("Ref {ref}", { ref: l.portal_ref })}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {[l.area, l.budget, l.stage_name].filter(Boolean).join(" · ") ||
                          t("No details yet")}
                        {l.enquiry && <> · “{l.enquiry}”</>}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${r.replied ? "bg-primary/10 text-primary" : r.late ? "bg-destructive/10 text-destructive" : "bg-warning/15 text-warning-foreground"}`}
                    >
                      {r.replied
                        ? t("Replied in {time}", {
                            time: elapsed(l.created_at, l.first_reply_at ?? now),
                          })
                        : t("Waiting {time}", { time: elapsed(l.created_at, now) })}
                    </span>
                    <div className="min-w-0 flex-1 text-sm md:w-40 md:flex-none md:shrink-0">
                      {isOwner ? (
                        <select
                          aria-label={`Agent for ${l.name || "lead"}`}
                          className={`${selectCls} w-full`}
                          value={l.assigned_agent_id ?? ""}
                          disabled={busy === l.id}
                          onChange={(e) =>
                            void run(l.id, () =>
                              assign({ data: { id: l.id, agentId: e.target.value } }),
                            )
                          }
                        >
                          {data.members.map((m) => (
                            <option key={m.user_id} value={m.user_id}>
                              {memberName(m)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-muted-foreground">
                          {l.routed ? t("Routed to you") : t("Yours")} ·{" "}
                          {t("{time} ago", { time: elapsed(l.assigned_at ?? l.created_at, now) })}
                        </span>
                      )}
                    </div>
                    <div className="hidden shrink-0 items-center gap-1 md:flex">
                      <button
                        type="button"
                        onClick={() => setOpen(expanded ? null : l.id)}
                        className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-expanded={expanded}
                      >
                        {matches.length === 1
                          ? t("1 match")
                          : t("{n} matches", { n: matches.length })}
                      </button>
                      {l.phone && (
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          aria-label={`Call ${l.name || "lead"}`}
                        >
                          <a href={`tel:${l.phone.replace(/[^\d+]/g, "")}`}>
                            <Phone className="size-4" />
                          </a>
                        </Button>
                      )}
                      {wa && (
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          aria-label={`WhatsApp ${l.name || "lead"}`}
                        >
                          <a href={wa} target="_blank" rel="noreferrer">
                            <MessageCircle className="size-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                    {/* Phones: big Call and WhatsApp buttons instead of the small icons above. */}
                    <div className="flex w-full items-center gap-2 md:hidden">
                      {l.phone && (
                        <Button asChild className="h-11 min-w-0 flex-1">
                          <a href={`tel:${l.phone.replace(/[^\d+]/g, "")}`}>
                            <Phone className="size-4" />
                            {t("Call")}
                          </a>
                        </Button>
                      )}
                      {wa && (
                        <Button asChild variant="outline" className="h-11 min-w-0 flex-1">
                          <a href={wa} target="_blank" rel="noreferrer">
                            <MessageCircle className="size-4" />
                            {t("WhatsApp")}
                          </a>
                        </Button>
                      )}
                      <button
                        type="button"
                        onClick={() => setOpen(expanded ? null : l.id)}
                        className="min-h-11 shrink-0 rounded-md border border-input px-3 text-xs text-muted-foreground"
                        aria-expanded={expanded}
                      >
                        {matches.length === 1
                          ? t("1 match")
                          : t("{n} matches", { n: matches.length })}
                      </button>
                    </div>
                  </div>
                  {expanded && (
                    <div className="mt-2 rounded-lg bg-muted/50 p-3 text-sm">
                      {matches.length === 0 ? (
                        <p className="text-muted-foreground">
                          {t("No available listing fits this area and budget yet.")}
                        </p>
                      ) : (
                        <ul className="grid gap-1">
                          {matches.map((m) => (
                            <li key={m.listing.id} className="flex flex-wrap items-center gap-2">
                              <Link
                                to="/listing/$listingId"
                                params={{ listingId: m.listing.id }}
                                className="font-medium hover:underline"
                              >
                                {m.listing.title}
                              </Link>
                              <span className="text-muted-foreground">
                                {[m.listing.community, aed(m.listing.price_aed)]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {[m.areaFit && t("area fits"), m.budgetFit && t("budget fits")]
                                  .filter(Boolean)
                                  .join(", ")}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )
      ) : data.pool.length === 0 ? (
        <p className="rounded-xl border border-border bg-background p-6 text-sm text-muted-foreground">
          {t(
            "The pool is empty. Leads land here when no agent is free, or when the agent doesn't reply within {n} minutes.",
            { n: data.poolAfterMinutes },
          )}
        </p>
      ) : (
        <>
          <p className="mb-2 text-xs text-muted-foreground">
            {isOwner
              ? t("Assign a pool lead to an agent, or take it yourself.")
              : t("Take up to {n} pool leads a day. Phone numbers show once the lead is yours.", {
                  n: data.poolDailyLimit,
                })}
          </p>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
            {data.pool.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1 basis-full md:basis-64">
                  <div className="flex items-center gap-2">
                    <SourceBadge source={p.source} />
                    <span className="truncate font-medium">{p.name || t("Unnamed lead")}</span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {[p.area, p.budget].filter(Boolean).join(" · ") || t("No details yet")}
                    {p.enquiry && <> · “{p.enquiry}”</>}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {t("In pool {time}", { time: elapsed(p.pooled_at ?? p.created_at, now) })}
                </span>
                {isOwner && (
                  <select
                    aria-label={`Assign ${p.name || "lead"}`}
                    className={`${selectCls} min-w-0 flex-1 md:w-40 md:flex-none`}
                    value=""
                    disabled={busy === p.id}
                    onChange={(e) =>
                      void run(p.id, () => assign({ data: { id: p.id, agentId: e.target.value } }))
                    }
                  >
                    <option value="" disabled>
                      {t("Assign to…")}
                    </option>
                    {data.members.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {memberName(m)}
                      </option>
                    ))}
                  </select>
                )}
                <Button
                  size="sm"
                  className="h-11 flex-1 md:h-8 md:flex-none"
                  disabled={busy === p.id}
                  onClick={() => void run(p.id, () => claim({ data: p.id }))}
                >
                  {t("Take lead")}
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

function Stat({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <span
      className={`rounded-lg border px-3 py-1.5 ${alert ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-border bg-background"}`}
    >
      <strong className="me-1 font-semibold">{value}</strong>
      <span className={alert ? "" : "text-muted-foreground"}>{label}</span>
    </span>
  );
}

function Empty({ isOwner }: { isOwner: boolean }) {
  const { t } = useLang();
  return (
    <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center">
      <p className="font-medium">{t("No new leads here yet.")}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {isOwner ? (
          <>
            {t("Connect Property Finder, Bayut, Dubizzle, Meta forms or your website in")}{" "}
            <Link to="/settings/routing" className="underline">
              {t("Routing and portals")}
            </Link>
            {t(". Leads then arrive here by themselves.")}
          </>
        ) : (
          t("Leads routed to you appear here. Check the Pool tab for leads you can take.")
        )}
      </p>
    </div>
  );
}
