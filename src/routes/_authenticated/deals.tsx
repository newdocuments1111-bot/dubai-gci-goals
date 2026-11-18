import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { FileText } from "lucide-react";
import { listDeals, setDealStatus } from "@/lib/deals.functions";
import { PaperworkDialog } from "@/components/PaperworkDialog";
import { Button } from "@/components/ui/button";
import { useLang } from "@/hooks/use-lang";

export const dealsQuery = queryOptions({ queryKey: ["deals"], queryFn: () => listDeals() });
const aed = (n: number) => `AED ${Math.round(n).toLocaleString("en-US")}`;

export const Route = createFileRoute("/_authenticated/deals")({
  head: () => ({
    meta: [
      { title: "Deals — Dubai AI GCI" },
      { name: "description", content: "Deals with GCI, agent share and agency share." },
      { property: "og:title", content: "Deals — Dubai AI GCI" },
      { property: "og:description", content: "Track deals and commission for your agency." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(dealsQuery),
  component: DealsPage,
});

function DealsPage() {
  const { t } = useLang();
  const { data } = useSuspenseQuery(dealsQuery);
  const setStatus = useServerFn(setDealStatus);
  const client = useQueryClient();
  const [paperwork, setPaperwork] = useState<string | null>(null);
  const [error, setError] = useState("");
  const closed = data.deals.filter((d) => d.status === "closed");
  // One handler for the desktop table and the phone cards.
  const changeStatus = async (id: string, status: string) => {
    setError("");
    try {
      await setStatus({ data: { id, status: status as "closed" } });
      await client.invalidateQueries({ queryKey: dealsQuery.queryKey });
      client.invalidateQueries({ queryKey: ["home"] });
    } catch {
      setError(t("Only the deal’s agent or the owner can change it."));
    }
  };
  const STATUSES = ["under offer", "closed", "fell through"] as const;
  const statusLabel = (s: (typeof STATUSES)[number]) =>
    t(s === "under offer" ? "Under offer" : s === "closed" ? "Closed" : "Fell through");
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="mb-2 text-2xl font-bold md:text-3xl">{t("Deals")}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {t(
          "GCI = price × commission %. Agent share = GCI × the agent's split %. Agency share = GCI − agent share. Turn a lead into a deal from its lead page.",
        )}
      </p>
      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-4">
          <p className="text-2xl font-bold">{aed(closed.reduce((a, d) => a + d.gci, 0))}</p>
          <p className="text-sm text-muted-foreground">{t("Closed GCI (all time)")}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-2xl font-bold">{aed(closed.reduce((a, d) => a + d.agentShare, 0))}</p>
          <p className="text-sm text-muted-foreground">{t("Agent share")}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-2xl font-bold">{aed(closed.reduce((a, d) => a + d.agencyShare, 0))}</p>
          <p className="text-sm text-muted-foreground">{t("Agency share")}</p>
        </div>
      </section>
      {error && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {data.deals.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t("No deals yet. Open a lead and choose “Turn into a deal”.")}
        </p>
      ) : (
        <>
          {/* Phones: one card per deal. The full table stays from `md` up. */}
          <ul className="space-y-3 md:hidden">
            {data.deals.map((d) => (
              <li key={d.id} className="rounded-lg border border-border p-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-semibold">
                      {d.lead_id ? (
                        <Link
                          className="underline"
                          to="/lead/$leadId"
                          params={{ leadId: d.lead_id }}
                        >
                          {(d.leads as { name: string } | null)?.name || t("Lead")}
                        </Link>
                      ) : (
                        "—"
                      )}
                      {d.ai_handled && (
                        <span className="ms-1 rounded bg-primary/10 px-1.5 text-xs font-normal text-primary">
                          {t("AI-handled")}
                        </span>
                      )}
                    </p>
                    {d.listings && (
                      <p className="truncate text-xs text-muted-foreground">
                        {(d.listings as { title: string }).title}
                      </p>
                    )}
                    <p className="truncate text-xs text-muted-foreground">
                      {t(d.deal_type === "rent" ? "Rent" : "Sale")} · {d.agentName}
                    </p>
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="font-semibold">{aed(d.gci)}</p>
                    <p className="text-xs text-muted-foreground">{t("GCI")}</p>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">{t("Price")}</dt>
                  <dd className="text-end text-sm">
                    {aed(d.price_aed)}{" "}
                    <span className="text-xs text-muted-foreground">({d.commission_percent}%)</span>
                  </dd>
                  <dt className="text-muted-foreground">{t("Agent share")}</dt>
                  <dd className="text-end text-sm">
                    {aed(d.agentShare)}{" "}
                    <span className="text-xs text-muted-foreground">({d.splitPercent}%)</span>
                  </dd>
                  <dt className="text-muted-foreground">{t("Agency share")}</dt>
                  <dd className="text-end text-sm">{aed(d.agencyShare)}</dd>
                  <dt className="text-muted-foreground">{t("Next step")}</dt>
                  <dd className="min-w-0 break-words text-end">
                    {d.nextStep ? (
                      <>
                        <span className="font-medium">{d.nextStep.label}</span>
                        {d.nextStep.due_at && (
                          <span
                            className={
                              new Date(d.nextStep.due_at) < new Date()
                                ? "block text-destructive"
                                : "block text-muted-foreground"
                            }
                          >
                            {t("due {date}", {
                              date: new Date(d.nextStep.due_at).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                                timeZone: "Asia/Dubai",
                              }),
                            })}
                          </span>
                        )}
                      </>
                    ) : d.stepsTotal > 0 ? (
                      <span className="text-primary">{t("All steps done")}</span>
                    ) : (
                      <span className="text-muted-foreground">{t("Open the Deal Room")}</span>
                    )}
                  </dd>
                </dl>
                <div className="mt-3 flex items-center gap-2">
                  <select
                    aria-label={t("Deal status")}
                    className="h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                    value={d.status}
                    onChange={(e) => void changeStatus(d.id, e.target.value)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {statusLabel(s)}
                      </option>
                    ))}
                  </select>
                  {d.closed_at && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(d.closed_at).toLocaleDateString("en-GB", {
                        timeZone: "Asia/Dubai",
                      })}
                    </span>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button asChild variant="outline" className="h-11">
                    <Link to="/deal/$dealId" params={{ dealId: d.id }}>
                      {t("Deal Room")}
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-11" onClick={() => setPaperwork(d.id)}>
                    <FileText className="size-4" />
                    {t("Paperwork")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="p-2">{t("Client")}</th>
                  <th>{t("Agent")}</th>
                  <th>{t("Type")}</th>
                  <th>{t("Price")}</th>
                  <th>{t("Comm.")}</th>
                  <th>{t("GCI")}</th>
                  <th>{t("Agent share")}</th>
                  <th>{t("Agency share")}</th>
                  <th>{t("Next step")}</th>
                  <th>{t("Status")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.deals.map((d) => (
                  <tr key={d.id} className="border-t border-border">
                    <td className="p-2">
                      {d.lead_id ? (
                        <Link
                          className="underline"
                          to="/lead/$leadId"
                          params={{ leadId: d.lead_id }}
                        >
                          {(d.leads as { name: string } | null)?.name || t("Lead")}
                        </Link>
                      ) : (
                        "—"
                      )}
                      {d.ai_handled && (
                        <span className="ms-1 rounded bg-primary/10 px-1.5 text-xs text-primary">
                          {t("AI-handled")}
                        </span>
                      )}
                      {d.listings && (
                        <div className="text-xs text-muted-foreground">
                          {(d.listings as { title: string }).title}
                        </div>
                      )}
                    </td>
                    <td>{d.agentName}</td>
                    <td>{t(d.deal_type === "rent" ? "Rent" : "Sale")}</td>
                    <td>{aed(d.price_aed)}</td>
                    <td>{d.commission_percent}%</td>
                    <td className="font-medium">{aed(d.gci)}</td>
                    <td>
                      {aed(d.agentShare)}{" "}
                      <span className="text-xs text-muted-foreground">({d.splitPercent}%)</span>
                    </td>
                    <td>{aed(d.agencyShare)}</td>
                    <td className="pe-2 text-xs">
                      {d.nextStep ? (
                        <>
                          <span className="font-medium">{d.nextStep.label}</span>
                          {d.nextStep.due_at && (
                            <span
                              className={
                                new Date(d.nextStep.due_at) < new Date()
                                  ? "block text-destructive"
                                  : "block text-muted-foreground"
                              }
                            >
                              {t("due {date}", {
                                date: new Date(d.nextStep.due_at).toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                  timeZone: "Asia/Dubai",
                                }),
                              })}
                            </span>
                          )}
                        </>
                      ) : d.stepsTotal > 0 ? (
                        <span className="text-primary">{t("All steps done")}</span>
                      ) : (
                        <span className="text-muted-foreground">{t("Open the Deal Room")}</span>
                      )}
                    </td>
                    <td>
                      <select
                        aria-label={t("Deal status")}
                        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                        value={d.status}
                        onChange={(e) => void changeStatus(d.id, e.target.value)}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {statusLabel(s)}
                          </option>
                        ))}
                      </select>
                      {d.closed_at && (
                        <div className="text-xs text-muted-foreground">
                          {new Date(d.closed_at).toLocaleDateString("en-GB", {
                            timeZone: "Asia/Dubai",
                          })}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap pe-2">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/deal/$dealId" params={{ dealId: d.id }}>
                          {t("Deal Room")}
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setPaperwork(d.id)}>
                        <FileText className="size-4" />
                        {t("Paperwork")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {paperwork && <PaperworkDialog dealId={paperwork} onClose={() => setPaperwork(null)} />}
    </main>
  );
}
