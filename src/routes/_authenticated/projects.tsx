import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus } from "lucide-react";
import { createProject, getProjects } from "@/lib/developer.functions";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
  aed,
  longDate,
  type ProjectInput,
  type ProjectStatus,
} from "@/lib/developer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const projectsQuery = queryOptions({
  queryKey: ["dev-projects"],
  queryFn: () => getProjects(),
});

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({
    meta: [{ title: "Projects — Dubai AI GCI" }, { name: "robots", content: "noindex" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(projectsQuery),
  component: ProjectsPage,
});

const selectClass =
  "mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const EMPTY: ProjectInput = {
  name: "",
  developer_name: "",
  community: "",
  handover_date: "",
  status: "selling",
  notes: "",
};

function ProjectsPage() {
  const { data } = useSuspenseQuery(projectsQuery);
  const client = useQueryClient();
  const create = useServerFn(createProject);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProjectInput>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (patch: Partial<ProjectInput>) => setForm({ ...form, ...patch });

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await create({ data: { ...form, name: form.name.trim() } });
      setForm(EMPTY);
      setOpen(false);
      await client.invalidateQueries({ queryKey: ["dev-projects"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Your own developments: units, holds, sales and payment plans. This is your team's
            record. It does not register sales with any authority and does not send payment
            reminders.
          </p>
        </div>
        {data.isOwner && !open && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="me-1 h-4 w-4" />
            New project
          </Button>
        )}
      </div>

      {data.isOwner && open && (
        <section className="space-y-4 rounded-xl border border-border bg-background p-5">
          <h2 className="text-lg font-semibold">New project</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              Project name
              <Input
                className="mt-1 h-9"
                maxLength={120}
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
              />
            </label>
            <label className="text-sm">
              Developer name
              <Input
                className="mt-1 h-9"
                maxLength={120}
                value={form.developer_name}
                onChange={(e) => set({ developer_name: e.target.value })}
              />
            </label>
            <label className="text-sm">
              Community
              <Input
                className="mt-1 h-9"
                maxLength={120}
                placeholder="e.g. Dubai Creek Harbour"
                value={form.community}
                onChange={(e) => set({ community: e.target.value })}
              />
            </label>
            <label className="text-sm">
              Handover date (if known)
              <Input
                className="mt-1 h-9"
                type="date"
                value={form.handover_date}
                onChange={(e) => set({ handover_date: e.target.value })}
              />
            </label>
            <label className="text-sm">
              Status
              <select
                className={selectClass}
                value={form.status}
                onChange={(e) => set({ status: e.target.value as ProjectStatus })}
              >
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PROJECT_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              Notes (only your team sees them)
              <Textarea
                className="mt-1"
                rows={2}
                maxLength={2000}
                value={form.notes}
                onChange={(e) => set({ notes: e.target.value })}
              />
            </label>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button disabled={busy || !form.name.trim()} onClick={submit}>
              {busy ? "Saving…" : "Create project"}
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </section>
      )}

      {!data.projects.length ? (
        <p className="rounded-xl border border-border bg-background p-5 text-sm">
          No projects yet.{" "}
          {data.isOwner
            ? "Create your first project, then add its units."
            : "The agency owner creates projects; they will show here."}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {data.projects.map((p) => {
            const total = p.counts.free + p.counts.held + p.counts.sold;
            return (
              <li key={p.id}>
                <Link
                  to="/project/$projectId"
                  params={{ projectId: p.id }}
                  className="block rounded-xl border border-border bg-background p-5 shadow-xs transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold">{p.name}</h2>
                      <p className="truncate text-sm text-muted-foreground">
                        {[p.developer_name, p.community].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">
                      {PROJECT_STATUS_LABEL[p.status as ProjectStatus] ?? p.status}
                    </span>
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="rounded-md bg-emerald-500/10 px-2 py-2">
                      <dd className="text-xl font-semibold tabular-nums">{p.counts.free}</dd>
                      <dt className="text-xs text-muted-foreground">Free</dt>
                    </div>
                    <div className="rounded-md bg-amber-500/15 px-2 py-2">
                      <dd className="text-xl font-semibold tabular-nums">{p.counts.held}</dd>
                      <dt className="text-xs text-muted-foreground">Held</dt>
                    </div>
                    <div className="rounded-md bg-muted px-2 py-2">
                      <dd className="text-xl font-semibold tabular-nums">{p.counts.sold}</dd>
                      <dt className="text-xs text-muted-foreground">Sold</dt>
                    </div>
                  </dl>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {total} {total === 1 ? "unit" : "units"}
                    {p.handover_date ? ` · Handover ${longDate(p.handover_date)}` : ""}
                  </p>
                  {p.totals.soldAed > 0 && (
                    <p className="mt-1 text-sm">
                      Collected {aed(p.totals.collectedAed)} · Outstanding{" "}
                      {aed(p.totals.outstandingAed)}
                      {p.totals.overdueAed > 0 && (
                        <span className="text-destructive">
                          {" "}
                          · Overdue {aed(p.totals.overdueAed)}
                        </span>
                      )}
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
