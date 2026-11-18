import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Sparkles, Target } from "lucide-react";
import { listAlerts, markAlertRead } from "@/lib/leads-app.functions";
import { getAgentHome, getOwnerHome } from "@/lib/home.functions";
import { setMyGoal } from "@/lib/team.functions";
import { dubaiDate } from "@/lib/listings";
import { useMembership } from "@/hooks/use-membership";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { getWeeklyReport } from "@/lib/weekly-report.functions";
import { greeting } from "@/lib/nav";
import { isOverdue } from "@/lib/pipeline";
import { getPipeline } from "@/lib/pipeline.functions";

const agentQuery = queryOptions({ queryKey: ["home", "agent"], queryFn: () => getAgentHome() });
const ownerQuery = queryOptions({ queryKey: ["home", "owner"], queryFn: () => getOwnerHome() });
const alertsQuery = queryOptions({ queryKey: ["alerts"], queryFn: () => listAlerts() });
const aed = (n: number) => `AED ${Math.round(n).toLocaleString("en-US")}`;

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Today — Dubai AI GCI" },
      {
        name: "description",
        content: "Your GCI, goal, hot leads, viewings and what needs you today.",
      },
      { property: "og:title", content: "Home — Dubai AI GCI" },
      {
        property: "og:description",
        content: "Agent and owner home for the Dubai AI GCI assistant.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(agentQuery),
      context.queryClient.ensureQueryData(alertsQuery),
    ]),
  component: HomePage,
});

function HomePage() {
  const membership = useMembership();
  const [view, setView] = useState<"owner" | "agent">(membership.isOwner ? "owner" : "agent");
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: "Asia/Dubai",
            })}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting(new Date())}
            {membership.displayName ? `, ${membership.displayName.split(" ")[0]}` : ""}
          </h1>
        </div>
        {membership.isOwner && (
          <div
            role="tablist"
            aria-label="Home view"
            className="flex rounded-lg border border-border p-1 text-sm"
          >
            {(["owner", "agent"] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1.5 ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                {v === "owner" ? "Agency" : "My work"}
              </button>
            ))}
          </div>
        )}
      </div>
      <Alerts />
      {view === "owner" ? <OwnerHome /> : <AgentHome />}
    </main>
  );
}

function Alerts() {
  const { data } = useSuspenseQuery(alertsQuery);
  const markRead = useServerFn(markAlertRead);
  const client = useQueryClient();
  const unread = data.filter((a) => !a.read && a.kind !== "missed").slice(0, 6);
  if (!unread.length) return null;
  return (
    <section aria-label="Alerts" className="mb-6 space-y-2">
      {unread.map((a) => (
        <div
          key={a.id}
          role="alert"
          className={`flex items-center gap-3 rounded-lg border p-3 text-sm ${a.kind === "assigned" ? "border-primary/30 bg-primary/5" : a.kind === "aml" || a.kind === "pool" ? "border-warning bg-warning/10" : "border-destructive bg-destructive/10"}`}
        >
          <span className="flex-1">
            {a.kind === "hot"
              ? "🔥 "
              : a.kind === "assigned"
                ? "📥 "
                : a.kind === "pool"
                  ? "↩️ "
                  : "⚠️ "}
            {a.lead_id && (a.kind === "assigned" || a.kind === "pool") ? (
              <Link className="underline" to="/lead/$leadId" params={{ leadId: a.lead_id }}>
                {a.message}
              </Link>
            ) : (
              a.message
            )}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await markRead({ data: a.id });
              client.invalidateQueries({ queryKey: alertsQuery.queryKey });
            }}
          >
            Dismiss
          </Button>
        </div>
      ))}
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4 shadow-xs">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function AgentHome() {
  const { data } = useSuspenseQuery(agentQuery);
  const client = useQueryClient();
  const saveGoal = useServerFn(setMyGoal);
  const [goal, setGoal] = useState(data.goal ? String(data.goal) : "");
  const [goalMsg, setGoalMsg] = useState("");
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="My GCI this month" value={aed(data.gci.month)} />
        <Stat
          label="My GCI this year"
          value={aed(data.gci.year)}
          note={`My share this year: ${aed(data.gci.myShareYear)} (${data.access.splitPercent}% split)`}
        />
        <div className="rounded-lg border border-border p-4">
          <p className="flex items-center gap-1 text-sm font-medium">
            <Target className="size-4" />
            My yearly goal
          </p>
          <p className="mt-1 text-2xl font-bold">{data.goal ? aed(data.goal) : "Not set"}</p>
          <Progress value={data.progress} className="mt-2" aria-label="Goal progress" />
          <p className="mt-1 text-xs text-muted-foreground">
            {data.progress}% reached (closed deals this year)
          </p>
          {data.canSetGoal ? (
            <form
              className="mt-2 flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                setGoalMsg("");
                const r = await saveGoal({
                  data: Math.max(0, Number(goal.replace(/[^\d.]/g, "")) || 0),
                });
                if ("error" in r) setGoalMsg(r.error);
                else {
                  await client.invalidateQueries({ queryKey: ["home"] });
                  setGoalMsg("Goal saved.");
                }
              }}
            >
              <Input
                aria-label="Yearly GCI goal in AED"
                inputMode="numeric"
                placeholder="e.g. 1,000,000"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="h-8"
              />
              <Button size="sm" variant="outline" type="submit">
                Save
              </Button>
            </form>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Your owner sets goals in this agency.
            </p>
          )}
          {goalMsg && (
            <p role="status" className="mt-1 text-xs">
              {goalMsg}
            </p>
          )}
        </div>
      </section>

      <section
        aria-label="AI daily summary"
        className="rounded-lg border border-primary/40 bg-primary/5 p-5"
      >
        <h2 className="mb-2 flex items-center gap-2 font-semibold">
          <Sparkles className="size-4 text-primary" />
          AI daily summary
        </h2>
        <p className="text-sm">
          Today: <strong>{data.summary.newLeads}</strong> new lead
          {data.summary.newLeads === 1 ? "" : "s"} · the AI handled{" "}
          <strong>{data.summary.aiHandledChats}</strong> chat
          {data.summary.aiHandledChats === 1 ? "" : "s"} ·{" "}
          <strong>{data.viewingsToday.length}</strong> viewing
          {data.viewingsToday.length === 1 ? "" : "s"}.
        </p>
        <h3 className="mt-3 text-sm font-medium">What needs you today</h3>
        {data.summary.needsMe.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing urgent. Nice work.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-sm">
            {data.summary.needsMe.map((n, i) => (
              <li key={i}>
                •{" "}
                {n.leadId ? (
                  <Link className="underline" to="/lead/$leadId" params={{ leadId: n.leadId }}>
                    {n.text}
                  </Link>
                ) : (
                  <Link className="underline" to="/follow-ups">
                    {n.text}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-4">
          <h2 className="mb-2 font-semibold">🔥 Hot leads ({data.hotLeads.length})</h2>
          {data.hotLeads.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hot leads yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {data.hotLeads.map((l) => (
                <li key={l.id}>
                  <Link className="underline" to="/lead/$leadId" params={{ leadId: l.id }}>
                    {l.name || "Unnamed"}
                  </Link>
                  {l.area && <span className="text-muted-foreground"> · {l.area}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-border p-4">
          <h2 className="mb-2 font-semibold">Today's viewings</h2>
          {data.viewingsToday.length === 0 ? (
            <p className="text-sm text-muted-foreground">No viewings today.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {data.viewingsToday.map((v) => (
                <li key={v.id}>
                  {dubaiDate(v.starts_at)} · {v.leadName || "Client"} ({v.kind})
                </li>
              ))}
            </ul>
          )}
        </div>
        <Link to="/follow-ups" className="rounded-lg border border-border p-4 hover:border-primary">
          <p className="text-2xl font-bold">{data.followUpsDue}</p>
          <p className="text-sm text-muted-foreground">Follow-ups due for approval</p>
        </Link>
      </section>
    </div>
  );
}

function OwnerHome() {
  const { data, error } = useQuery(ownerQuery);
  const { data: weekly, error: weeklyError } = useQuery({
    queryKey: ["weekly-report", "current"],
    queryFn: () => getWeeklyReport({ data: { current: true } }),
  });
  if (error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {error.message}
      </p>
    );
  if (!data) return <p className="text-sm text-muted-foreground">Loading agency numbers…</p>;
  return (
    <div className="space-y-6">
      <NeedsYouToday problems={data.problems} missedLeadMinutes={data.missedLeadMinutes} />
      <section
        aria-label="This week"
        className="rounded-xl border border-border bg-background p-4 shadow-xs"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">This week</h2>
          <Button asChild variant="outline" size="sm">
            <Link to="/owner/weekly-report">Monday report</Link>
          </Button>
        </div>
        {weekly && (
          <p className="mt-2 text-sm">
            {weekly.report.enquiries} enquiries · {weekly.report.hotLeads} Hot leads ·{" "}
            {weekly.report.viewings.booked} viewings booked · {weekly.report.weekGci.deals} deals
            closed · {aed(weekly.report.weekGci.gci)} GCI · {weekly.report.missed} missed alerts
          </p>
        )}
        {weeklyError && (
          <p role="alert" className="text-sm text-destructive">
            {weeklyError.message}
          </p>
        )}
      </section>
      <section className="grid gap-4 sm:grid-cols-4">
        <Stat label="Total GCI this month" value={aed(data.gci.month)} />
        <Stat label="Total GCI this year" value={aed(data.gci.year)} />
        <Stat
          label="Agency share this year"
          value={aed(data.gci.agencyYear)}
          note={`This month: ${aed(data.gci.agencyMonth)}`}
        />
        <Stat
          label="Deals from AI-handled leads (this year)"
          value={data.gci.aiHandledDeals}
          note={`GCI: ${aed(data.gci.aiHandledGciYear)}`}
        />
      </section>
      <section className="grid gap-4 sm:grid-cols-4">
        <Stat label="Viewings kept (this month)" value={data.viewingsMonth.kept} />
        <Stat
          label="No-shows (this month)"
          value={data.viewingsMonth.noShows}
          note={`${data.viewingsMonth.booked} still booked`}
        />
        <Stat
          label="AI replies (this month)"
          value={data.usageMonth.aiReplies}
          note={`WhatsApp messages: ${data.usageMonth.whatsappMessages} (not connected yet)`}
        />
        <Stat
          label="Hours saved (estimate)"
          value={`~${data.hoursSavedEstimate} h`}
          note={`Estimate: AI replies × ${data.minutesPerReply} min each`}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-background p-5 shadow-xs">
          <h2 className="mb-3 font-semibold">GCI per agent</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1">Agent</th>
                <th>This month</th>
                <th>This year</th>
              </tr>
            </thead>
            <tbody>
              {data.perAgent.map((a) => (
                <tr key={a.userId} className="border-t border-border">
                  <td className="py-1.5">{a.name}</td>
                  <td>{aed(a.month)}</td>
                  <td>{aed(a.year)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-xl border border-border bg-background p-5 shadow-xs">
          <h2 className="mb-3 font-semibold">Agent leaderboard</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1">#</th>
                <th>Agent</th>
                <th>GCI (year)</th>
                <th>Avg reply</th>
                <th>Viewings (30 days)</th>
              </tr>
            </thead>
            <tbody>
              {data.leaderboard.map((r, i) => (
                <tr key={r.userId} className="border-t border-border">
                  <td className="py-1.5">{i + 1}</td>
                  <td>{r.name}</td>
                  <td>{aed(r.gciYear)}</td>
                  <td>{r.avgReplyMinutes === null ? "—" : `${r.avgReplyMinutes} min`}</td>
                  <td>{r.viewings}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">
            Ranked by GCI, then faster replies, then viewings.
          </p>
        </div>
      </section>
    </div>
  );
}

/** One action list for the owner: overdue pipeline steps first, then problems (missed replies etc.). */
function NeedsYouToday({
  problems,
  missedLeadMinutes,
}: {
  problems: { text: string; leadId?: string | undefined }[];
  missedLeadMinutes: number;
}) {
  const { data: pipeline } = useQuery({ queryKey: ["pipeline"], queryFn: () => getPipeline() });
  const overdue = (pipeline?.leads ?? []).filter((l) => isOverdue(l)).slice(0, 8);
  const total = overdue.length + problems.length;
  return (
    <section
      aria-label="Needs you today"
      className="rounded-xl border border-border bg-background shadow-xs"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 className="font-semibold">Needs you today</h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${total ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}
        >
          {total} open
        </span>
      </div>
      {total === 0 ? (
        <p className="px-5 py-4 text-sm text-muted-foreground">
          Nothing waiting on you. Every lead has a next step on time.
        </p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {overdue.map((l) => (
            <li key={l.id}>
              <Link
                to="/lead/$leadId"
                params={{ leadId: l.id }}
                className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/50"
              >
                <span className="size-2 shrink-0 rounded-full bg-destructive" aria-hidden />
                <span className="min-w-0 flex-1 truncate">
                  <strong className="font-medium">{l.name || "Unnamed lead"}</strong> ·{" "}
                  {l.next_action || l.stage_name || `Step ${l.stage}`}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  Overdue · {l.who || "Agent"}
                </span>
              </Link>
            </li>
          ))}
          {problems.map((p, i) => (
            <li key={`p${i}`}>
              {p.leadId ? (
                <Link
                  to="/lead/$leadId"
                  params={{ leadId: p.leadId }}
                  className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/50"
                >
                  <span className="size-2 shrink-0 rounded-full bg-warning" aria-hidden />
                  <span className="flex-1">{p.text}</span>
                </Link>
              ) : (
                <p className="flex items-center gap-3 px-5 py-2.5">
                  <span className="size-2 shrink-0 rounded-full bg-warning" aria-hidden />
                  <span className="flex-1">{p.text}</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-border px-5 py-2 text-xs text-muted-foreground">
        Red = pipeline step past its due time. Amber = client waiting more than {missedLeadMinutes}{" "}
        min, or another problem.{" "}
        <Link to="/pipeline" className="underline">
          Open the board
        </Link>
      </p>
    </section>
  );
}
