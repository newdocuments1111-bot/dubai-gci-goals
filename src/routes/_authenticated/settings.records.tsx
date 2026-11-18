import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Download } from "lucide-react";
import { exportRecords, getActivity } from "@/lib/records.functions";
import {
  ACTIVITY_ENTITIES,
  EXPORT_KINDS,
  EXPORT_LABELS,
  actorName,
  exportFileName,
  toCsv,
  type ExportKind,
} from "@/lib/records";
import { Button } from "@/components/ui/button";

const activityQuery = (entity: string) =>
  queryOptions({
    queryKey: ["activity", entity],
    queryFn: () => getActivity({ data: { entity } }),
  });

export const Route = createFileRoute("/_authenticated/settings/records")({
  head: () => ({
    meta: [{ title: "Records — Dubai AI GCI" }, { name: "robots", content: "noindex" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(activityQuery("")),
  component: RecordsPage,
});

const when = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));

function RecordsPage() {
  const [entity, setEntity] = useState("");
  const { data } = useSuspenseQuery(activityQuery(entity));
  const client = useQueryClient();
  const exportFn = useServerFn(exportRecords);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const download = async (kind: ExportKind) => {
    setBusy(kind);
    setNote(null);
    try {
      const { rows } = await exportFn({ data: kind });
      // Built on this device and saved as a file: no client data goes into a link.
      const url = URL.createObjectURL(
        new Blob([toCsv(kind, rows)], { type: "text/csv;charset=utf-8" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = exportFileName(kind);
      a.click();
      URL.revokeObjectURL(url);
      setNote({ ok: true, text: `${EXPORT_LABELS[kind]}: ${rows.length} rows downloaded.` });
      await client.invalidateQueries({ queryKey: ["activity"] });
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : "Could not export." });
    } finally {
      setBusy("");
    }
  };

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Records</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Download your data, and see who changed what. Only the agency owner can open this page.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-background p-5">
        <h2 className="text-lg font-semibold">Export</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Files open in Excel or Google Sheets. Each download is written to the activity log below.
          The files hold client phone numbers, so keep them safe.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {EXPORT_KINDS.map((k) => (
            <Button key={k} variant="outline" disabled={!!busy} onClick={() => download(k)}>
              <Download className="size-4" />
              {busy === k ? "Preparing…" : EXPORT_LABELS[k]}
            </Button>
          ))}
        </div>
        {note && (
          <p
            role={note.ok ? "status" : "alert"}
            className={`mt-3 text-sm ${note.ok ? "text-primary" : "text-destructive"}`}
          >
            {note.text}
          </p>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Activity log</h2>
            <p className="text-sm text-muted-foreground">
              The latest 300 changes. Written by the app itself; nobody can edit or delete them.
            </p>
          </div>
          <label className="text-sm">
            Show
            <select
              className="ms-2 h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
            >
              {ACTIVITY_ENTITIES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!data.rows.length ? (
          <p className="rounded-xl border border-border bg-background p-5 text-sm text-muted-foreground">
            Nothing yet. Changes to leads, deals, listings, the team and settings will show here
            from today.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-background">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-start text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-start font-medium">When (Dubai)</th>
                  <th className="px-4 py-2 text-start font-medium">Who</th>
                  <th className="px-4 py-2 text-start font-medium">What</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                      {when(r.at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      {actorName(r.actor_id, data.members)}
                    </td>
                    <td className="px-4 py-2">
                      <span className="font-medium">{r.action}</span>
                      {r.detail && <span className="text-muted-foreground"> · {r.detail}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
