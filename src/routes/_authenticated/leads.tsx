import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Bookmark, Download, Search, SlidersHorizontal, Upload, X } from "lucide-react";
import { leadsCsv, downloadCsv } from "@/lib/chat-extras";
import { listLeads } from "@/lib/leads-app.functions";
import { getDealOptions } from "@/lib/deals.functions";
import { deleteList, getSavedLists, saveList } from "@/lib/leadtools.functions";
import { logListExport } from "@/lib/records.functions";
import { memberName } from "@/lib/agency";
import { LEAD_SOURCES } from "@/lib/inbox";
import {
  EMPTY_FILTER,
  STEP_RANGES,
  applyFilter,
  isFiltered,
  suggestName,
  type LeadFilter,
} from "@/lib/lists";
import { useMembership } from "@/hooks/use-membership";
import { useLang } from "@/hooks/use-lang";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const leadsQuery = queryOptions({ queryKey: ["leads"], queryFn: () => listLeads() });
const listsQuery = queryOptions({ queryKey: ["saved-lists"], queryFn: () => getSavedLists() });

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({
    meta: [
      { title: "Leads — Dubai AI GCI" },
      {
        name: "description",
        content: "Every lead with score, source and step. Filter and save your own lists.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(leadsQuery),
  component: LeadsPage,
});

const SCORE_STYLE = {
  Hot: "bg-destructive/10 text-destructive",
  Warm: "bg-warning/15 text-warning-foreground",
  Cold: "bg-muted text-muted-foreground",
} as const;
// Phones: 44px tall, two to a row. From `md` up: the usual 36px, as wide as their text.
const selectCls =
  "h-11 min-w-0 grow basis-[calc(50%-0.25rem)] rounded-md border border-input bg-background px-2 text-sm md:h-9 md:grow-0 md:basis-auto";

function LeadsPage() {
  const { data: leads } = useSuspenseQuery(leadsQuery);
  const { data: lists } = useQuery(listsQuery);
  const membership = useMembership();
  const { t } = useLang();
  const client = useQueryClient();
  const save = useServerFn(saveList);
  const remove = useServerFn(deleteList);
  const logExport = useServerFn(logListExport);
  const { data: options } = useQuery({
    queryKey: ["deal-options"],
    queryFn: () => getDealOptions(),
    enabled: membership.isOwner,
  });
  const [filter, setFilter] = useState<LeadFilter>(EMPTY_FILTER);
  const [activeList, setActiveList] = useState<string | null>(null);
  const [error, setError] = useState("");
  // Phones only: the filter selects stay folded away until asked for.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const set = (patch: Partial<LeadFilter>) => {
    setFilter({ ...filter, ...patch });
    setActiveList(null);
  };
  const shown = useMemo(() => applyFilter(leads, filter), [leads, filter]);
  const agentName = (id: string | null) =>
    id ? memberName(options?.members.find((m) => m.user_id === id)) : t("Pool");
  const refreshLists = () => client.invalidateQueries({ queryKey: ["saved-lists"] });

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Leads")}</h1>
          <p className="text-sm text-muted-foreground">
            {membership.isOwner ? t("All leads in your agency.") : t("Leads assigned to you.")}{" "}
            {t("Hot first.")}
          </p>
        </div>
        <div className="flex w-full gap-2 md:w-auto">
          <Button asChild variant="outline" size="sm" className="h-11 flex-1 md:h-8 md:flex-none">
            <Link to="/leads/import">
              <Upload className="size-4" />
              {t("Import")}
            </Link>
          </Button>
          {membership.isOwner && (
            <Button
              variant="outline"
              size="sm"
              className="h-11 flex-1 md:h-8 md:flex-none"
              onClick={async () => {
                setError("");
                try {
                  await logExport({ data: shown.length });
                  downloadCsv(leadsCsv(shown));
                } catch (e) {
                  setError(e instanceof Error ? e.message : t("Something went wrong."));
                }
              }}
            >
              <Download className="size-4" />
              {t("Export {n}", { n: shown.length })}
            </Button>
          )}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2" aria-label={t("My lists")}>
        <button
          type="button"
          onClick={() => {
            setFilter(EMPTY_FILTER);
            setActiveList(null);
          }}
          className={`rounded-full border px-3 py-3 text-sm md:py-1 ${!activeList && !isFiltered(filter) ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"}`}
        >
          {t("All open ({n})", { n: applyFilter(leads, EMPTY_FILTER).length })}
        </button>
        {(lists ?? []).map((l) => (
          <span
            key={l.id}
            className={`inline-flex items-center rounded-full border text-sm ${activeList === l.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"}`}
          >
            <button
              type="button"
              className="py-3 pe-1 ps-3 md:py-1"
              onClick={() => {
                setFilter(l.filters);
                setActiveList(l.id);
              }}
            >
              {l.name} ({applyFilter(leads, l.filters).length})
            </button>
            <button
              type="button"
              aria-label={t("Remove list {name}", { name: l.name })}
              className="flex min-h-11 items-center pe-3 ps-2 opacity-60 hover:opacity-100 md:min-h-0 md:py-1 md:pe-2 md:ps-1"
              onClick={async () => {
                if (
                  !window.confirm(t('Remove the list "{name}"? The leads stay.', { name: l.name }))
                )
                  return;
                await remove({ data: l.id });
                if (activeList === l.id) setActiveList(null);
                void refreshLists();
              }}
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background p-3">
        <div className="relative min-w-40 flex-1 md:min-w-48">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label={t("Search leads")}
            className="h-11 ps-8 md:h-9"
            placeholder={t("Name, phone, area or budget")}
            maxLength={100}
            value={filter.q}
            onChange={(e) => set({ q: e.target.value })}
          />
        </div>
        <button
          type="button"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((o) => !o)}
          className={`flex h-11 shrink-0 items-center gap-2 rounded-md border px-3 text-sm md:hidden ${filtersOpen || isFiltered({ ...filter, q: "" }) ? "border-primary text-primary" : "border-input text-muted-foreground"}`}
        >
          <SlidersHorizontal className="size-4" />
          {t("Filters")}
        </button>
        <div className={`${filtersOpen ? "contents" : "hidden"} md:contents`}>
          <select
            aria-label={t("Score")}
            className={selectCls}
            value={filter.score}
            onChange={(e) => set({ score: e.target.value as LeadFilter["score"] })}
          >
            <option value="">{t("Any score")}</option>
            <option value="Hot">{t("Hot")}</option>
            <option value="Warm">{t("Warm")}</option>
            <option value="Cold">{t("Cold")}</option>
          </select>
          <select
            aria-label={t("Source")}
            className={selectCls}
            value={filter.source}
            onChange={(e) => set({ source: e.target.value })}
          >
            <option value="">{t("Any source")}</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            aria-label={t("Step")}
            className={selectCls}
            value={filter.step}
            onChange={(e) => set({ step: e.target.value as LeadFilter["step"] })}
          >
            <option value="">{t("Any step")}</option>
            {Object.entries(STEP_RANGES).map(([k, v]) => (
              <option key={k} value={k}>
                {t(v.label)}
              </option>
            ))}
          </select>
          <select
            aria-label={t("Reply")}
            className={selectCls}
            value={filter.reply}
            onChange={(e) => set({ reply: e.target.value as LeadFilter["reply"] })}
          >
            <option value="">{t("Replied or not")}</option>
            <option value="waiting">{t("Not replied")}</option>
            <option value="replied">{t("Replied")}</option>
          </select>
          {membership.isOwner && (
            <select
              aria-label={t("Agent")}
              className={selectCls}
              value={filter.agent}
              onChange={(e) => set({ agent: e.target.value })}
            >
              <option value="">{t("Any agent")}</option>
              <option value="pool">{t("Pool (no agent)")}</option>
              {(options?.members ?? []).map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {memberName(m)}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label={t("Outcome")}
            className={selectCls}
            value={filter.outcome}
            onChange={(e) => set({ outcome: e.target.value as LeadFilter["outcome"] })}
          >
            <option value="open">{t("Open")}</option>
            <option value="not_now">{t("Not now")}</option>
            <option value="won">{t("Won")}</option>
            <option value="lost">{t("Lost")}</option>
            <option value="all">{t("All")}</option>
          </select>
        </div>
        {isFiltered(filter) && !activeList && (
          <Button
            variant="outline"
            size="sm"
            className="h-11 w-full md:h-9 md:w-auto"
            onClick={async () => {
              const name = window.prompt(t("Name this list"), suggestName(filter));
              if (!name?.trim()) return;
              setError("");
              try {
                await save({ data: { name: name.trim().slice(0, 60), filters: filter } });
                void refreshLists();
              } catch (e) {
                setError(e instanceof Error ? e.message : t("Could not save the list."));
              }
            }}
          >
            <Bookmark className="size-4" />
            {t("Save as list")}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {leads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center">
          <p className="font-medium">{t("No leads yet.")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("Add one with New lead at the top, or")}{" "}
            <Link to="/leads/import" className="underline">
              {t("import your list from Excel")}
            </Link>
            .
          </p>
        </div>
      ) : shown.length === 0 ? (
        <p className="rounded-xl border border-border bg-background p-6 text-sm text-muted-foreground">
          {t("No leads match these filters.")}
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
          {shown.slice(0, 300).map((lead) => (
            <li key={lead.id}>
              <Link
                to="/lead/$leadId"
                params={{ leadId: lead.id }}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1 basis-full md:basis-64">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{lead.name || t("Unnamed lead")}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${SCORE_STYLE[lead.score as keyof typeof SCORE_STYLE] ?? SCORE_STYLE.Cold}`}
                    >
                      {t(lead.score)}
                    </span>
                    {lead.flagged && (
                      <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning-foreground">
                        {t("Needs your confirmation")}
                      </span>
                    )}
                    {lead.stopped && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {t("Stopped")}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {[lead.area, lead.budget, lead.timing].filter(Boolean).join(" · ") ||
                      t("Nothing learned yet")}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground md:w-28 md:shrink-0">
                  {lead.source} · {lead.type}
                </span>
                <span className="min-w-0 truncate text-xs md:w-36 md:shrink-0">
                  {lead.stage_name ?? t("Step {n}", { n: lead.stage })}
                </span>
                {membership.isOwner && (
                  <span className="min-w-0 truncate text-xs text-muted-foreground md:w-28 md:shrink-0">
                    {agentName(lead.assigned_agent_id)}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {shown.length > 300 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("Showing the first 300 of {n}. Narrow the filters to see the rest.", {
            n: shown.length,
          })}
        </p>
      )}
    </main>
  );
}
