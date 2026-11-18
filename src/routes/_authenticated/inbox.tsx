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

const selectCls = "h-9 rounded-md border border-input bg-background px-2 text-sm";
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
      setError(e instanceof Error ? e.message : "Something went wrong.");
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
          <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
          <p className="text-sm text-muted-foreground">
            New leads from portals, ads and your website, newest first. Last 30 days.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Stat label="New" value={data.leads.length} />
          <Stat label="Waiting for reply" value={waiting} alert={waiting > 0} />
          <Stat label="In pool" value={data.pool.length} alert={data.pool.length > 0} />
          {isOwner && (
            <Button asChild variant="outline" size="sm">
              <Link to="/settings/routing">
                <Settings2 className="size-4" />
                Routing and portals
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div
          role="tablist"
          aria-label="Inbox view"
          className="flex rounded-lg border border-border p-1 text-sm"
        >
          {(
            [
              ["assigned", `Assigned (${data.leads.length})`],
              ["pool", `Pool (${data.pool.length})`],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              role="tab"
              aria-selected={tab === v}
              onClick={() => setTab(v)}
              className={`rounded-md px-3 py-1.5 ${tab === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "assigned" && (
          <>
            <select
              aria-label="Source"
              className={selectCls}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="all">All sources</option>
              {sources.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            {isOwner && (
              <select
                aria-label="Agent"
                className={selectCls}
                value={agent}
                onChange={(e) => setAgent(e.target.value)}
              >
                <option value="all">All agents</option>
                {data.members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {memberName(m)}
                  </option>
                ))}
              </select>
            )}
            <select
              aria-label="Reply"
              className={selectCls}
              value={reply}
              onChange={(e) => setReply(e.target.value as typeof reply)}
            >
              <option value="all">Replied or waiting</option>
              <option value="waiting">Waiting for reply</option>
              <option value="replied">Replied</option>
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
                    <div className="min-w-0 flex-1 basis-64">
                      <div className="flex flex-wrap items-center gap-2">
                        <SourceBadge source={l.source} />
                        <Link
                          to="/lead/$leadId"
                          params={{ leadId: l.id }}
                          className="truncate font-medium hover:underline"
                        >
                          {l.name || "Unnamed lead"}
                        </Link>
                        {l.portal_ref && (
                          <span className="text-xs text-muted-foreground">Ref {l.portal_ref}</span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {[l.area, l.budget, l.stage_name].filter(Boolean).join(" · ") ||
                          "No details yet"}
                        {l.enquiry && <> · “{l.enquiry}”</>}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${r.replied ? "bg-primary/10 text-primary" : r.late ? "bg-destructive/10 text-destructive" : "bg-warning/15 text-warning-foreground"}`}
                    >
                      {r.label}
                    </span>
                    <div className="w-40 shrink-0 text-sm">
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
                          {l.routed ? "Routed to you" : "Yours"} ·{" "}
                          {elapsed(l.assigned_at ?? l.created_at, now)} ago
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setOpen(expanded ? null : l.id)}
                        className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-expanded={expanded}
                      >
                        {matches.length} match{matches.length === 1 ? "" : "es"}
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
                  </div>
                  {expanded && (
                    <div className="mt-2 rounded-lg bg-muted/50 p-3 text-sm">
                      {matches.length === 0 ? (
                        <p className="text-muted-foreground">
                          No available listing fits this area and budget yet.
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
                                {[m.areaFit && "area fits", m.budgetFit && "budget fits"]
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
          The pool is empty. Leads land here when no agent is free, or when the agent doesn&apos;t
          reply within {data.poolAfterMinutes} minutes.
        </p>
      ) : (
        <>
          <p className="mb-2 text-xs text-muted-foreground">
            {isOwner
              ? "Assign a pool lead to an agent, or take it yourself."
              : `Take up to ${data.poolDailyLimit} pool leads a day. Phone numbers show once the lead is yours.`}
          </p>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
            {data.pool.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1 basis-64">
                  <div className="flex items-center gap-2">
                    <SourceBadge source={p.source} />
                    <span className="truncate font-medium">{p.name || "Unnamed lead"}</span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {[p.area, p.budget].filter(Boolean).join(" · ") || "No details yet"}
                    {p.enquiry && <> · “{p.enquiry}”</>}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  In pool {elapsed(p.pooled_at ?? p.created_at, now)}
                </span>
                {isOwner && (
                  <select
                    aria-label={`Assign ${p.name || "lead"}`}
                    className={`${selectCls} w-40`}
                    value=""
                    disabled={busy === p.id}
                    onChange={(e) =>
                      void run(p.id, () => assign({ data: { id: p.id, agentId: e.target.value } }))
                    }
                  >
                    <option value="" disabled>
                      Assign to…
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
                  disabled={busy === p.id}
                  onClick={() => void run(p.id, () => claim({ data: p.id }))}
                >
                  Take lead
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
      <strong className="mr-1 font-semibold">{value}</strong>
      <span className={alert ? "" : "text-muted-foreground"}>{label}</span>
    </span>
  );
}

function Empty({ isOwner }: { isOwner: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center">
      <p className="font-medium">No new leads here yet.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {isOwner ? (
          <>
            Connect Property Finder, Bayut, Dubizzle, Meta forms or your website in{" "}
            <Link to="/settings/routing" className="underline">
              Routing and portals
            </Link>
            . Leads then arrive here by themselves.
          </>
        ) : (
          "Leads routed to you appear here. Check the Pool tab for leads you can take."
        )}
      </p>
    </div>
  );
}
