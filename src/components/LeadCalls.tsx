import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { MessageCircle, Phone } from "lucide-react";
import { listCalls, logCall } from "@/lib/leadtools.functions";
import { whatsappLink } from "@/lib/inbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const OUTCOMES = [
  ["answered", "Answered"],
  ["no_answer", "No answer"],
  ["call_back", "Call back later"],
  ["wrong_number", "Wrong number"],
] as const;
type Outcome = (typeof OUTCOMES)[number][0];

/** Call the client and log how it went. A logged call shows in the lead history and counts as a human reply. */
export function LeadCalls({
  leadId,
  phone,
  onChanged,
}: {
  leadId: string;
  phone: string;
  onChanged: () => void;
}) {
  const client = useQueryClient();
  const log = useServerFn(logCall);
  const { data: calls } = useQuery({
    queryKey: ["lead-calls", leadId],
    queryFn: () => listCalls({ data: leadId }),
  });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const tel = phone.replace(/[^\d+]/g, "");
  const wa = whatsappLink(phone);

  const save = async (outcome: Outcome) => {
    setBusy(true);
    setError("");
    try {
      await log({ data: { leadId, outcome, note } });
      setNote("");
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
        {tel && (
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
        After the call, tap how it went. It is saved with the time and your name.
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
