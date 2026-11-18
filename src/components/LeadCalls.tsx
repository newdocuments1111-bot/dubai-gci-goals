import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { MessageCircle, Phone, PhoneOff } from "lucide-react";
import { listCalls, logCall, setDoNotCall } from "@/lib/leadtools.functions";
import { CALL_RULES_NOTE, callCheck } from "@/lib/calling";
import { whatsappLink } from "@/lib/inbox";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

const OUTCOMES = [
  ["answered", "Answered"],
  ["no_answer", "No answer"],
  ["call_back", "Call back later"],
  ["wrong_number", "Wrong number"],
] as const;
type Outcome = (typeof OUTCOMES)[number][0];

/**
 * Call the client and log how it went. A logged call shows in the lead history and counts as a human reply.
 * Before the call, a reminder of the UAE calling rules (hours, one call a day, two a week, do not call).
 */
export function LeadCalls({
  leadId,
  phone,
  doNotCall,
  onChanged,
}: {
  leadId: string;
  phone: string;
  doNotCall: boolean;
  onChanged: () => void;
}) {
  const client = useQueryClient();
  const log = useServerFn(logCall);
  const saveDoNotCall = useServerFn(setDoNotCall);
  const {
    data: calls,
    isPending: callsLoading,
    isError: callsFailed,
  } = useQuery({
    queryKey: ["lead-calls", leadId],
    queryFn: () => listCalls({ data: leadId }),
  });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const tel = phone.replace(/[^\d+]/g, "");
  const wa = whatsappLink(phone);

  // The rules depend on the time of day, so look at the clock again every half minute.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const check = callCheck({
    now,
    doNotCall,
    callTimes: (calls ?? []).map((c) => c.created_at),
  });
  const stopped = check.level === "stop";

  const toggleDoNotCall = async (value: boolean) => {
    setBusy(true);
    setError("");
    try {
      await saveDoNotCall({ data: { leadId, doNotCall: value } });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const save = async (outcome: Outcome) => {
    setBusy(true);
    setError("");
    try {
      await log({ data: { leadId, outcome, note } });
      setNote("");
      setNow(new Date());
      await client.invalidateQueries({ queryKey: ["lead-calls", leadId] });
      void client.invalidateQueries({ queryKey: ["lead-events", leadId] });
      void client.invalidateQueries({ queryKey: ["inbox"] });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not log the call.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Calls" className="mb-4 rounded-lg border border-border p-4 text-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-semibold">Calls</h2>
        {tel && !stopped && (
          <Button asChild size="sm">
            <a href={`tel:${tel}`}>
              <Phone className="size-4" />
              Call {phone}
            </a>
          </Button>
        )}
        {wa && (
          <Button asChild size="sm" variant="outline">
            <a href={wa} target="_blank" rel="noreferrer">
              <MessageCircle className="size-4" />
              WhatsApp
            </a>
          </Button>
        )}
      </div>
      {check.level !== "ok" && (
        <div
          role={stopped ? "alert" : "status"}
          className={`mb-3 rounded-md border p-3 ${
            stopped
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-warning bg-warning/15 text-warning-foreground"
          }`}
        >
          <p className="flex items-center gap-2 font-semibold">
            {stopped && <PhoneOff className="size-4" />}
            {stopped ? "Do not call now" : "Check before you call"}
          </p>
          <ul className="mt-1 space-y-0.5">
            {check.messages.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          {stopped && wa && (
            <p className="mt-1">
              {doNotCall
                ? "Message on WhatsApp only if the client agreed to messages."
                : "You can send a WhatsApp message instead."}
            </p>
          )}
        </div>
      )}
      {callsLoading && !doNotCall && (
        <p className="mb-3 text-xs text-muted-foreground">Checking earlier calls…</p>
      )}
      {callsFailed && !doNotCall && (
        <p role="alert" className="mb-3 text-xs text-destructive">
          Could not load earlier calls, so the one-a-day and two-a-week limits are not checked.
        </p>
      )}
      <label className="mb-1 flex items-center gap-2">
        <Checkbox
          checked={doNotCall}
          disabled={busy}
          onCheckedChange={(value) => void toggleDoNotCall(value === true)}
        />
        Client asked not to be called
      </label>
      <p className="mb-3 text-xs text-muted-foreground">{CALL_RULES_NOTE}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Call note"
          className="h-9 min-w-48 flex-1"
          placeholder="Note (optional): what was said, when to call back"
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {OUTCOMES.map(([k, label]) => (
          <Button
            key={k}
            size="sm"
            variant="outline"
            className="h-9"
            disabled={busy}
            onClick={() => void save(k)}
          >
            {label}
          </Button>
        ))}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        After the call, tap how it went. It is saved with the time and your name. You can always log
        a call that already happened.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-destructive">
          {error}
        </p>
      )}
      {(calls ?? []).length > 0 && (
        <ul className="mt-3 divide-y divide-border border-t border-border">
          {(calls ?? []).slice(0, 8).map((c) => (
            <li key={c.id} className="flex flex-wrap gap-x-3 py-1.5">
              <span className="w-36 shrink-0 text-xs text-muted-foreground">
                {new Date(c.created_at).toLocaleString("en-GB", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Asia/Dubai",
                })}
              </span>
              <span className="font-medium">
                {OUTCOMES.find(([k]) => k === c.outcome)?.[1] ?? c.outcome}
              </span>
              {c.note && <span className="min-w-0 flex-1 text-muted-foreground">{c.note}</span>}
              <span className="ml-auto text-xs text-muted-foreground">{c.by}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
