import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getReplySpeed } from "@/lib/replyspeed.functions";
import {
  DEAL_WINDOW_DAYS,
  REPLY_LIMIT_MINUTES,
  REPLY_RATE_TARGET_PERCENT,
  minutesText,
} from "@/lib/replyspeed";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const replySpeedQuery = queryOptions({
  queryKey: ["reply-speed"],
  queryFn: () => getReplySpeed(),
});

export const Route = createFileRoute("/_authenticated/reply-speed")({
  head: () => ({
    meta: [
      { title: "Reply speed — Dubai AI GCI" },
      {
        name: "description",
        content: "How fast each agent replies to new leads, against the SuperAgent rules.",
      },
      { property: "og:title", content: "Reply speed — Dubai AI GCI" },
      { property: "og:description", content: "Reply speed per agent." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(replySpeedQuery),
  component: ReplySpeedPage,
});

const head = "text-start";
const limitHours = REPLY_LIMIT_MINUTES / 60;

function ReplySpeedPage() {
  const { data } = useSuspenseQuery(replySpeedQuery);
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="mb-2 text-3xl font-bold">Reply speed</h1>
      <p className="mb-2 text-sm text-muted-foreground">
        These are Property Finder's published SuperAgent rules measured on the CRM's own leads. The
        badge itself is decided by Property Finder.
      </p>
      <p className="mb-6 text-sm text-muted-foreground">
        Leads from the last {data.periodDays} days (imported leads left out). Rules: first reply
        within {limitHours} hours, at least {REPLY_RATE_TARGET_PERCENT}% of leads replied to in
        time, and a closed deal in the last {DEAL_WINDOW_DAYS} days. "First reply" is the first
        reply the CRM recorded on the lead, by the AI assistant or a person, whichever came first.
      </p>
      {data.truncated && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          There are more leads in this period than this page can read, so the numbers below are
          incomplete.
        </p>
      )}

      <section aria-label="Agents" className="mb-6 rounded-lg border border-border p-4">
        <h2 className="mb-3 font-semibold">
          {data.scope === "agency" ? "Agents" : data.scope === "team" ? "Your team" : "You"}
        </h2>
        {data.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No agents to show.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={head}>Agent</TableHead>
                <TableHead className={head}>Leads</TableHead>
                <TableHead className={head}>Typical first reply (AI or agent)</TableHead>
                <TableHead className={head}>Replied within {limitHours} hours</TableHead>
                <TableHead className={head}>Last deal</TableHead>
                <TableHead className={head}>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r) => (
                <TableRow key={r.userId}>
                  <TableCell className="font-medium">
                    {r.name}
                    {r.isMe && <span className="ms-1 text-xs text-muted-foreground">(you)</span>}
                  </TableCell>
                  <TableCell className="tabular-nums">{r.leads}</TableCell>
                  <TableCell className="tabular-nums">
                    {r.medianReplyMinutes === null ? "—" : minutesText(r.medianReplyMinutes)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {r.repliedInTimePercent === null ? (
                      "—"
                    ) : (
                      <>
                        {Math.floor(r.repliedInTimePercent)}%
                        <span className="ms-1 text-xs text-muted-foreground">
                          ({r.repliedInTime} of {r.repliedInTime + r.missed})
                        </span>
                      </>
                    )}
                    {r.stillInTime > 0 && (
                      <span className="ms-1 text-xs text-muted-foreground">
                        · {r.stillInTime} still in time
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {r.daysSinceLastDeal === null
                      ? "No closed deal"
                      : r.daysSinceLastDeal === 0
                        ? "Today"
                        : `${r.daysSinceLastDeal} ${r.daysSinceLastDeal === 1 ? "day" : "days"} ago`}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === "on track" ? "secondary" : "destructive"}>
                      {r.status === "on track" ? "On track" : "At risk"}
                    </Badge>
                    {r.reasons.length > 0 && (
                      <ul className="mt-1 text-xs text-muted-foreground">
                        {r.reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section aria-label="Waiting now" className="rounded-lg border border-border p-4">
        <h2 className="mb-1 font-semibold">Waiting now</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Open leads with no first reply yet, least time left first.
        </p>
        {data.waiting.length === 0 ? (
          <p className="text-sm text-muted-foreground">No lead is waiting for a first reply.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.waiting.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <Link
                  to="/lead/$leadId"
                  params={{ leadId: w.id }}
                  className="font-medium underline"
                >
                  {w.name}
                </Link>
                <span className="text-muted-foreground">
                  {[w.source, w.agentName].filter(Boolean).join(" · ")}
                </span>
                <span className="ms-auto tabular-nums text-muted-foreground">
                  Waited {minutesText(w.minutesWaited)}
                </span>
                <Badge variant={w.overdue ? "destructive" : "outline"} className="tabular-nums">
                  {w.overdue
                    ? `${minutesText(-w.minutesLeft)} over the limit`
                    : `${minutesText(w.minutesLeft)} left`}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        {data.waitingTotal > data.waiting.length && (
          <p className="mt-3 text-xs text-muted-foreground">
            Showing the {data.waiting.length} most urgent of {data.waitingTotal} waiting leads.
          </p>
        )}
      </section>
    </main>
  );
}
