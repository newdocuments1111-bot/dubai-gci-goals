import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { deleteAd, saveAd } from "@/lib/pipeline.functions";
import {
  AD_PLATFORMS,
  AD_STATUSES,
  BUYER_TYPES,
  adDecisions,
  aed,
  minutes,
  rankAds,
  type AdCampaign,
} from "@/lib/pipeline";
import { pipelineQuery } from "./pipeline";

export const Route = createFileRoute("/_authenticated/ads")({
  head: () => ({
    meta: [
      { title: "Ads — Dubai AI GCI" },
      {
        name: "description",
        content:
          "Each ad campaign with its spend and the leads, viewings and cost per viewing it produced.",
      },
      { property: "og:title", content: "Ads — Dubai AI GCI" },
      { property: "og:description", content: "Which ads bring viewings, and the day-14 decision." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(pipelineQuery),
  component: AdsPage,
});

const selectCls = "mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-sm";
const STATUS = {
  winner: "bg-primary/15 text-primary",
  testing: "bg-warning/15 text-warning-foreground",
  stopped: "bg-muted text-muted-foreground",
  draft: "bg-muted text-muted-foreground",
} as const;

function AdsPage() {
  const { data } = useSuspenseQuery(pipelineQuery);
  const remove = useServerFn(deleteAd);
  const client = useQueryClient();
  const [editing, setEditing] = useState<AdCampaign | null | "new">(null);
  const [error, setError] = useState("");
  const byName = new Map(data.report.map((r) => [r.source, r]));
  const best = rankAds(data.report)[0]?.source;
  const decisions = adDecisions(data.ads, data.report);
  const refresh = () => client.invalidateQueries({ queryKey: ["pipeline"] });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Ads</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/pipeline">Pipeline</Link>
          </Button>
          {data.access.isOwner && (
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" />
              Add campaign
            </Button>
          )}
        </div>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        One row per campaign: one buyer type, one offer. Pick the ad on each lead so the numbers
        below count it. Day-14 rule: stop the worst two, keep the winner, raise budget only if cost
        per viewing holds.
      </p>

      {decisions.length > 0 && (
        <section className="mb-4 rounded-lg border border-border p-3">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Day-14 rule: what to do now
          </p>
          {decisions.map((d) => (
            <p key={d.name} className="text-sm">
              <span
                className={`mr-2 rounded px-1.5 text-[10px] font-bold uppercase ${d.action === "keep" ? "bg-primary/15 text-primary" : d.action === "stop" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}
              >
                {d.action}
              </span>
              <strong>{d.name}</strong> <span className="text-muted-foreground">{d.reason}</span>
            </p>
          ))}
        </section>
      )}

      {error && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {data.ads.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No ad campaigns yet. Add one per buyer type and offer.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="p-2">Campaign</th>
                <th>Offer</th>
                <th>Status</th>
                <th>Daily</th>
                <th>Spent</th>
                <th>Leads</th>
                <th>Replied</th>
                <th>Reply time</th>
                <th>Qualified</th>
                <th>Viewings</th>
                <th>Won</th>
                <th>Cost / viewing</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.ads.map((a) => {
                const r = byName.get(a.name);
                return (
                  <tr
                    key={a.id}
                    className={`border-t border-border ${best === a.name ? "bg-primary/5" : ""}`}
                  >
                    <td className="p-2">
                      <div className="flex items-center gap-1 font-medium">
                        {best === a.name && <Trophy className="size-3.5 text-primary" />}
                        {a.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {a.platform}
                        {a.buyer_type ? ` · ${a.buyer_type.replace("_", " ")}` : ""}
                        {a.creative_type ? ` · ${a.creative_type}` : ""}
                        {a.started_at ? ` · from ${a.started_at}` : ""}
                      </div>
                    </td>
                    <td className="max-w-[220px] text-xs">{a.offer}</td>
                    <td>
                      <span
                        className={`rounded px-1.5 text-[10px] font-bold uppercase ${STATUS[a.status as keyof typeof STATUS] ?? STATUS.draft}`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td>{a.daily_budget_aed == null ? "—" : aed(a.daily_budget_aed)}</td>
                    <td>{aed(a.spend_to_date_aed)}</td>
                    <td>{r?.leads ?? 0}</td>
                    <td>{r ? `${r.replied_pct}%` : "—"}</td>
                    <td>{minutes(r?.avg_first_reply_minutes)}</td>
                    <td>{r?.qualified ?? 0}</td>
                    <td>
                      {r?.viewings_attended ?? 0}
                      <span className="text-muted-foreground"> / {r?.viewings_booked ?? 0}</span>
                    </td>
                    <td>{r?.won ?? 0}</td>
                    <td>
                      {r?.cost_per_attended_viewing == null
                        ? "—"
                        : aed(r.cost_per_attended_viewing)}
                    </td>
                    <td className="pr-2 text-right">
                      {data.access.isOwner && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => setEditing(a)}>
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              if (
                                !window.confirm(`Delete ${a.name}? Leads keep their other details.`)
                              )
                                return;
                              setError("");
                              try {
                                await remove({ data: a.id });
                                await refresh();
                              } catch {
                                setError("Could not delete the campaign.");
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="p-2 text-xs text-muted-foreground">
            Viewings shows attended / booked. The trophy marks the lowest cost per attended viewing.
            Portal leads are counted on the Pipeline page under "By source".
          </p>
        </div>
      )}

      {editing && (
        <AdDialog
          ad={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await refresh();
            setEditing(null);
          }}
        />
      )}
    </main>
  );
}

function AdDialog({
  ad,
  onClose,
  onSaved,
}: {
  ad: AdCampaign | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const save = useServerFn(saveAd);
  const s = (v: string | number | null | undefined) => (v == null ? "" : String(v));
  const [d, setD] = useState({
    name: ad?.name ?? "",
    platform: ad?.platform ?? "meta",
    buyer_type: s(ad?.buyer_type),
    offer: s(ad?.offer),
    creative_type: s(ad?.creative_type),
    daily_budget_aed: s(ad?.daily_budget_aed),
    spend_to_date_aed: s(ad?.spend_to_date_aed ?? 0),
    status: ad?.status ?? "testing",
    started_at: s(ad?.started_at),
    ended_at: s(ad?.ended_at),
    notes: s(ad?.notes),
  });
  const set = (k: keyof typeof d, v: string) => setD((p) => ({ ...p, [k]: v }));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const txt = (v: string) => (v.trim() === "" ? null : v.trim());
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await save({
        data: {
          ...(ad ? { id: ad.id } : {}),
          name: d.name,
          platform: d.platform as "meta",
          buyer_type: txt(d.buyer_type) as "investor" | null,
          offer: txt(d.offer),
          creative_type: txt(d.creative_type),
          daily_budget_aed: d.daily_budget_aed.trim() === "" ? null : Number(d.daily_budget_aed),
          spend_to_date_aed: Number(d.spend_to_date_aed) || 0,
          status: d.status as "testing",
          started_at: txt(d.started_at),
          ended_at: txt(d.ended_at),
          notes: txt(d.notes),
        },
      });
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogTitle>{ad ? "Edit campaign" : "Add campaign"}</DialogTitle>
        <DialogDescription>
          One buyer type, one offer, one campaign. Update "spent" from the ad manager when you check
          the numbers.
        </DialogDescription>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            Name
            <Input
              className="mt-1"
              maxLength={120}
              value={d.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Platform
            <select
              className={selectCls}
              value={d.platform}
              onChange={(e) => set("platform", e.target.value)}
            >
              {AD_PLATFORMS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Buyer type
            <select
              className={selectCls}
              value={d.buyer_type}
              onChange={(e) => set("buyer_type", e.target.value)}
            >
              <option value="">—</option>
              {BUYER_TYPES.map((b) => (
                <option key={b} value={b}>
                  {b.replace("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            Offer (what they get for leaving their number)
            <Input
              className="mt-1"
              maxLength={300}
              value={d.offer}
              onChange={(e) => set("offer", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Creative (video, price card, carousel…)
            <Input
              className="mt-1"
              maxLength={120}
              value={d.creative_type}
              onChange={(e) => set("creative_type", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Status
            <select
              className={selectCls}
              value={d.status}
              onChange={(e) => set("status", e.target.value)}
            >
              {AD_STATUSES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Daily budget (AED)
            <Input
              className="mt-1"
              type="number"
              value={d.daily_budget_aed}
              onChange={(e) => set("daily_budget_aed", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Spent so far (AED)
            <Input
              className="mt-1"
              type="number"
              value={d.spend_to_date_aed}
              onChange={(e) => set("spend_to_date_aed", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Started
            <Input
              className="mt-1"
              type="date"
              value={d.started_at}
              onChange={(e) => set("started_at", e.target.value)}
            />
          </label>
          <label className="text-sm">
            Ended
            <Input
              className="mt-1"
              type="date"
              value={d.ended_at}
              onChange={(e) => set("ended_at", e.target.value)}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Notes
            <Input
              className="mt-1"
              maxLength={1000}
              value={d.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !d.name.trim()} onClick={() => void submit()}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
