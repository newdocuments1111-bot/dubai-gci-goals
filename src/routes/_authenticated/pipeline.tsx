import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AlertTriangle, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadStepDialog } from "@/components/LeadStepDialog";
import { getPipeline, moveLead } from "@/lib/pipeline.functions";
import {
  STAGE_GROUPS,
  aed,
  isOverdue,
  isParked,
  minutes,
  ruleFor,
  totals,
  type Lead,
} from "@/lib/pipeline";
import { memberName } from "@/lib/agency";
import { useLang } from "@/hooks/use-lang";

export const pipelineQuery = queryOptions({ queryKey: ["pipeline"], queryFn: () => getPipeline() });

export const Route = createFileRoute("/_authenticated/pipeline")({
  head: () => ({
    meta: [
      { title: "Pipeline — Dubai AI GCI" },
      {
        name: "description",
        content: "Every lead in the 15 steps from first message to closed deal.",
      },
      { property: "og:title", content: "Pipeline — Dubai AI GCI" },
      {
        property: "og:description",
        content: "Where every lead sits, who acts next and what is overdue.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(pipelineQuery),
  component: PipelinePage,
});

const SCORE = {
  Hot: "bg-destructive/15 text-destructive",
  Warm: "bg-warning/15 text-warning-foreground",
  Cold: "bg-muted text-muted-foreground",
} as const;
const selectCls = "rounded-md border border-input bg-background px-2 py-1 text-sm";

function Stat({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${warn ? "border-destructive/60" : "border-border"}`}>
      <p className={`text-xl font-bold ${warn ? "text-destructive" : ""}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function PipelinePage() {
  const { t } = useLang();
  const { data } = useSuspenseQuery(pipelineQuery);
  const move = useServerFn(moveLead);
  const client = useQueryClient();
  const [tab, setTab] = useState<"board" | "parked" | "sources">("board");
  const [source, setSource] = useState("all");
  const [score, setScore] = useState("all");
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [error, setError] = useState("");

  const adById = useMemo(() => new Map(data.ads.map((a) => [a.id, a])), [data.ads]);
  const agentName = (id: string | null) =>
    memberName(
      data.members.find((m) => m.user_id === id) as
        { display_name: string; email: string } | undefined,
    );
  const filtered = data.leads.filter(
    (l) => (source === "all" || l.source === source) && (score === "all" || l.score === score),
  );
  const active = filtered.filter((l) => !isParked(l.outcome));
  const parked = filtered.filter((l) => isParked(l.outcome));
  const sum = totals(data.report);
  const sources = [...new Set(data.leads.map((l) => l.source))].sort();

  const drop = async (lead: Lead, stage: number) => {
    if (lead.stage === stage) return;
    setError("");
    try {
      await move({ data: { id: lead.id, stage } });
      await client.invalidateQueries({ queryKey: ["pipeline"] });
      client.invalidateQueries({ queryKey: ["leads"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Could not move the lead."));
    }
  };

  const card = (l: Lead) => {
    const overdue = isOverdue(l);
    const ad = l.ad_campaign_id ? adById.get(l.ad_campaign_id) : undefined;
    return (
      <div
        key={l.id}
        draggable
        onDragStart={(e) => e.dataTransfer.setData("text/plain", l.id)}
        onClick={() => setEditing(l)}
        className={`cursor-grab rounded-lg border bg-background p-2.5 text-sm shadow-sm hover:border-primary active:cursor-grabbing ${overdue ? "border-destructive/60" : "border-border"}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-semibold">{l.name || t("Unnamed lead")}</span>
          <span
            className={`rounded px-1.5 text-[10px] font-medium ${SCORE[l.score as keyof typeof SCORE] ?? SCORE.Cold}`}
          >
            {t(l.score)}
          </span>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {[l.area, l.budget, l.timing].filter(Boolean).join(" · ") || t("Nothing learned yet")}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {t("From:")} {ad?.name ?? l.source_detail ?? l.source}
          {data.access.isOwner && <> · {agentName(l.assigned_agent_id)}</>}
        </p>
        {l.next_action && (
          <p
            className={`mt-1 text-[11px] ${overdue ? "text-destructive" : "text-muted-foreground"}`}
          >
            {overdue && <AlertTriangle className="me-1 inline size-3" />}
            {l.next_action}
            {l.next_action_at && (
              <span className="ms-1">
                ·{" "}
                {new Date(l.next_action_at).toLocaleString("en-GB", {
                  timeZone: "Asia/Dubai",
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
            )}
          </p>
        )}
        <div className="mt-1 flex flex-wrap gap-1">
          {l.who && (
            <span className="rounded bg-muted px-1.5 text-[10px] uppercase text-muted-foreground">
              {l.who}
            </span>
          )}
          {l.track === "offplan" && (
            <span className="rounded bg-muted px-1.5 text-[10px] uppercase">off-plan</span>
          )}
          {l.flagged && (
            <span className="rounded bg-warning/15 px-1.5 text-[10px] text-warning-foreground">
              needs confirmation
            </span>
          )}
        </div>
      </div>
    );
  };

  const column = (stage: number) => {
    const items = active.filter((l) => l.stage === stage);
    const rule = ruleFor(data.rules, stage, "ready"),
      offplan = ruleFor(data.rules, stage, "offplan");
    return (
      <div
        key={stage}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(stage);
        }}
        onDragLeave={() => setDragOver(null)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(null);
          const l = data.leads.find((x) => x.id === e.dataTransfer.getData("text/plain"));
          if (l) void drop(l, stage);
        }}
        className={`flex min-h-[220px] min-w-0 flex-1 flex-col rounded-lg border p-2 ${dragOver === stage ? "border-primary bg-primary/5" : "border-border bg-muted/30"}`}
      >
        <div className="mb-2 flex items-start justify-between gap-1 px-1">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-muted-foreground">
              {t("STEP {n}", { n: stage })}
            </p>
            <p className="text-sm font-semibold leading-tight">{rule.name}</p>
            {offplan.name !== rule.name && (
              <p className="text-[10px] text-muted-foreground">
                {t("off-plan:")} {offplan.name}
              </p>
            )}
            <p className="text-[10px] uppercase text-muted-foreground">{rule.who}</p>
          </div>
          <span className="rounded-full bg-background px-2 text-xs font-semibold">
            {items.length}
          </span>
        </div>
        <div className="flex flex-col gap-2">{items.map(card)}</div>
      </div>
    );
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">{t("Board")}</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/ads">
              <Megaphone className="size-4" />
              {t("Ads")}
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/owner/weekly-report">{t("Monday report")}</Link>
          </Button>
        </div>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        {t(
          "Every lead in the 15 steps of the plan. Leads move forward by themselves when the AI replies, a viewing is booked or done, a follow-up is sent or a deal is recorded. Drag a card to move it by hand; click it to edit.",
        )}
      </p>

      <section className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <Stat label={t("Leads")} value={sum.leads} />
        <Stat label={t("Replied")} value={`${sum.repliedPct}%`} />
        <Stat label={t("Avg first reply")} value={minutes(sum.avgReplyMinutes)} />
        <Stat label={t("Nights & weekends")} value={sum.outOfHours} />
        <Stat label={t("Qualified")} value={sum.qualified} />
        <Stat label={t("Viewings booked")} value={sum.booked} />
        <Stat label={t("Attended")} value={sum.attended} />
        <Stat label={t("Overdue")} value={sum.overdue} warn={sum.overdue > 0} />
      </section>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-border p-0.5">
          {(
            [
              ["board", t("Board ({n})", { n: active.length })],
              ["parked", t("Not now / Lost ({n})", { n: parked.length })],
              ["sources", t("By source ({n})", { n: data.report.length })],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`rounded px-3 py-1 text-sm ${tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          aria-label={t("Source")}
          className={selectCls}
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          <option value="all">{t("All sources")}</option>
          {sources.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label={t("Score")}
          className={selectCls}
          value={score}
          onChange={(e) => setScore(e.target.value)}
        >
          <option value="all">{t("Hot, Warm and Cold")}</option>
          {["Hot", "Warm", "Cold"].map((s) => (
            <option key={s} value={s}>
              {t(s)}
            </option>
          ))}
        </select>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      {tab === "board" && (
        <div className="grid gap-4">
          {STAGE_GROUPS.map((g) => (
            <div key={g.title}>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {t(g.title)}
              </p>
              <div className="-mx-4 overflow-x-auto px-4">
                <div className="flex min-w-[1000px] gap-2">{g.stages.map(column)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "parked" &&
        (parked.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {t("No leads marked not now or lost.")}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {parked.map((l) => (
              <div key={l.id}>
                <p className="mb-1 text-xs text-muted-foreground">
                  <span className="font-semibold uppercase">
                    {t(l.outcome === "not_now" ? "Not now" : "Lost")}
                  </span>{" "}
                  · {t("was at step {n}.", { n: l.stage })}{" "}
                  {ruleFor(data.rules, l.stage, l.track).name}
                  {l.lost_reason ? ` · ${l.lost_reason}` : ""}
                </p>
                {card(l)}
              </div>
            ))}
          </div>
        ))}

      {tab === "sources" && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="p-2">{t("Source")}</th>
                <th>{t("Leads")}</th>
                <th>{t("Replied")}</th>
                <th>{t("Reply time")}</th>
                <th>{t("Nights/weekends")}</th>
                <th>{t("Qualified")}</th>
                <th>{t("Booked")}</th>
                <th>{t("Attended")}</th>
                <th>{t("Won")}</th>
                <th>{t("Spend")}</th>
                <th>{t("Cost / viewing")}</th>
                <th>{t("Overdue")}</th>
              </tr>
            </thead>
            <tbody>
              {[...data.report]
                .sort((a, b) => Number(b.leads ?? 0) - Number(a.leads ?? 0))
                .map((r) => (
                  <tr key={`${r.source}-${r.source_type}`} className="border-t border-border">
                    <td className="p-2 font-medium">{r.source}</td>
                    <td>{r.leads}</td>
                    <td>{r.replied_pct}%</td>
                    <td>{minutes(r.avg_first_reply_minutes)}</td>
                    <td>{r.leads_out_of_hours}</td>
                    <td>{r.qualified}</td>
                    <td>{r.viewings_booked}</td>
                    <td>{r.viewings_attended}</td>
                    <td>{r.won}</td>
                    <td>{r.spend == null ? "—" : aed(r.spend)}</td>
                    <td>
                      {r.cost_per_attended_viewing == null ? "—" : aed(r.cost_per_attended_viewing)}
                    </td>
                    <td className={Number(r.overdue) > 0 ? "text-destructive" : ""}>{r.overdue}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p className="p-2 text-xs text-muted-foreground">
            {t(
              "Reply time runs from the enquiry arriving to the first AI or agent message. Cost per viewing = that ad's spend ÷ attended viewings from it. Across all ads: {spend} spent, {each} per attended viewing.",
              { spend: aed(sum.spend), each: aed(sum.costPerViewing) },
            )}
          </p>
        </div>
      )}

      {editing && (
        <LeadStepDialog
          lead={editing}
          rules={data.rules}
          ads={data.ads}
          members={data.members}
          isOwner={data.access.isOwner}
          onClose={() => setEditing(null)}
        />
      )}
    </main>
  );
}
