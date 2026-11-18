import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Copy, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  addCheque,
  deleteCheque,
  deleteOwner,
  emptyOwner,
  getSellerBoard,
  linkListingOwner,
  saveOwner,
  setChequeStatus,
  setOwnerStage,
  type OwnerInput,
} from "@/lib/owners.functions";
import { useLang } from "@/hooks/use-lang";
import {
  SELLER_STAGES,
  chequeState,
  chequesNeedingAction,
  leaseStatus,
  ownerUpdate,
  type SellerStage,
} from "@/lib/sellers";
import { draftSellerMessage, type ReasonPart } from "@/lib/seller-finder";

const boardQuery = queryOptions({ queryKey: ["owners"], queryFn: () => getSellerBoard() });

export const Route = createFileRoute("/_authenticated/owners")({
  head: () => ({
    meta: [
      { title: "Owners — Dubai AI GCI" },
      {
        name: "description",
        content: "Sellers and landlords: win the listing, report to the owner, track rent cheques.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(boardQuery),
  component: OwnersPage,
});

type Board = Awaited<ReturnType<typeof getSellerBoard>>;
type Owner = Board["owners"][number];
const selectCls = "h-9 rounded-md border border-input bg-background px-2 text-sm";
const aed = (n: number) => `AED ${Math.round(n).toLocaleString("en-US")}`;
const TONE = {
  late: "bg-destructive/10 text-destructive",
  soon: "bg-warning/15 text-warning-foreground",
  ok: "bg-muted text-muted-foreground",
} as const;
type T = ReturnType<typeof useLang>["t"];
/** The lease line in the app language (same wording as leaseStatus in English). */
const leaseText = (days: number, t: T) =>
  days < 0
    ? days === -1
      ? t("Lease ended 1 day ago")
      : t("Lease ended {n} days ago", { n: -days })
    : days <= 90
      ? days === 1
        ? t("Lease ends in 1 day: talk renewal now")
        : t("Lease ends in {n} days: talk renewal now", { n: days })
      : t("Lease ends in {n} days", { n: days });
/** The cheque badge in the app language: "Overdue 3 d", "Due in 5 d", or a fixed status. */
const chequeText = (label: string, t: T) => {
  const overdue = /^Overdue (\d+) d$/.exec(label);
  if (overdue) return t("Overdue {n} d", { n: overdue[1] ?? "" });
  const dueIn = /^Due in (\d+) d$/.exec(label);
  if (dueIn) return t("Due in {n} d", { n: dueIn[1] ?? "" });
  return t(label);
};
const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" });

function OwnersPage() {
  const { t } = useLang();
  const { data } = useSuspenseQuery(boardQuery);
  const client = useQueryClient();
  const stage = useServerFn(setOwnerStage);
  const [tab, setTab] = useState<"pipeline" | "rentals">("pipeline");
  const [editing, setEditing] = useState<(OwnerInput & { id?: string }) | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");
  const refresh = () => client.invalidateQueries({ queryKey: ["owners"] });
  const run = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Something went wrong."));
    }
  };
  const due = chequesNeedingAction(data.cheques);
  const renewals = data.owners.filter(
    (o) => leaseStatus(o.lease_end)?.tone !== "ok" && o.lease_end,
  );
  const landlords = data.owners.filter(
    (o) => o.intent === "rent" || o.lease_end || data.cheques.some((c) => c.owner_id === o.id),
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Owners")}</h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "Sellers and landlords. Win the listing, keep the owner updated, and track rent cheques and renewals.",
            )}
          </p>
        </div>
        <Button onClick={() => setEditing(emptyOwner())}>
          <Plus className="size-4" />
          {t("Add owner")}
        </Button>
      </div>

      <div
        role="tablist"
        aria-label={t("Owners view")}
        className="mb-4 inline-flex rounded-lg border border-border p-1 text-sm"
      >
        {(
          [
            ["pipeline", t("Listing pipeline ({n})", { n: data.owners.length })],
            [
              "rentals",
              due.length + renewals.length
                ? t("Rentals · {n} need you", { n: due.length + renewals.length })
                : t("Rentals"),
            ],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`rounded-md px-3 py-1.5 ${tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {tab === "pipeline" && (
        <LikelyToSell
          data={data}
          openOwner={(id) => {
            setOpen(id);
            document.getElementById(`owner-${id}`)?.scrollIntoView({ block: "center" });
          }}
        />
      )}

      {tab === "pipeline" ? (
        data.owners.length === 0 ? (
          <Empty text={t("No owners yet. Add the owners you want to win listings from.")} />
        ) : (
          <div className="space-y-5">
            {SELLER_STAGES.map((s) => {
              const owners = data.owners.filter((o) => o.stage === s.id);
              if (owners.length === 0) return null;
              return (
                <section key={s.id} aria-label={t(s.label)}>
                  <h2 className="mb-2 text-sm font-semibold">
                    {t(s.label)}{" "}
                    <span className="font-normal text-muted-foreground">
                      ({owners.length}) · {t(s.hint)}
                    </span>
                  </h2>
                  <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
                    {owners.map((o) => (
                      <li key={o.id} id={`owner-${o.id}`} className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                          <button
                            type="button"
                            className="min-w-0 flex-1 basis-56 text-start"
                            onClick={() => setOpen(open === o.id ? null : o.id)}
                          >
                            <span className="font-medium">{o.name}</span>
                            <span className="ms-2 text-xs text-muted-foreground">
                              {o.intent === "sell"
                                ? t("Selling")
                                : o.intent === "rent"
                                  ? t("Renting out")
                                  : t(o.kind)}
                            </span>
                            <span className="block truncate text-sm text-muted-foreground">
                              {[
                                o.building,
                                o.area,
                                o.asking_price_aed ? aed(o.asking_price_aed) : null,
                              ]
                                .filter(Boolean)
                                .join(" · ") || t("No property details yet")}
                            </span>
                          </button>
                          {o.next_action_on && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs ${o.next_action_on < todayIso() ? TONE.late : TONE.ok}`}
                            >
                              {t("Next: {date}", { date: o.next_action_on })}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {t("{n} listing(s)", {
                              n: data.listings.filter((l) => l.owner_id === o.id).length,
                            })}
                          </span>
                          <select
                            aria-label={t("Stage for {name}", { name: o.name })}
                            className={selectCls}
                            value={o.stage}
                            onChange={(e) =>
                              void run(() =>
                                stage({ data: { id: o.id, stage: e.target.value as SellerStage } }),
                              )
                            }
                          >
                            {SELLER_STAGES.map((x) => (
                              <option key={x.id} value={x.id}>
                                {t(x.label)}
                              </option>
                            ))}
                          </select>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditing(toInput(o))}
                          >
                            {t("Edit")}
                          </Button>
                        </div>
                        {open === o.id && <OwnerDetail owner={o} data={data} run={run} />}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )
      ) : (
        <Rentals data={data} landlords={landlords} due={due} run={run} />
      )}

      {editing && <OwnerDialog editing={editing} setEditing={setEditing} onSaved={refresh} />}
    </main>
  );
}

const toInput = (o: Owner): OwnerInput & { id: string } => ({
  id: o.id,
  name: o.name,
  phone: o.phone,
  agreed_to_updates: o.agreed_to_updates,
  handover_date: o.handover_date,
  kind: o.kind as "owner" | "investor",
  update_frequency: o.update_frequency as "quarterly" | "monthly",
  area: o.area,
  building: o.building,
  lease_end: o.lease_end,
  stage: o.stage as SellerStage,
  intent: o.intent as "sell" | "rent" | "unknown",
  asking_price_aed: o.asking_price_aed,
  next_action_on: o.next_action_on,
  notes: o.notes,
  tenant_name: o.tenant_name,
  annual_rent_aed: o.annual_rent_aed,
});

/** A reason in the app language, with its date written in that language too. */
const reasonText = (p: ReasonPart, t: T, lang: string) =>
  t(
    p.text,
    p.date
      ? {
          ...p.vars,
          when: new Date(`${p.date}T00:00:00Z`).toLocaleDateString(
            lang === "ar" ? "ar-AE" : "en-GB",
            {
              timeZone: "UTC",
              year: "numeric",
              month: "long",
              ...(p.dateStyle === "day" ? { day: "numeric" as const } : {}),
            },
          ),
        }
      : p.vars,
  );

/** Seller Finder: owners and past buyers who may be ready to sell or list. The agent copies the message; nothing is sent. */
function LikelyToSell({ data, openOwner }: { data: Board; openOwner: (id: string) => void }) {
  const { t, lang } = useLang();
  const [copied, setCopied] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const shown = all ? data.likely : data.likely.slice(0, 8);
  return (
    <section aria-labelledby="likely-to-sell" className="mb-6">
      <h2 id="likely-to-sell" className="text-sm font-semibold">
        {t("Likely to sell")}{" "}
        <span className="font-normal text-muted-foreground">({data.likely.length})</span>
      </h2>
      <p className="mb-2 text-sm text-muted-foreground">
        {t("From your own deals and owners. Nothing is sent for you.")}
      </p>
      {!data.likelyComplete && (
        <p role="status" className="mb-2 text-sm text-warning-foreground">
          {t("Some past deals could not be read, so people may be missing from this list.")}
        </p>
      )}
      {data.likely.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-background px-4 py-3 text-sm text-muted-foreground">
          {t("No one to suggest right now.")}
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
          {shown.map((c) => {
            const key = `${c.kind}-${c.id}`;
            const text = draftSellerMessage(c, data.agentName);
            return (
              <li key={key} className="px-4 py-3">
                <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1 basis-56">
                    {c.kind === "owner" ? (
                      <button
                        type="button"
                        className="font-medium underline-offset-2 hover:underline"
                        onClick={() => openOwner(c.id)}
                      >
                        {c.name}
                      </button>
                    ) : (
                      <Link
                        to="/lead/$leadId"
                        params={{ leadId: c.id }}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {c.name || t("No name")}
                      </Link>
                    )}
                    <span className="ms-2 text-xs text-muted-foreground">{t(c.kind)}</span>
                    {c.unitLabel && (
                      <span className="block truncate text-sm text-muted-foreground">
                        {c.unitLabel}
                      </span>
                    )}
                    <ul className="mt-1 list-disc ps-5 text-sm">
                      {c.reasonParts.map((p) => (
                        <li key={p.kind}>{reasonText(p, t, lang)}</li>
                      ))}
                    </ul>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${c.score === "High" ? "bg-primary/10 font-medium text-primary" : TONE.ok}`}
                  >
                    {t(c.score)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(text);
                        setFailed(null);
                        setCopied(key);
                      } catch {
                        setCopied(null);
                        setFailed(key);
                      }
                    }}
                  >
                    <Copy className="size-4" />
                    {copied === key ? t("Copied") : t("Copy message")}
                  </Button>
                </div>
                {failed === key && (
                  <p role="alert" className="mt-2 text-xs text-destructive">
                    {t("Could not copy. Open the message below and copy it by hand.")}
                  </p>
                )}
                <details className="mt-2" open={failed === key ? true : undefined}>
                  <summary className="cursor-pointer text-xs font-medium">
                    {t("See the message")}
                  </summary>
                  <pre
                    dir="ltr"
                    lang="en"
                    className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3 text-start font-sans text-xs"
                  >
                    {text}
                  </pre>
                </details>
              </li>
            );
          })}
        </ul>
      )}
      {!all && data.likely.length > shown.length && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setAll(true)}>
          {t("Show all ({n})", { n: data.likely.length })}
        </Button>
      )}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
      {text}
    </p>
  );
}

type Run = (fn: () => Promise<unknown>) => Promise<void>;

function OwnerDetail({ owner, data, run }: { owner: Owner; data: Board; run: Run }) {
  const { t } = useLang();
  const link = useServerFn(linkListingOwner);
  const mine = data.listings.filter((l) => l.owner_id === owner.id);
  const free = data.listings.filter((l) => !l.owner_id);
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <div className="mt-3 space-y-3 rounded-lg bg-muted/40 p-3 text-sm">
      {owner.notes && <p className="whitespace-pre-wrap text-muted-foreground">{owner.notes}</p>}
      {mine.length === 0 && (
        <p className="text-muted-foreground">{t("No listing linked to this owner yet.")}</p>
      )}
      {mine.map((l) => {
        const text = ownerUpdate(owner.name, l, data.agentName);
        return (
          <div key={l.id} className="rounded-lg border border-border bg-background p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/listing/$listingId"
                params={{ listingId: l.id }}
                className="font-medium hover:underline"
              >
                {l.title}
              </Link>
              <span className="text-xs text-muted-foreground">
                {t(
                  "{status} · {price} · {done} viewings done · {booked} booked · {buyers} matching buyers",
                  {
                    status: t(l.status),
                    price: aed(l.price_aed),
                    done: l.viewingsDone,
                    booked: l.viewingsBooked,
                    buyers: l.matchingBuyers,
                  },
                )}
              </span>
              <button
                type="button"
                className="ms-auto text-xs text-muted-foreground underline"
                onClick={() => void run(() => link({ data: { listingId: l.id, ownerId: null } }))}
              >
                {t("Unlink")}
              </button>
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-medium">
                {t("Owner update to copy")}
              </summary>
              <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{text}</pre>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={async () => {
                  await navigator.clipboard.writeText(text);
                  setCopied(l.id);
                }}
              >
                <Copy className="size-4" />
                {copied === l.id ? t("Copied") : t("Copy update")}
              </Button>
              <span className="ms-2 text-xs text-muted-foreground">
                {t("Nothing is sent from here. Paste it into WhatsApp or email.")}
              </span>
            </details>
          </div>
        );
      })}
      {free.length > 0 && (
        <label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {t("Link a listing")}
          <select
            className={selectCls}
            value=""
            onChange={(e) =>
              e.target.value &&
              void run(() => link({ data: { listingId: e.target.value, ownerId: owner.id } }))
            }
          >
            <option value="">{t("Choose…")}</option>
            {free.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

function Rentals({
  data,
  landlords,
  due,
  run,
}: {
  data: Board;
  landlords: Owner[];
  due: Board["cheques"];
  run: Run;
}) {
  const { t } = useLang();
  const add = useServerFn(addCheque);
  const status = useServerFn(setChequeStatus);
  const remove = useServerFn(deleteCheque);
  const [ownerId, setOwnerId] = useState(landlords[0]?.id ?? data.owners[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [first, setFirst] = useState(todayIso());
  const [count, setCount] = useState("4");
  const [every, setEvery] = useState("3");
  const [no, setNo] = useState("");
  const ownerName = (id: string) => data.owners.find((o) => o.id === id)?.name ?? t("Owner");
  if (data.owners.length === 0)
    return (
      <Empty text={t("Add a landlord first, then track their lease and rent cheques here.")} />
    );
  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-background p-4">
        <h2 className="mb-2 font-semibold">{t("Needs you ({n})", { n: due.length })}</h2>
        {due.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("No cheque is bounced, overdue or due this week.")}
          </p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {due.map((c) => (
              <ChequeRow
                key={c.id}
                c={c}
                owner={ownerName(c.owner_id)}
                onStatus={(s) => void run(() => status({ data: { id: c.id, status: s } }))}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">{t("Leases")}</h2>
        {landlords.length === 0 ? (
          <Empty
            text={t('No landlords yet. Edit an owner and set "Renting out" or a lease end date.')}
          />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
            {landlords.map((o) => {
              const lease = leaseStatus(o.lease_end);
              const cheques = data.cheques.filter((c) => c.owner_id === o.id);
              return (
                <li key={o.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="min-w-0 flex-1 basis-56">
                      <span className="font-medium">{o.name}</span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {[
                          o.building,
                          o.area,
                          o.tenant_name && t("Tenant: {name}", { name: o.tenant_name }),
                          o.annual_rent_aed
                            ? t("{amount} a year", { amount: aed(o.annual_rent_aed) })
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || t("No details yet")}
                      </span>
                    </span>
                    {lease ? (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[lease.tone]}`}
                      >
                        {leaseText(lease.days, t)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {t("No lease end date")}
                      </span>
                    )}
                  </div>
                  {cheques.length > 0 && (
                    <ul className="mt-2 divide-y divide-border rounded-lg border border-border text-sm">
                      {cheques.map((c) => (
                        <ChequeRow
                          key={c.id}
                          c={c}
                          onStatus={(s) =>
                            void run(() => status({ data: { id: c.id, status: s } }))
                          }
                          onDelete={() =>
                            window.confirm(t("Remove this cheque?")) &&
                            void run(() => remove({ data: c.id }))
                          }
                        />
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-background p-4">
        <h2 className="mb-2 font-semibold">{t("Add rent cheques")}</h2>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(amount.replace(/[^\d.]/g, ""));
            if (!n || !ownerId) return;
            void run(async () => {
              await add({
                data: {
                  ownerId,
                  amount_aed: n,
                  first_due: first,
                  count: Number(count),
                  every_months: Number(every),
                  cheque_no: no,
                },
              });
              setAmount("");
              setNo("");
            });
          }}
        >
          <label className="text-sm">
            {t("Landlord")}
            <select
              className={`${selectCls} mt-1 block w-48`}
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
            >
              {data.owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            {t("Each cheque (AED)")}
            <Input
              className="mt-1 h-9 w-32"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label className="text-sm">
            {t("First due")}
            <Input
              className="mt-1 h-9 w-40"
              type="date"
              value={first}
              onChange={(e) => setFirst(e.target.value)}
            />
          </label>
          <label className="text-sm">
            {t("How many")}
            <select
              className={`${selectCls} mt-1 block`}
              value={count}
              onChange={(e) => setCount(e.target.value)}
            >
              {[1, 2, 3, 4, 6, 12].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            {t("Every")}
            <select
              className={`${selectCls} mt-1 block`}
              value={every}
              onChange={(e) => setEvery(e.target.value)}
            >
              {[1, 2, 3, 4, 6, 12].map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? t("1 month") : t("{n} months", { n })}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            {t("First cheque no.")}
            <Input
              className="mt-1 h-9 w-32"
              maxLength={60}
              value={no}
              onChange={(e) => setNo(e.target.value)}
            />
          </label>
          <Button type="submit" size="sm" className="h-9" disabled={!amount.trim() || !ownerId}>
            {t("Add")}
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          {t(
            "You get an alert in the bell 3 days before each cheque is due. Lease renewals show here 90 days before the end date.",
          )}
        </p>
      </section>
    </div>
  );
}

function ChequeRow({
  c,
  owner,
  onStatus,
  onDelete,
}: {
  c: Board["cheques"][number];
  owner?: string;
  onStatus: (s: "pending" | "deposited" | "cleared" | "bounced") => void;
  onDelete?: () => void;
}) {
  const { t } = useLang();
  const st = chequeState(c);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
      <span className="min-w-0 flex-1">
        {owner && <span className="font-medium">{owner} · </span>}
        {aed(c.amount_aed)}{" "}
        <span className="text-muted-foreground">
          · {c.due_date}
          {c.cheque_no && ` · ${t("no. {no}", { no: c.cheque_no })}`}
        </span>
      </span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE[st.tone]}`}>
        {chequeText(st.label, t)}
      </span>
      <select
        aria-label={t("Cheque status")}
        className={selectCls}
        value={c.status}
        onChange={(e) => onStatus(e.target.value as "pending")}
      >
        <option value="pending">{t("Pending")}</option>
        <option value="deposited">{t("Deposited")}</option>
        <option value="cleared">{t("Cleared")}</option>
        <option value="bounced">{t("Bounced")}</option>
      </select>
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={t("Remove cheque")}
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </Button>
      )}
    </li>
  );
}

function OwnerDialog({
  editing,
  setEditing,
  onSaved,
}: {
  editing: OwnerInput & { id?: string };
  setEditing: (v: (OwnerInput & { id?: string }) | null) => void;
  onSaved: () => void;
}) {
  const { t } = useLang();
  const save = useServerFn(saveOwner);
  const del = useServerFn(deleteOwner);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof OwnerInput>(key: K, value: OwnerInput[K]) =>
    setEditing({ ...editing, [key]: value });
  const num = (s: string) => (s.trim() ? Number(s.replace(/[^\d.]/g, "")) || 0 : null);
  return (
    <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogTitle>{editing.id ? t("Edit owner") : t("Add owner")}</DialogTitle>
        <DialogDescription>
          {t("Only owners who agreed to updates receive messages.")}
        </DialogDescription>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            {t("Name")}
            <Input
              className="mt-1"
              maxLength={200}
              value={editing.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </label>
          <label className="text-sm">
            {t("Phone")}
            <Input
              className="mt-1"
              maxLength={50}
              value={editing.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </label>
          <label className="text-sm">
            {t("Area")}
            <Input
              className="mt-1"
              maxLength={200}
              value={editing.area}
              onChange={(e) => set("area", e.target.value)}
            />
          </label>
          <label className="text-sm">
            {t("Building")}
            <Input
              className="mt-1"
              maxLength={200}
              value={editing.building}
              onChange={(e) => set("building", e.target.value)}
            />
          </label>
          <label className="text-sm">
            {t("They want to")}
            <select
              className={`${selectCls} mt-1 block w-full`}
              value={editing.intent}
              onChange={(e) => set("intent", e.target.value as OwnerInput["intent"])}
            >
              <option value="unknown">{t("Not sure yet")}</option>
              <option value="sell">{t("Sell")}</option>
              <option value="rent">{t("Rent out")}</option>
            </select>
          </label>
          <label className="text-sm">
            {t("Stage")}
            <select
              className={`${selectCls} mt-1 block w-full`}
              value={editing.stage}
              onChange={(e) => set("stage", e.target.value as SellerStage)}
            >
              {SELLER_STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {t(s.label)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            {t("Asking price (AED)")}
            <Input
              className="mt-1"
              inputMode="decimal"
              value={editing.asking_price_aed ?? ""}
              onChange={(e) => set("asking_price_aed", num(e.target.value))}
            />
          </label>
          <label className="text-sm">
            {t("Next action date")}
            <Input
              className="mt-1"
              type="date"
              value={editing.next_action_on ?? ""}
              onChange={(e) => set("next_action_on", e.target.value || null)}
            />
          </label>
          <label className="text-sm">
            {t("Tenant name (if rented)")}
            <Input
              className="mt-1"
              maxLength={200}
              value={editing.tenant_name}
              onChange={(e) => set("tenant_name", e.target.value)}
            />
          </label>
          <label className="text-sm">
            {t("Annual rent (AED)")}
            <Input
              className="mt-1"
              inputMode="decimal"
              value={editing.annual_rent_aed ?? ""}
              onChange={(e) => set("annual_rent_aed", num(e.target.value))}
            />
          </label>
          <label className="text-sm">
            {t("Lease end")}
            <Input
              className="mt-1"
              type="date"
              value={editing.lease_end ?? ""}
              onChange={(e) => set("lease_end", e.target.value || null)}
            />
          </label>
          <label className="text-sm">
            {t("Handover date")}
            <Input
              className="mt-1"
              type="date"
              value={editing.handover_date ?? ""}
              onChange={(e) => set("handover_date", e.target.value || null)}
            />
          </label>
          <label className="text-sm">
            {t("Type")}
            <select
              className={`${selectCls} mt-1 block w-full`}
              value={editing.kind}
              onChange={(e) => set("kind", e.target.value as "owner" | "investor")}
            >
              <option value="owner">{t("Owner-occupier")}</option>
              <option value="investor">{t("Investor")}</option>
            </select>
          </label>
          <label className="text-sm">
            {t("Update frequency")}
            <select
              className={`${selectCls} mt-1 block w-full`}
              value={editing.update_frequency}
              onChange={(e) => set("update_frequency", e.target.value as "quarterly" | "monthly")}
            >
              <option value="quarterly">{t("Every 3 months")}</option>
              <option value="monthly">{t("Monthly")}</option>
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            {t("Notes")}
            <Textarea
              className="mt-1"
              rows={2}
              maxLength={2000}
              value={editing.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={editing.agreed_to_updates}
              onChange={(e) => set("agreed_to_updates", e.target.checked)}
            />
            {t("Agreed to updates")}
          </label>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          {editing.id ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                if (
                  !window.confirm(
                    t("Delete {name}? Their rent cheques are deleted too.", { name: editing.name }),
                  )
                )
                  return;
                await del({ data: editing.id as string });
                setEditing(null);
                onSaved();
              }}
            >
              <Trash2 className="size-4" />
              {t("Delete")}
            </Button>
          ) : (
            <span />
          )}
          <Button
            disabled={busy || !editing.name.trim()}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await save({ data: editing });
                setEditing(null);
                onSaved();
              } catch {
                setError(t("Could not save the owner."));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Save className="size-4" />
            {busy ? t("Saving…") : t("Save owner")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
