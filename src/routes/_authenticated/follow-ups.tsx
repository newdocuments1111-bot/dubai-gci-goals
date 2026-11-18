import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  approveFollowUp,
  cancelFollowUp,
  listFollowUps,
  draftOldLeadRevivals,
} from "@/lib/followups.functions";
import { dubaiDate } from "@/lib/listings";
import { useLang } from "@/hooks/use-lang";

const followUpsQuery = queryOptions({ queryKey: ["follow-ups"], queryFn: () => listFollowUps() });

export const Route = createFileRoute("/_authenticated/follow-ups")({
  head: () => ({
    meta: [
      { title: "Follow-ups — Dubai AI GCI" },
      { name: "description", content: "AI-drafted messages waiting for your approval." },
      { property: "og:title", content: "Follow-ups — Dubai AI GCI" },
      { property: "og:description", content: "Owner-approved follow-up messages." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(followUpsQuery),
  component: FollowUpsPage,
});

const KIND_LABELS: Record<string, string> = {
  nurture: "Not-now check-in",
  "follow-up": "Follow-up",
  viewing_followup: "After-viewing check-in",
  viewing_2day: "After-viewing: 2-day check-in",
  "payment-reminder": "Payment reminder",
  "milestone-update": "Milestone update",
  "value-update": "Value update",
  anniversary: "Home anniversary",
  "lease-reminder": "Lease reminder",
  revival: "Old lead check-in",
};

function FollowUpsPage() {
  const { t } = useLang();
  const { data: items } = useSuspenseQuery(followUpsQuery);
  const client = useQueryClient();
  const approve = useServerFn(approveFollowUp),
    cancel = useServerFn(cancelFollowUp),
    revive = useServerFn(draftOldLeadRevivals);
  const [revivalNote, setRevivalNote] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const refresh = () => client.invalidateQueries({ queryKey: followUpsQuery.queryKey });
  const pending = items.filter((i) => i.status === "pending");
  const done = items.filter((i) => i.status !== "pending");

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-2 text-2xl font-bold md:text-3xl">{t("Follow-ups")}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {t(
          "The AI drafts; you approve. Nothing is sent without your approval. Approved messages appear in the lead's conversation marked Sent.",
        )}
      </p>
      <Button
        variant="outline"
        className="mb-4 h-11 w-full md:h-9 md:w-auto"
        disabled={Boolean(busy)}
        onClick={async () => {
          setBusy("revival");
          setError("");
          setRevivalNote("");
          try {
            const result = await revive();
            setRevivalNote(
              t(
                "{n} new check-in drafts. Only clients who agreed to contact and have been inactive for over 30 days are included.",
                { n: result.count },
              ),
            );
            await refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : t("Could not draft check-ins."));
          } finally {
            setBusy("");
          }
        }}
      >
        <RefreshCw className="size-4" />
        {t("Draft old-lead check-ins")}
      </Button>
      {revivalNote && (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          {revivalNote}
        </p>
      )}
      {pending.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("Nothing waiting for approval.")}</p>
      )}
      <div className="space-y-4">
        {pending.map((item) => (
          <article key={item.id} className="rounded-lg border border-border p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded bg-muted px-2 py-0.5">
                {t(KIND_LABELS[item.kind] ?? item.kind)}
              </span>
              <span className="min-w-0 break-words text-sm font-medium text-foreground md:text-xs md:font-normal md:text-muted-foreground">
                {(item.leads as { name?: string } | null)?.name ?? t("No lead")}
              </span>
              <span>{dubaiDate(item.created_at)}</span>
            </div>
            <textarea
              aria-label={t("Draft message")}
              className="min-h-28 w-full resize-y md:min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
              maxLength={10000}
              value={drafts[item.id] ?? item.draft}
              onChange={(e) => setDrafts((d) => ({ ...d, [item.id]: e.target.value }))}
            />
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                className="h-11 flex-1 md:h-8 md:flex-none"
                disabled={busy === item.id}
                onClick={async () => {
                  setBusy(item.id);
                  setError("");
                  try {
                    await approve({ data: { id: item.id, draft: drafts[item.id] ?? item.draft } });
                    refresh();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : t("Could not send."));
                  } finally {
                    setBusy("");
                  }
                }}
              >
                <Check className="size-4" />
                {t("Approve and send")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-11 border border-input md:h-8 md:border-0"
                disabled={busy === item.id}
                onClick={async () => {
                  setBusy(item.id);
                  await cancel({ data: item.id });
                  setBusy("");
                  refresh();
                }}
              >
                <X className="size-4" />
                {t("Cancel")}
              </Button>
            </div>
          </article>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {done.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 font-semibold">{t("History")}</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {done.map((item) => (
              <li key={item.id} className="break-words rounded border border-border p-3">
                <span className="me-2 rounded bg-muted px-2 py-0.5 text-xs">
                  {t(
                    item.status === "sent"
                      ? "Sent"
                      : item.status === "cancelled"
                        ? "Cancelled"
                        : item.status,
                  )}
                </span>
                {item.draft.slice(0, 120)}
                {item.draft.length > 120 ? "…" : ""}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
