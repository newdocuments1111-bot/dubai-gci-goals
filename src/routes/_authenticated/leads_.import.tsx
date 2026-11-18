import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { importLeads } from "@/lib/leadtools.functions";
import { getDealOptions } from "@/lib/deals.functions";
import {
  IMPORT_FIELDS,
  LEAD_SOURCES,
  buildLeads,
  guessMapping,
  looksLikeHeader,
  parseTable,
  type ImportField,
} from "@/lib/lead-import";
import type { LeadSource } from "@/lib/inbox";
import { useMembership } from "@/hooks/use-membership";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/leads_/import")({
  head: () => ({
    meta: [
      { title: "Import leads — Dubai AI GCI" },
      { name: "description", content: "Bring your leads in from Excel or another CRM." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ImportPage,
});

const selectCls = "h-9 rounded-md border border-input bg-background px-2 text-sm";
const LABEL: Record<ImportField, string> = {
  name: "Name",
  phone: "Phone",
  email: "Email",
  source: "Source",
  area: "Area",
  budget: "Budget",
  type: "Type",
  language: "Language",
  notes: "Notes",
  date: "Date received",
};

function ImportPage() {
  const membership = useMembership();
  const client = useQueryClient();
  const run = useServerFn(importLeads);
  const { data: options } = useQuery({
    queryKey: ["deal-options"],
    queryFn: () => getDealOptions(),
    enabled: membership.isOwner,
  });
  const [text, setText] = useState("");
  const [override, setOverride] = useState<Partial<Record<ImportField, number>>>({});
  const [defaultSource, setDefaultSource] = useState<LeadSource>("Other");
  const [assign, setAssign] = useState<string>("me");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ imported: number; duplicates: number } | null>(null);

  const table = useMemo(() => parseTable(text), [text]);
  const hasHeader = table[0] ? looksLikeHeader(table[0]) : false;
  const header = hasHeader ? (table[0] ?? []) : (table[0] ?? []).map((_, i) => `Column ${i + 1}`);
  const mapping = useMemo(() => {
    const guessed = hasHeader
      ? guessMapping(header)
      : // No header row: assume Name, Phone, then whatever else was pasted in the usual order.
        (Object.fromEntries(
          IMPORT_FIELDS.map((f, i) => [f, i < 2 && i < header.length ? i : -1]),
        ) as Record<ImportField, number>);
    return { ...guessed, ...override };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, override]);
  const preview = useMemo(
    () =>
      buildLeads(hasHeader ? table.slice(1) : table, mapping, {
        defaultSource,
        firstRowNumber: hasHeader ? 2 : 1,
      }),
    [table, mapping, defaultSource, hasHeader],
  );

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 3_000_000)
      return setError("That file is over 3 MB. Split it and import in parts.");
    if (/\.xlsx?$/i.test(file.name))
      return setError(
        "For an Excel file: open it, select the rows, copy, and paste them in the box below.",
      );
    setError("");
    setDone(null);
    setOverride({});
    setText(await file.text());
  };

  const start = async () => {
    setBusy(true);
    setError("");
    setDone(null);
    const total = { imported: 0, duplicates: 0 };
    try {
      for (let i = 0; i < preview.leads.length; i += 200) {
        setProgress(
          `Importing ${Math.min(i + 200, preview.leads.length)} of ${preview.leads.length}…`,
        );
        const r = await run({
          data: {
            leads: preview.leads.slice(i, i + 200),
            assign: assign === "me" ? membership.userId : assign,
          },
        });
        total.imported += r.imported;
        total.duplicates += r.duplicates;
      }
      setDone(total);
      setText("");
      void client.invalidateQueries({ queryKey: ["leads"] });
      void client.invalidateQueries({ queryKey: ["pipeline"] });
      void client.invalidateQueries({ queryKey: ["inbox"] });
    } catch (e) {
      setError(
        `${e instanceof Error ? e.message : "Import stopped."}${total.imported ? ` ${total.imported} were imported before it stopped; importing again skips them.` : ""}`,
      );
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Import leads</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Bring leads in from Excel or another CRM. Copy the rows in Excel and paste them here, or
        choose a CSV file. Phone numbers you already have are skipped, so importing twice is safe.
      </p>

      {done && (
        <p role="status" className="mb-4 rounded-lg bg-primary/5 p-3 text-sm">
          <strong>{done.imported}</strong> lead{done.imported === 1 ? "" : "s"} imported
          {done.duplicates > 0 && (
            <>, {done.duplicates} skipped because you already have that phone number</>
          )}
          .{" "}
          <Link to="/leads" className="underline">
            Open the list
          </Link>
        </p>
      )}
      {error && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {error}
        </p>
      )}

      <section className="rounded-xl border border-border bg-background p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">1. Your rows</h2>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted">
            <Upload className="size-4" />
            Choose a CSV file
            <input
              type="file"
              accept=".csv,.tsv,.txt,text/csv"
              className="sr-only"
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <Textarea
          aria-label="Rows to import"
          rows={6}
          className="font-mono text-xs"
          placeholder={
            "Name\tPhone\tSource\tArea\tBudget\nSara Khan\t+971501112222\tBayut\tDubai Marina\t2.1M"
          }
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setDone(null);
            setOverride({});
          }}
        />
      </section>

      {table.length > 0 && (
        <>
          <section className="mt-4 rounded-xl border border-border bg-background p-5">
            <h2 className="font-semibold">2. Check the columns</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              {hasHeader
                ? "I matched your column names."
                : "No column names found, so I assumed Name then Phone."}{" "}
              Change any that are wrong.
            </p>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {IMPORT_FIELDS.map((f) => (
                <label key={f} className="text-xs text-muted-foreground">
                  {LABEL[f]}
                  <select
                    className={`${selectCls} mt-1 w-full text-foreground`}
                    value={mapping[f]}
                    onChange={(e) => setOverride({ ...override, [f]: Number(e.target.value) })}
                  >
                    <option value={-1}>Not in my file</option>
                    {header.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Column ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-4">
              <label className="text-sm">
                Source when the row has none
                <select
                  className={`${selectCls} ml-2`}
                  value={defaultSource}
                  onChange={(e) => setDefaultSource(e.target.value as LeadSource)}
                >
                  {LEAD_SOURCES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              {membership.isOwner && (
                <label className="text-sm">
                  Give these leads to
                  <select
                    className={`${selectCls} ml-2`}
                    value={assign}
                    onChange={(e) => setAssign(e.target.value)}
                  >
                    <option value="me">Me</option>
                    <option value="routing">My routing rules</option>
                    {(options?.members ?? [])
                      .filter((m) => m.user_id !== membership.userId)
                      .map((m) => (
                        <option key={m.user_id} value={m.user_id}>
                          {m.display_name || m.email}
                        </option>
                      ))}
                  </select>
                </label>
              )}
            </div>
          </section>

          <section className="mt-4 rounded-xl border border-border bg-background p-5">
            <h2 className="font-semibold">3. Preview</h2>
            <p className="mb-3 text-sm">
              <strong>{preview.leads.length}</strong> lead{preview.leads.length === 1 ? "" : "s"}{" "}
              ready
              {preview.duplicatesInFile > 0 && (
                <> · {preview.duplicatesInFile} repeated in the file</>
              )}
              {preview.skipped.length > 0 && (
                <span className="text-destructive"> · {preview.skipped.length} skipped</span>
              )}
            </p>
            {preview.leads.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      {["Name", "Phone", "Source", "Area", "Budget", "Type"].map((h) => (
                        <th key={h} className="px-3 py-2 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.leads.slice(0, 8).map((l, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-1.5">{l.name || "—"}</td>
                        <td className="px-3 py-1.5">{l.phone || "—"}</td>
                        <td className="px-3 py-1.5">{l.source}</td>
                        <td className="px-3 py-1.5">{l.area || "—"}</td>
                        <td className="px-3 py-1.5">{l.budget || "—"}</td>
                        <td className="px-3 py-1.5">{l.type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {preview.leads.length > 8 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Showing the first 8 of {preview.leads.length}.
              </p>
            )}
            {preview.skipped.length > 0 && (
              <ul className="mt-3 space-y-0.5 text-xs text-muted-foreground">
                {preview.skipped.slice(0, 6).map((s) => (
                  <li key={s.row}>
                    Row {s.row}: {s.reason}
                  </li>
                ))}
                {preview.skipped.length > 6 && <li>…and {preview.skipped.length - 6} more</li>}
              </ul>
            )}
            <div className="mt-4 flex items-center gap-3">
              <Button disabled={busy || preview.leads.length === 0} onClick={() => void start()}>
                {busy
                  ? progress || "Importing…"
                  : `Import ${preview.leads.length} lead${preview.leads.length === 1 ? "" : "s"}`}
              </Button>
              <span className="text-xs text-muted-foreground">
                Imported leads get no automatic message and no alert. They are not counted as
                missed.
              </span>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
