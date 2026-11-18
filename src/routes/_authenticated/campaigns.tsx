import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Plus, Send, Trash2 } from "lucide-react";
import {
  cancelCampaign,
  getCampaigns,
  previewCampaign,
  startCampaign,
} from "@/lib/campaigns.functions";
import {
  MAX_CAMPAIGN_LEADS,
  MAX_STEPS,
  audienceOptions,
  campaignProblems,
  type CampaignStep,
} from "@/lib/campaigns";
import { templateTokens } from "@/lib/whatsapp-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const campaignsQuery = queryOptions({
  queryKey: ["campaigns"],
  queryFn: () => getCampaigns(),
});

export const Route = createFileRoute("/_authenticated/campaigns")({
  head: () => ({
    meta: [{ title: "Campaigns — Dubai AI GCI" }, { name: "robots", content: "noindex" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(campaignsQuery),
  component: CampaignsPage,
});

type Preview = Awaited<ReturnType<typeof previewCampaign>>;
const selectClass =
  "mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const when = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", dateStyle: "medium" }).format(
    new Date(iso),
  );

function CampaignsPage() {
  const { data } = useSuspenseQuery(campaignsQuery);
  const client = useQueryClient();
  const preview = useServerFn(previewCampaign);
  const start = useServerFn(startCampaign);
  const cancel = useServerFn(cancelCampaign);

  const audiences = useMemo(() => audienceOptions(data.lists), [data.lists]);
  const [audienceKey, setAudienceKey] = useState("open");
  const [name, setName] = useState("");
  const [steps, setSteps] = useState<CampaignStep[]>([
    { templateId: data.templates[0]?.id ?? "", afterDays: 0 },
  ]);
  const [defaults, setDefaults] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Preview | null>(null);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const audience = audiences.find((a) => a.key === audienceKey) ?? audiences[0]!;
  const problems = campaignProblems(steps, data.templates, data.gapDays);
  // Blanks the owner types once; the client's own name and area are filled in for each lead.
  const blanks = [
    ...new Set(
      steps.flatMap((s) =>
        templateTokens(data.templates.find((t) => t.id === s.templateId)?.body ?? ""),
      ),
    ),
  ];
  const input = () => ({
    name: name.trim() || `${audience.label} · ${when(new Date().toISOString())}`,
    audienceLabel: audience.label,
    filter: audience.filter,
    steps,
    defaults,
  });
  const changed = () => {
    setChecked(null);
    setNote(null);
  };
  const setStep = (i: number, patch: Partial<CampaignStep>) => {
    setSteps(steps.map((s, k) => (k === i ? { ...s, ...patch } : s)));
    changed();
  };
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setNote(null);
    try {
      await fn();
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : "Something went wrong." });
    } finally {
      setBusy("");
    }
  };

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Send one approved WhatsApp message to a list of clients, with up to two follow-ups days
          later. Only clients with recorded consent get it, never anyone who replied STOP, and a
          follow-up is dropped once the client writes back.
        </p>
      </div>

      {!data.whatsappReady ? (
        <p className="rounded-xl border border-border bg-background p-5 text-sm">
          WhatsApp is not connected yet. Set it up in{" "}
          <Link to="/settings/whatsapp" className="font-medium underline">
            Settings › WhatsApp
          </Link>{" "}
          first.
        </p>
      ) : !data.templates.length ? (
        <p className="rounded-xl border border-border bg-background p-5 text-sm">
          You need at least one template approved by Meta. Write one in{" "}
          <Link to="/templates" className="font-medium underline">
            Settings › Templates
          </Link>{" "}
          and send it for review.
        </p>
      ) : (
        <section className="space-y-5 rounded-xl border border-border bg-background p-5">
          <h2 className="text-lg font-semibold">New campaign</h2>
          {data.testMode && (
            <p className="rounded-md bg-secondary px-3 py-2 text-sm">
              WhatsApp test mode is on: only numbers on your safety list will receive messages.
              Everyone else will show as blocked in the send queue.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              Send to
              <select
                className={selectClass}
                value={audienceKey}
                onChange={(e) => {
                  setAudienceKey(e.target.value);
                  changed();
                }}
              >
                {audiences.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">
                Save a filter on Leads › List to see it here.
              </span>
            </label>
            <label className="text-sm">
              Campaign name (only you see it)
              <Input
                className="mt-1 h-9"
                maxLength={100}
                placeholder="e.g. Marina launch, November"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          </div>

          <div className="space-y-3">
            {steps.map((s, i) => (
              <div key={i} className="grid items-end gap-3 sm:grid-cols-[1fr_180px_auto]">
                <label className="text-sm">
                  Message {i + 1}
                  <select
                    className={selectClass}
                    value={s.templateId}
                    onChange={(e) => setStep(i, { templateId: e.target.value })}
                  >
                    {data.templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label} ({t.category})
                      </option>
                    ))}
                  </select>
                </label>
                {i === 0 ? (
                  <p className="pb-2 text-sm text-muted-foreground">Sent now</p>
                ) : (
                  <label className="text-sm">
                    Days after the first
                    <Input
                      className="mt-1 h-9"
                      type="number"
                      min={1}
                      max={90}
                      value={s.afterDays}
                      onChange={(e) =>
                        setStep(i, {
                          afterDays: Math.max(0, Math.min(90, Number(e.target.value) || 0)),
                        })
                      }
                    />
                  </label>
                )}
                {i > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove message ${i + 1}`}
                    onClick={() => {
                      setSteps(steps.filter((_, k) => k !== i));
                      changed();
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : (
                  <span />
                )}
              </div>
            ))}
            {steps.length < MAX_STEPS && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const last = steps[steps.length - 1]!;
                  setSteps([
                    ...steps,
                    { templateId: last.templateId, afterDays: last.afterDays + data.gapDays },
                  ]);
                  changed();
                }}
              >
                <Plus className="size-4" />
                Add a follow-up if they don't reply
              </Button>
            )}
          </div>

          {blanks.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {blanks.map((b) => (
                <label key={b} className="text-sm">
                  {b === "name"
                    ? "Name, when a lead has none"
                    : b === "area"
                      ? "Area, when a lead has none"
                      : `Text for {{${b}}}`}
                  <Input
                    className="mt-1 h-9"
                    maxLength={200}
                    placeholder={b === "name" ? "e.g. there" : ""}
                    value={defaults[b] ?? ""}
                    onChange={(e) => {
                      setDefaults({ ...defaults, [b]: e.target.value });
                      changed();
                    }}
                  />
                </label>
              ))}
            </div>
          )}

          {problems.length > 0 && (
            <ul role="alert" className="list-disc space-y-1 ps-5 text-sm text-destructive">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}

          {checked && (
            <div className="space-y-2 rounded-md border border-border p-4 text-sm">
              <p>
                <span className="text-lg font-semibold">{checked.willGet}</span> of{" "}
                {checked.matching} clients on this list will get it.
              </p>
              <ul className="space-y-0.5 text-muted-foreground">
                {checked.skipped.noConsent > 0 && (
                  <li>{checked.skipped.noConsent} left out: no recorded consent</li>
                )}
                {checked.skipped.stopped > 0 && (
                  <li>{checked.skipped.stopped} left out: replied STOP</li>
                )}
                {checked.skipped.noNumber > 0 && (
                  <li>{checked.skipped.noNumber} left out: no WhatsApp number</li>
                )}
                {checked.skipped.missingDetails > 0 && (
                  <li>
                    {checked.skipped.missingDetails} left out: a blank would be empty (fill the
                    fields above)
                  </li>
                )}
                {checked.skipped.overLimit > 0 && (
                  <li>
                    {checked.skipped.overLimit} left out: one campaign reaches at most{" "}
                    {MAX_CAMPAIGN_LEADS} clients
                  </li>
                )}
              </ul>
              {checked.example && (
                <p className="whitespace-pre-line rounded-md bg-secondary p-3">{checked.example}</p>
              )}
            </div>
          )}

          {note && (
            <p
              role={note.ok ? "status" : "alert"}
              className={`text-sm ${note.ok ? "text-primary" : "text-destructive"}`}
            >
              {note.text}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!!busy || problems.length > 0}
              onClick={() =>
                run("check", async () => {
                  setChecked(await preview({ data: input() }));
                })
              }
            >
              Check who gets it
            </Button>
            {checked && checked.willGet > 0 && checked.problems.length === 0 && (
              <Button
                type="button"
                disabled={!!busy}
                onClick={() =>
                  run("send", async () => {
                    const r = await start({ data: input() });
                    if ("error" in r && r.error) {
                      setNote({ ok: false, text: r.error });
                      return;
                    }
                    setChecked(null);
                    setName("");
                    await client.invalidateQueries({ queryKey: ["campaigns"] });
                    await client.invalidateQueries({ queryKey: ["queue"] });
                    setNote({
                      ok: true,
                      text: `Started. ${"queued" in r ? r.queued : 0} clients are in the send queue; sending begins within 5 minutes, between 9am and 8pm Dubai time.`,
                    });
                  })
                }
              >
                <Send className="size-4" />
                Send to {checked.willGet} clients
              </Button>
            )}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Past campaigns</h2>
        {!data.campaigns.length ? (
          <p className="text-sm text-muted-foreground">No campaigns yet.</p>
        ) : (
          <ul className="space-y-3">
            {data.campaigns.map((c) => {
              const stepList = (c.steps as { afterDays: number; label?: string }[]) ?? [];
              return (
                <li key={c.id} className="rounded-xl border border-border bg-background p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {when(c.created_at)} · {c.audience} · {c.lead_count} clients
                        {c.skipped_count > 0 && ` · ${c.skipped_count} left out`}
                        {c.status === "cancelled" && " · Stopped"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {stepList
                          .map((s) =>
                            s.afterDays ? `${s.label} after ${s.afterDays} days` : `${s.label} now`,
                          )
                          .join(" → ")}
                      </p>
                    </div>
                    {c.counts.waiting > 0 && c.status !== "cancelled" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!!busy}
                        onClick={() =>
                          run(c.id, async () => {
                            const r = await cancel({ data: c.id });
                            await client.invalidateQueries({ queryKey: ["campaigns"] });
                            setNote({
                              ok: true,
                              text: `Stopped. ${r.cancelled} unsent messages were cancelled.`,
                            });
                          })
                        }
                      >
                        Stop
                      </Button>
                    )}
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
                    {(
                      [
                        ["Sent", c.counts.sent],
                        ["Waiting", c.counts.waiting],
                        ["Blocked", c.counts.blocked],
                        ["Failed", c.counts.failed],
                        ["Cancelled", c.counts.cancelled],
                      ] as const
                    ).map(([label, n]) => (
                      <div key={label} className="rounded-md bg-secondary px-3 py-2">
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="font-semibold">{n}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-sm text-muted-foreground">
          Every message and the reason for any block is in the{" "}
          <Link to="/queue" className="underline">
            send queue
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
