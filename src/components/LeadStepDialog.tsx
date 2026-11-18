import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Copy } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { listLeadEvents, updateLeadPipeline } from "@/lib/pipeline.functions";
import {
  OUTCOMES,
  STAGES,
  TRACKS,
  checklistOf,
  describeEvent,
  doneItems,
  fillTemplate,
  lostNeedsReason,
  ruleFor,
  toggleItem,
  type AdCampaign,
  type Lead,
  type StageRule,
} from "@/lib/pipeline";

const selectCls = "rounded-md border border-input bg-background px-2 py-1 text-sm";

/** Edit the pipeline side of one lead: step, track, outcome, ad, checklist. Chat and details stay on the lead page. */
const memberName = (m: { display_name: string | null; email: string | null } | undefined) =>
  m ? m.display_name || m.email || "Agent" : "Unassigned";

export function LeadStepDialog({
  lead,
  rules,
  ads,
  members,
  isOwner,
  onClose,
}: {
  lead: Lead;
  rules: StageRule[];
  ads: AdCampaign[];
  members: { user_id: string; display_name: string | null; email: string | null }[];
  isOwner: boolean;
  onClose: () => void;
}) {
  const update = useServerFn(updateLeadPipeline);
  const client = useQueryClient();
  const [stage, setStage] = useState(lead.stage);
  const [track, setTrack] = useState(lead.track);
  const [outcome, setOutcome] = useState(lead.outcome);
  const [lostReason, setLostReason] = useState(lead.lost_reason ?? "");
  const [adId, setAdId] = useState(lead.ad_campaign_id ?? "");
  const [agentId, setAgentId] = useState(lead.assigned_agent_id ?? "");
  const [done, setDone] = useState(doneItems(lead));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const events = useQuery({
    queryKey: ["lead-events", lead.id],
    queryFn: () => listLeadEvents({ data: lead.id }),
  });

  const rule = ruleFor(rules, stage, track);
  const stageChanged = stage !== lead.stage;
  const missingReason = lostNeedsReason(outcome, lostReason);
  const message = fillTemplate(rule.template, lead, {
    agent: memberName(members.find((m) => m.user_id === (agentId || lead.assigned_agent_id))),
  });

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await update({
        data: {
          id: lead.id,
          stage,
          track: track as "ready" | "offplan",
          outcome: outcome as "open" | "not_now" | "lost" | "won",
          lost_reason: lostReason.trim() || null,
          ad_campaign_id: adId || null,
          checklist_done: stageChanged ? [] : done,
          ...(isOwner ? { assigned_agent_id: agentId || null } : {}),
        },
      });
      await client.invalidateQueries({ queryKey: ["pipeline"] });
      client.invalidateQueries({ queryKey: ["leads"] });
      onClose();
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
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogTitle>
          {lead.name || "Unnamed lead"}{" "}
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {lead.score} · {lead.source}
          </span>
        </DialogTitle>
        <DialogDescription>
          Step name, who does it, the next action and its due time come from the rulebook when you
          save.{" "}
          <Link className="underline" to="/lead/$leadId" params={{ leadId: lead.id }}>
            Open the full lead
          </Link>
          .
        </DialogDescription>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Step
            <select
              aria-label="Step"
              className={`${selectCls} mt-1 w-full`}
              value={stage}
              onChange={(e) => setStage(Number(e.target.value))}
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}. {ruleFor(rules, s, track).name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Track
            <select
              aria-label="Track"
              className={`${selectCls} mt-1 w-full`}
              value={track}
              onChange={(e) => setTrack(e.target.value)}
            >
              {TRACKS.map((t) => (
                <option key={t} value={t}>
                  {t === "ready" ? "Ready property" : "Off-plan"}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Outcome
            <select
              aria-label="Outcome"
              className={`${selectCls} mt-1 w-full`}
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            >
              {OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {o.replace("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            {outcome === "lost" ? "Lost reason (required)" : "Lost reason"}
            <Input
              className={`mt-1 ${missingReason ? "border-destructive" : ""}`}
              maxLength={500}
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Came from ad
            <select
              aria-label="Ad campaign"
              className={`${selectCls} mt-1 w-full`}
              value={adId}
              onChange={(e) => setAdId(e.target.value)}
            >
              <option value="">— not from an ad —</option>
              {ads.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          {isOwner && (
            <label className="text-sm">
              Agent
              <select
                aria-label="Agent"
                className={`${selectCls} mt-1 w-full`}
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
              >
                <option value="">— unassigned —</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {memberName(m)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <section className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">
            Who: <strong className="text-foreground">{rule.who || "—"}</strong>
            {rule.next_action && (
              <>
                {" "}
                · Next: <strong className="text-foreground">{rule.next_action}</strong>
              </>
            )}
          </p>
          {checklistOf(rule).length > 0 && (
            <div className="mt-2 grid gap-1.5">
              {stageChanged && (
                <p className="text-xs text-muted-foreground">
                  The checklist resets when the step changes.
                </p>
              )}
              {checklistOf(rule).map((item) => (
                <label key={item} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={!stageChanged && done.includes(item)}
                    disabled={stageChanged}
                    onCheckedChange={() => setDone(toggleItem(done, item))}
                  />
                  {item}
                </label>
              ))}
            </div>
          )}
        </section>

        {message && (
          <section className="rounded-lg border border-border p-3">
            <p className="mb-1 text-xs text-muted-foreground">
              Message for this step (copy it into the chat; nothing is sent from here)
            </p>
            <p className="whitespace-pre-wrap text-sm">{message}</p>
            <Button
              className="mt-2"
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(message);
                  setNote("Copied.");
                } catch {
                  setNote("Could not copy.");
                }
              }}
            >
              <Copy className="size-4" />
              Copy
            </Button>
            {note && (
              <span className="ml-2 text-xs text-muted-foreground" role="status">
                {note}
              </span>
            )}
          </section>
        )}

        <section>
          <h3 className="mb-1 text-sm font-semibold">History</h3>
          {(events.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No moves recorded yet.</p>
          ) : (
            <ul className="grid gap-1 text-xs">
              {(events.data ?? []).map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="w-36 shrink-0 text-muted-foreground">
                    {new Date(e.at).toLocaleString("en-GB", { timeZone: "Asia/Dubai" })}
                  </span>
                  <span>{describeEvent(e, (s) => ruleFor(rules, s, lead.track).name)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || missingReason} onClick={() => void save()}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
