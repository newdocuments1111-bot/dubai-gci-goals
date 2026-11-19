import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { getMetaAdsReport, syncMetaAdsNow } from "@/lib/meta-ads.functions";
import {
  VERDICT_LABELS,
  adsManagerUrl,
  metaAdsReport,
  money,
  sortByMoneyBack,
  syncTimeLabel as syncTime,
  type MetaAdRow,
  type MetaLevel,
  type ReportLead,
  type Verdict,
} from "@/lib/meta-ads";

const PERIODS = [7, 30, 90] as const;
type Period = (typeof PERIODS)[number];
const LEVELS: { id: MetaLevel; label: string }[] = [
  { id: "campaign", label: "Campaigns" },
  { id: "adset", label: "Ad sets" },
  { id: "ad", label: "Ads" },
];
const VERDICT_STYLE: Record<Verdict, string> = {
  keep: "bg-primary/15 text-primary",
  watch: "bg-warning/15 text-warning-foreground",
  waste: "bg-destructive/15 text-destructive",
};
const SCORE_STYLE: Record<string, string> = {
  Hot: "bg-destructive/10 text-destructive",
  Warm: "bg-warning/15 text-warning-foreground",
  Cold: "bg-muted text-muted-foreground",
};
const toggle = (active: boolean) =>
  `rounded-md px-2.5 py-1 text-sm ${active ? "bg-background font-medium shadow" : "text-muted-foreground"}`;

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return (
    <span
      className={`whitespace-nowrap rounded px-1.5 text-[10px] font-bold uppercase ${VERDICT_STYLE[verdict]}`}
    >
      {VERDICT_LABELS[verdict]}
    </span>
  );
}

const pct = (n: number | null) => (n == null ? "—" : `${n}%`);
const back = (n: number | null) => (n == null ? "—" : String(n));

function Quality({ r }: { r: MetaAdRow }) {
  return (
    <span className="whitespace-nowrap text-xs">
      <span className="text-destructive">{r.hot} hot</span> · {r.warm} warm · {r.cold} cold
      {r.unscored > 0 && <span className="text-muted-foreground"> · {r.unscored} new</span>}
      {r.duplicates > 0 && <span className="text-muted-foreground"> · {r.duplicates} dup</span>}
    </span>
  );
}

/** Owner-only "Meta ads" tab on the Ads page. Reads synced numbers; never changes anything in Meta. */
export function MetaAdsSection() {
  const [days, setDays] = useState<Period>(30);
  const [level, setLevel] = useState<MetaLevel>("ad");
  const [direction, setDirection] = useState<"desc" | "asc">("desc");
  const [open, setOpen] = useState<MetaAdRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const client = useQueryClient();
  const sync = useServerFn(syncMetaAdsNow);
  const {
    data,
    isLoading,
    error: loadError,
  } = useQuery({
    queryKey: ["meta-ads-report", days],
    queryFn: () => getMetaAdsReport({ data: { days } }),
  });

  const report = useMemo(
    () =>
      data?.connection.connected
        ? metaAdsReport({
            level,
            since: data.since,
            until: data.until,
            currency: data.connection.currency,
            insights: data.insights,
            leads: data.leads,
            viewings: data.viewings,
            deals: data.deals,
            hits: data.hits,
          })
        : null,
    [data, level],
  );
  const rows = useMemo(
    () => (report ? sortByMoneyBack(report.rows, direction) : []),
    [report, direction],
  );
  const leadsById = useMemo(
    () => new Map<string, ReportLead>((data?.leads ?? []).map((l) => [l.id, l])),
    [data],
  );

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading Meta ads…</p>;
  if (loadError || !data)
    return (
      <p role="alert" className="text-sm text-destructive">
        Could not load the Meta ads numbers.
      </p>
    );
  const c = data.connection;
  if (!c.connected)
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        {c.setupMissing
          ? "Meta ads needs a database update before it can be connected. Ask support to add it."
          : "Connect your Meta ad account to see spend, leads, deals and GCI per campaign, ad set and ad."}
        {!c.setupMissing && (
          <div className="mt-3">
            <Button asChild>
              <Link to="/settings">Connect in Settings</Link>
            </Button>
          </div>
        )}
      </div>
    );

  const currency = c.currency;
  const syncNow = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await sync();
      setMessage(`Synced ${r.rows} daily ad rows.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The sync failed.");
    } finally {
      await client.invalidateQueries({ queryKey: ["meta-ads-report"] });
      await client.invalidateQueries({ queryKey: ["meta-ads-connection"] });
      setBusy(false);
    }
  };
  const SortIcon = direction === "desc" ? ArrowDown : ArrowUp;
  const flip = () => setDirection(direction === "desc" ? "asc" : "desc");
  const metaLink = (r: MetaAdRow) => adsManagerUrl(c.adAccountId, r.level, r.id);
  const t = report?.totals;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          <span className="rounded bg-primary/15 px-1.5 text-[10px] font-bold uppercase text-primary">
            Connected
          </span>{" "}
          {c.accountName || c.adAccountId} · last sync {syncTime(c.lastSyncAt)}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={() => void syncNow()}>
            <RefreshCw className="size-4" />
            {busy ? "Syncing…" : "Sync now"}
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={adsManagerUrl(c.adAccountId)} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
              Open in Meta Ads Manager
            </a>
          </Button>
        </div>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        The CRM only reads from Meta. It does not change, pause or create ads; any budget move is
        yours to make in Meta Ads Manager. Leads, viewings, deals and GCI come from the CRM: a lead
        counts for an ad when it arrived with that ad's id.
      </p>
      {c.lastSyncOk === false && c.lastSyncMessage && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          Last sync failed: {c.lastSyncMessage}
        </p>
      )}
      {message && (
        <p role="status" className="mb-3 text-sm">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        <div className="inline-flex rounded-lg bg-muted p-1">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              className={toggle(level === l.id)}
              onClick={() => setLevel(l.id)}
            >
              {l.label}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-lg bg-muted p-1">
          {PERIODS.map((p) => (
            <button key={p} type="button" className={toggle(days === p)} onClick={() => setDays(p)}>
              {p} days
            </button>
          ))}
        </div>
      </div>

      {currency !== "AED" && (
        <p className="mb-3 rounded-md bg-muted p-2 text-xs">
          Spend is in {currency}, as in your Meta ad account. GCI is in AED. The CRM does not
          convert currencies, so money back is AED of GCI per {currency} 1 spent and no ad is called
          wasting money on spend alone.
        </p>
      )}

      {report?.suggestion && (
        <section className="mb-3 rounded-lg border border-border p-3 text-sm">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Move budget
          </p>
          {report.suggestion.text}
        </section>
      )}

      {t && rows.length > 0 && (
        <p className="mb-3 text-sm">
          {data.since} to {data.until}: {money(t.spend, currency)} spent · {t.leads} leads
          {t.costPerLead != null && ` (${money(t.costPerLead, currency)} each)`} ·{" "}
          {pct(t.replyRatePct)} replied · {t.viewings} viewings · {t.deals} deals ·{" "}
          {money(t.gci, "AED")} GCI · money back {back(t.moneyBack)}
        </p>
      )}
      {(data.untagged > 0 || (report?.unmatchedLeads ?? 0) > 0) && (
        <p className="mb-3 text-xs text-muted-foreground">
          {data.untagged > 0 &&
            `${data.untagged} Facebook/Instagram leads in this period came without an ad id, so they are not in this table. `}
          {(report?.unmatchedLeads ?? 0) > 0 &&
            `${report?.unmatchedLeads} leads with a Meta id could not be placed at this level.`}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No Meta spend or Meta leads in this period yet. Press Sync now after your ads have run.
        </p>
      ) : (
        <>
          {/* Phones: one card per row. The full table stays from `md` up. */}
          <div className="mb-2 flex justify-end md:hidden">
            <Button size="sm" variant="ghost" onClick={flip}>
              Money back <SortIcon className="size-3.5" />
            </Button>
          </div>
          <ul className="space-y-3 md:hidden">
            {rows.map((r) => (
              <li key={r.id} className="rounded-lg border border-border p-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-semibold">{r.name}</p>
                    {r.parent && (
                      <p className="truncate text-xs text-muted-foreground">{r.parent}</p>
                    )}
                  </div>
                  <VerdictBadge verdict={r.verdict} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{r.reason}</p>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">Spend</dt>
                  <dd>{money(r.spend, currency)}</dd>
                  <dt className="text-muted-foreground">Leads</dt>
                  <dd>
                    {r.leads}
                    <span className="text-muted-foreground"> (Meta {r.metaLeads})</span>
                  </dd>
                  <dt className="text-muted-foreground">Cost per lead</dt>
                  <dd>{money(r.costPerLead, currency)}</dd>
                  <dt className="text-muted-foreground">Replied</dt>
                  <dd>{pct(r.replyRatePct)}</dd>
                  <dt className="text-muted-foreground">Viewings</dt>
                  <dd>{r.viewings}</dd>
                  <dt className="text-muted-foreground">Deals</dt>
                  <dd>{r.deals}</dd>
                  <dt className="text-muted-foreground">GCI</dt>
                  <dd>{money(r.gci, "AED")}</dd>
                  <dt className="text-muted-foreground">Money back</dt>
                  <dd>{back(r.moneyBack)}</dd>
                </dl>
                <div className="mt-2">
                  <Quality r={r} />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={r.leads === 0}
                    onClick={() => setOpen(r)}
                  >
                    Open leads
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <a href={metaLink(r)} target="_blank" rel="noreferrer">
                      Open in Meta
                    </a>
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="p-2">
                    {LEVELS.find((l) => l.id === level)?.label.replace(/s$/, "")}
                  </th>
                  <th>Verdict</th>
                  <th>Spend</th>
                  <th>Leads</th>
                  <th>Cost / lead</th>
                  <th>Replied</th>
                  <th>Viewings</th>
                  <th>Deals</th>
                  <th>GCI</th>
                  <th>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-medium text-foreground"
                      onClick={flip}
                      title={report?.moneyBackLabel}
                    >
                      Money back <SortIcon className="size-3.5" />
                    </button>
                  </th>
                  <th>Quality</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td className="max-w-[240px] p-2">
                      <div className="break-words font-medium">{r.name}</div>
                      {r.parent && (
                        <div className="truncate text-xs text-muted-foreground">{r.parent}</div>
                      )}
                    </td>
                    <td className="max-w-[260px] py-2 pe-2">
                      <VerdictBadge verdict={r.verdict} />
                      <div className="text-xs text-muted-foreground">{r.reason}</div>
                    </td>
                    <td className="py-2">{money(r.spend, currency)}</td>
                    <td className="py-2">
                      {r.leads}
                      <div className="text-xs text-muted-foreground">Meta {r.metaLeads}</div>
                    </td>
                    <td className="py-2">{money(r.costPerLead, currency)}</td>
                    <td className="py-2">{pct(r.replyRatePct)}</td>
                    <td className="py-2">{r.viewings}</td>
                    <td className="py-2">{r.deals}</td>
                    <td className="py-2">{money(r.gci, "AED")}</td>
                    <td className="py-2 font-medium">{back(r.moneyBack)}</td>
                    <td className="py-2">
                      <Quality r={r} />
                    </td>
                    <td className="py-2 pe-2 text-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={r.leads === 0}
                        onClick={() => setOpen(r)}
                      >
                        Open leads
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={metaLink(r)} target="_blank" rel="noreferrer">
                          Meta
                        </a>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="p-2 text-xs text-muted-foreground">
              Money back = {report?.moneyBackLabel}. Leads = CRM leads that arrived with the ad's id
              (Meta's own count underneath). Deals and GCI are closed deals of those leads.
            </p>
          </div>
        </>
      )}

      {open && (
        <Dialog
          open
          onOpenChange={(o) => {
            if (!o) setOpen(null);
          }}
        >
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
            <DialogTitle>Leads from {open.name}</DialogTitle>
            <DialogDescription>
              {open.leads} leads from {data.since} to {data.until}.
            </DialogDescription>
            <ul className="divide-y divide-border text-sm">
              {open.leadIds.map((id) => {
                const l = leadsById.get(id);
                return (
                  <li key={id} className="flex items-center justify-between gap-3 py-2">
                    <Link
                      className="min-w-0 truncate underline"
                      to="/lead/$leadId"
                      params={{ leadId: id }}
                    >
                      {l?.name || "Lead"}
                    </Link>
                    <span className="flex shrink-0 items-center gap-2 text-xs">
                      {l?.score && (
                        <span className={`rounded px-1.5 ${SCORE_STYLE[l.score] ?? ""}`}>
                          {l.score}
                        </span>
                      )}
                      <span className="text-muted-foreground">
                        {l?.client_replied ? "Client replied" : "No reply from client"}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
