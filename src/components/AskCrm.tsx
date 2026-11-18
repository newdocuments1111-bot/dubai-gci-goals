import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { askCrm, type AskResponse } from "@/lib/ask.functions";
import { REPORTS } from "@/lib/ask";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** "Ask your CRM" box: one question in, one-line answer, the numbers, and links to the leads behind them. */
export function AskCrm({ isOwner }: { isOwner: boolean }) {
  const ask = useServerFn(askCrm);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [res, setRes] = useState<AskResponse | null>(null);
  const suggestions = REPORTS.filter((r) => isOwner || !r.ownerOnly).map((r) => r.example);

  const run = async (q: string) => {
    const text = q.trim();
    if (text.length < 2) return;
    setQuestion(text);
    setBusy(true);
    setError("");
    try {
      setRes(await ask({ data: { question: text } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not answer that.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label="Ask your CRM"
      className="rounded-xl border border-border bg-background p-4 shadow-xs sm:p-5"
    >
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run(question);
        }}
      >
        <div className="relative flex-1">
          <Sparkles className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Ask your CRM"
            className="h-10 pl-9"
            maxLength={300}
            placeholder="Ask your CRM, e.g. Which ads brought viewings this month?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </div>
        <Button type="submit" className="h-10" disabled={busy || question.trim().length < 2}>
          {busy ? "Working…" : "Ask"}
        </Button>
      </form>

      {!res && !error && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.slice(0, 6).map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => void run(s)}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {res?.kind === "unknown" && (
        <div className="mt-3 text-sm">
          <p>{res.message}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {res.suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void run(s)}
                className="rounded-full border border-border px-3 py-1 text-xs hover:border-primary"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {res?.kind === "answer" && (
        <div className="mt-4 space-y-3" aria-live="polite">
          <div className="rounded-lg bg-primary/5 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {res.result.title}
            </p>
            <p className="mt-1 text-sm font-medium">{res.result.answer}</p>
          </div>
          {res.result.rows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    {res.result.columns.map((c, i) => (
                      <th
                        key={c}
                        className={`px-3 py-2 font-medium ${i > 0 ? "whitespace-nowrap" : ""}`}
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {res.result.rows.map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      {r.cells.map((c, j) => (
                        <td key={j} className="px-3 py-2">
                          {j === 0 && r.leadId ? (
                            <Link
                              to="/lead/$leadId"
                              params={{ leadId: r.leadId }}
                              className="font-medium hover:underline"
                            >
                              {c}
                            </Link>
                          ) : (
                            c
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>Every number comes from your own data.</span>
            {res.result.note && <span>{res.result.note}</span>}
            <button
              type="button"
              className="inline-flex items-center gap-1 underline"
              onClick={() => {
                setRes(null);
                setQuestion("");
              }}
            >
              Ask something else <ArrowRight className="size-3" />
            </button>
          </p>
        </div>
      )}
    </section>
  );
}
