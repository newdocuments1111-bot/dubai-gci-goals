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
import { useLang } from "@/hooks/use-lang";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { getWeeklyReport } from "@/lib/weekly-report.functions";
import { greeting } from "@/lib/nav";
import { AskCrm } from "@/components/AskCrm";
import { TargetsCard } from "@/components/TargetsCard";
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
  const { lang, t } = useLang();
  const [view, setView] = useState<"owner" | "agent">(membership.isOwner ? "owner" : "agent");
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString(lang === "ar" ? "ar-AE" : "en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: "Asia/Dubai",
            })}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t(greeting(new Date()))}
            {membership.displayName ? `, ${membership.displayName.split(" ")[0]}` : ""}
          </h1>
        </div>
        {membership.isOwner && (
          <div
            role="tablist"
            aria-label={t("Home view")}
            className="flex rounded-lg border border-border p-1 text-sm"
          >
            {(["owner", "agent"] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`rounded-md px-4 py-3 md:px-3 md:py-1.5 ${view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                {v === "owner" ? t("Agency") : t("My work")}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="mb-6">
        <AskCrm isOwner={membership.isOwner} />
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
          <span className="min-w-0 flex-1 break-words">
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
            className="h-11 shrink-0 md:h-8"
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
  const { t } = useLang();
  const saveGoal = useServerFn(setMyGoal);
  const [goal, setGoal] = useState(data.goal ? String(data.goal) : "");
  const [goalMsg, setGoalMsg] = useState("");
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label={t("My GCI this month")} value={aed(data.gci.month)} />
        <Stat
          label={t("My GCI this year")}
          value={aed(data.gci.year)}
          note={t("My share this year: {amount} ({percent}% split)", {
            amount: aed(data.gci.myShareYear),
            percent: data.access.splitPercent,
          })}
        />
        <div className="rounded-lg border border-border p-4">
          <p className="flex items-center gap-1 text-sm font-medium">
            <Target className="size-4" />
            {t("My yearly goal")}
          </p>
          <p className="mt-1 text-2xl font-bold">{data.goal ? aed(data.goal) : t("Not set")}</p>
          <Progress value={data.progress} className="mt-2" aria-label={t("Goal progress")} />
          <p className="mt-1 text-xs text-muted-foreground">
            {t("{n}% reached (closed deals this year)", { n: data.progress })}
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
                  setGoalMsg(t("Goal saved."));
                }
              }}
            >
              <Input
                aria-label={t("Yearly GCI goal in AED")}
                inputMode="numeric"
                placeholder="e.g. 1,000,000"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="h-11 md:h-8"
              />
              <Button size="sm" variant="outline" type="submit" className="h-11 md:h-8">
                {t("Save")}
              </Button>
            </form>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("Your owner sets goals in this agency.")}
            </p>
          )}
          {goalMsg && (
            <p role="status" className="mt-1 text-xs">
              {goalMsg}
            </p>
          )}
        </div>
      </section>

      <TargetsCard onlyMe />

      <section
        aria-label={t("AI daily summary")}
        className="rounded-lg border border-primary/40 bg-primary/5 p-5"
      >
        <h2 className="mb-2 flex items-center gap-2 font-semibold">
          <Sparkles className="size-4 text-primary" />
          {t("AI daily summary")}
        </h2>
        <p className="text-sm">
          {t("Today: {leads} new leads · the AI handled {chats} chats · {viewings} viewings.", {
            leads: data.summary.newLeads,
            chats: data.summary.aiHandledChats,
            viewings: data.viewingsToday.length,
          })}
        </p>
        <h3 className="mt-3 text-sm font-medium">{t("What needs you today")}</h3>
        {data.summary.needsMe.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("Nothing urgent. Nice work.")}</p>
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
          <h2 className="mb-2 font-semibold">
            🔥 {t("Hot leads ({n})", { n: data.hotLeads.length })}
          </h2>
          {data.hotLeads.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("No hot leads yet.")}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {data.hotLeads.map((l) => (
                <li key={l.id}>
                  <Link className="underline" to="/lead/$leadId" params={{ leadId: l.id }}>
                    {l.name || t("Unnamed")}
                  </Link>
                  {l.area && <span className="text-muted-foreground"> · {l.area}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-border p-4">
          <h2 className="mb-2 font-semibold">{t("Today's viewings")}</h2>
          {data.viewingsToday.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("No viewings today.")}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {data.viewingsToday.map((v) => (
                <li key={v.id}>
                  {dubaiDate(v.starts_at)} · {v.leadName || t("Client")} (
                  {t(v.kind === "valuation" ? "Valuation" : "Viewing")})
                </li>
              ))}
            </ul>
          )}
        </div>
        <Link to="/follow-ups" className="rounded-lg border border-border p-4 hover:border-primary">
          <p className="text-2xl font-bold">{data.followUpsDue}</p>
          <p className="text-sm text-muted-foreground">{t("Follow-ups due for approval")}</p>
        </Link>
      </section>
    </div>
  );
}

function OwnerHome() {
  const { t } = useLang();
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
  if (!data) return <p className="text-sm text-muted-foreground">{t("Loading agency numbers…")}</p>;
  return (
    <div className="space-y-6">
      <NeedsYouToday problems={data.problems} missedLeadMinutes={data.missedLeadMinutes} />
      <section
        aria-label={t("This week")}
        className="rounded-xl border border-border bg-background p-4 shadow-xs"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">{t("This week")}</h2>
          <Button asChild variant="outline" size="sm">
            <Link to="/owner/weekly-report">{t("Monday report")}</Link>
          </Button>
        </div>
        {weekly && (
          <p className="mt-2 text-sm">
            {t(
              "{enquiries} enquiries · {hot} Hot leads · {booked} viewings booked · {deals} deals closed · {gci} GCI · {missed} missed alerts",
              {
                enquiries: weekly.report.enquiries,
                hot: weekly.report.hotLeads,
                booked: weekly.report.viewings.booked,
                deals: weekly.report.weekGci.deals,
                gci: aed(weekly.report.weekGci.gci),
                missed: weekly.report.missed,
              },
            )}
          </p>
        )}
        {weeklyError && (
          <p role="alert" className="text-sm text-destructive">
            {weeklyError.message}
          </p>
        )}
      </section>
      <section className="grid gap-4 sm:grid-cols-4">
        <Stat label={t("Total GCI this month")} value={aed(data.gci.month)} />
        <Stat label={t("Total GCI this year")} value={aed(data.gci.year)} />
        <Stat
          label={t("Agency share this year")}
          value={aed(data.gci.agencyYear)}
          note={t("This month: {amount}", { amount: aed(data.gci.agencyMonth) })}
        />
        <Stat
          label={t("Deals from AI-handled leads (this year)")}
          value={data.gci.aiHandledDeals}
          note={t("GCI: {amount}", { amount: aed(data.gci.aiHandledGciYear) })}
        />
      </section>
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label={t("Viewings kept (this month)")} value={data.viewingsMonth.kept} />
        <Stat
          label={t("No-shows (this month)")}
          value={data.viewingsMonth.noShows}
          note={t("{n} still booked", { n: data.viewingsMonth.booked })}
        />
        <Stat
          label={t("AI replies (this month)")}
          value={data.usageMonth.aiReplies}
          note={t("WhatsApp messages: {n}", { n: data.usageMonth.whatsappMessages })}
        />
        <Stat
          label={t("Hours saved (estimate)")}
          value={t("~{n} h", { n: data.hoursSavedEstimate })}
          note={t("Estimate: AI replies × {n} min each", { n: data.minutesPerReply })}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-background p-5 shadow-xs">
          <h2 className="mb-3 font-semibold">{t("GCI per agent")}</h2>
          {/* Phones: one stacked row per agent; the table stays from `md` up. */}
          <ul className="divide-y divide-border text-sm md:hidden">
            {data.perAgent.map((a) => (
              <li key={a.userId} className="py-2">
                <p className="truncate font-medium">{a.name}</p>
                <p className="mt-0.5 flex justify-between gap-3 text-xs text-muted-foreground">
                  <span>{t("This month")}</span>
                  <span className="text-sm text-foreground">{aed(a.month)}</span>
                </p>
                <p className="flex justify-between gap-3 text-xs text-muted-foreground">
                  <span>{t("This year")}</span>
                  <span className="text-sm text-foreground">{aed(a.year)}</span>
                </p>
              </li>
            ))}
          </ul>
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1">{t("Agent")}</th>
                <th>{t("This month")}</th>
                <th>{t("This year")}</th>
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
          <h2 className="mb-3 font-semibold">{t("Agent leaderboard")}</h2>
          <ol className="divide-y divide-border text-sm md:hidden">
            {data.leaderboard.map((r, i) => (
              <li key={r.userId} className="py-2">
                <p className="flex items-baseline gap-2">
                  <span className="w-5 shrink-0 text-muted-foreground">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
                  <span className="shrink-0">{aed(r.gciYear)}</span>
                </p>
                <p className="ps-7 text-xs text-muted-foreground">
                  {t("Avg reply")}:{" "}
                  {r.avgReplyMinutes === null ? "—" : t("{n} min", { n: r.avgReplyMinutes })} ·{" "}
                  {t("Viewings (30 days)")}: {r.viewings}
                </p>
              </li>
            ))}
          </ol>
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1">#</th>
                <th>{t("Agent")}</th>
                <th>{t("GCI (year)")}</th>
                <th>{t("Avg reply")}</th>
                <th>{t("Viewings (30 days)")}</th>
              </tr>
            </thead>
            <tbody>
              {data.leaderboard.map((r, i) => (
                <tr key={r.userId} className="border-t border-border">
                  <td className="py-1.5">{i + 1}</td>
                  <td>{r.name}</td>
                  <td>{aed(r.gciYear)}</td>
                  <td>
                    {r.avgReplyMinutes === null ? "—" : t("{n} min", { n: r.avgReplyMinutes })}
                  </td>
                  <td>{r.viewings}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("Ranked by GCI, then faster replies, then viewings.")}
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
  const { t } = useLang();
  const { data: pipeline } = useQuery({ queryKey: ["pipeline"], queryFn: () => getPipeline() });
  const overdue = (pipeline?.leads ?? []).filter((l) => isOverdue(l)).slice(0, 8);
  const total = overdue.length + problems.length;
  return (
    <section
      aria-label={t("Needs you today")}
      className="rounded-xl border border-border bg-background shadow-xs"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 className="font-semibold">{t("Needs you today")}</h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${total ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}
        >
          {t("{n} open", { n: total })}
        </span>
      </div>
      {total === 0 ? (
        <p className="px-5 py-4 text-sm text-muted-foreground">
          {t("Nothing waiting on you. Every lead has a next step on time.")}
        </p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {overdue.map((l) => (
            <li key={l.id}>
              <Link
                to="/lead/$leadId"
                params={{ leadId: l.id }}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 md:px-5 md:py-2.5"
              >
                <span className="size-2 shrink-0 rounded-full bg-destructive" aria-hidden />
                <span className="min-w-0 flex-1 truncate">
                  <strong className="font-medium">{l.name || t("Unnamed lead")}</strong> ·{" "}
                  {l.next_action || l.stage_name || t("Step {n}", { n: l.stage })}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {t("Overdue")} · {l.who || t("Agent")}
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
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 md:px-5 md:py-2.5"
                >
                  <span className="size-2 shrink-0 rounded-full bg-warning" aria-hidden />
                  <span className="min-w-0 flex-1 break-words">{p.text}</span>
                </Link>
              ) : (
                <p className="flex items-center gap-3 px-4 py-3.5 md:px-5 md:py-2.5">
                  <span className="size-2 shrink-0 rounded-full bg-warning" aria-hidden />
                  <span className="min-w-0 flex-1 break-words">{p.text}</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-border px-5 py-2 text-xs text-muted-foreground">
        {t(
          "Red = pipeline step past its due time. Amber = client waiting more than {n} min, or another problem.",
          { n: missedLeadMinutes },
        )}{" "}
        <Link to="/pipeline" className="underline">
          {t("Open the board")}
        </Link>
      </p>
    </section>
  );
}
