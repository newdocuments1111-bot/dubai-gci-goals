import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  cancelSale,
  holdUnit,
  releaseHold,
  saveUnit,
  sellUnit,
  type getProject,
} from "@/lib/developer.functions";
import {
  DEFAULT_HOLD_HOURS,
  MAX_HOLD_HOURS,
  UNIT_STATUS_LABEL,
  UNIT_TYPES,
  aed,
  bedroomsFromType,
  buildSchedule,
  commissionAed,
  dubaiToday,
  effectiveStatus,
  holdTimeLeft,
  isHoldActive,
  isSettled,
  longDate,
  planProblems,
  type UnitStatus,
} from "@/lib/developer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export type ProjectData = Awaited<ReturnType<typeof getProject>>;
type Mode = "view" | "edit" | "hold" | "sell";

const STATUS_CLASS: Record<UnitStatus, string> = {
  free: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  held: "bg-amber-500/20 text-amber-800 dark:text-amber-300",
  sold: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: UnitStatus }) {
  return (
    <span
      className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[status]}`}
    >
      {UNIT_STATUS_LABEL[status]}
    </span>
  );
}

const selectClass =
  "mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const num = (text: string) => (text.trim() === "" ? Number.NaN : Number(text.replace(/,/g, "")));
const when = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));

function Field({
  label,
  className = "",
  ...props
}: { label: string } & React.ComponentProps<typeof Input>) {
  return (
    <label className={`text-sm ${className}`}>
      {label}
      <Input className="mt-1 h-9" {...props} />
    </label>
  );
}

/**
 * One unit: details, and what can be done with it right now (hold, release, sell, edit).
 * `unitId` is "new" to add a unit. The parent gives this a key so it starts fresh for each unit.
 */
export function UnitDialog({
  data,
  unitId,
  now,
  onClose,
  refresh,
}: {
  data: ProjectData;
  unitId: string;
  now: Date;
  onClose: () => void;
  refresh: () => Promise<void>;
}) {
  const save = useServerFn(saveUnit);
  const hold = useServerFn(holdUnit);
  const release = useServerFn(releaseHold);
  const sell = useServerFn(sellUnit);
  const undoSale = useServerFn(cancelSale);

  const unit = data.units.find((u) => u.id === unitId) ?? null;
  const openHold = data.holds.find((h) => h.unit_id === unitId && isHoldActive(h, now)) ?? null;
  const sale = data.sales.find((s) => s.unit_id === unitId) ?? null;
  const status: UnitStatus = unit ? effectiveStatus(unit.status, openHold, now) : "free";
  const memberName = (id: string | null) =>
    data.members.find((m) => m.user_id === id)?.display_name || "a team member";

  const [mode, setMode] = useState<Mode>(unit ? "view" : "edit");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [details, setDetails] = useState({
    unit_number: unit?.unit_number ?? "",
    unit_type: unit?.unit_type ?? "1BR",
    bedrooms: unit ? String(unit.bedrooms) : "1",
    size_sqft: unit ? String(Number(unit.size_sqft)) : "",
    floor: unit?.floor ?? "",
    view: unit?.view ?? "",
    price_aed: unit ? String(Number(unit.price_aed)) : "",
  });
  const [holdForm, setHoldForm] = useState({
    client_name: "",
    client_phone: "",
    hours: String(DEFAULT_HOLD_HOURS),
    broker_name: "",
    broker_agency: "",
    broker_phone: "",
    notes: "",
  });
  const [saleForm, setSaleForm] = useState({
    buyer_name: "",
    buyer_phone: "",
    leadId: "",
    sale_price_aed: unit ? String(Number(unit.price_aed)) : "",
    sale_date: dubaiToday(now),
    broker_name: "",
    broker_agency: "",
    broker_phone: "",
    broker_commission_percent: "",
  });

  const run = async (fn: () => Promise<{ error?: string } | unknown>, closeAfter = true) => {
    setBusy(true);
    setError("");
    try {
      const result = (await fn()) as { error?: string } | undefined;
      if (result?.error) {
        setError(result.error);
        return;
      }
      await refresh();
      if (closeAfter) onClose();
      else setMode("view");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      // Someone else may have just taken the unit: show what is true now.
      void refresh();
    } finally {
      setBusy(false);
    }
  };

  const startSale = () => {
    // Converting a hold carries its client and broker over; both can still be changed.
    if (openHold)
      setSaleForm((f) => ({
        ...f,
        buyer_name: openHold.client_name,
        buyer_phone: openHold.client_phone,
        broker_name: openHold.broker_name,
        broker_agency: openHold.broker_agency,
        broker_phone: openHold.broker_phone,
      }));
    setError("");
    setMode("sell");
  };

  const price = num(saleForm.sale_price_aed);
  const planOk = planProblems(data.plan).length === 0;
  const preview =
    mode === "sell" && planOk && price > 0 && saleForm.sale_date
      ? buildSchedule(data.plan, {
          priceAed: price,
          saleDate: saleForm.sale_date,
          handoverDate: data.project.handover_date,
        })
      : [];
  const commissionPercent = num(saleForm.broker_commission_percent) || 0;
  const schedule = sale ? data.instalments.filter((i) => i.sale_id === sale.id) : [];
  const canRelease = Boolean(openHold && (data.isOwner || openHold.held_by === data.userId));

  const detailsValid =
    details.unit_number.trim() !== "" &&
    Number.isInteger(num(details.bedrooms)) &&
    num(details.bedrooms) >= 0 &&
    num(details.price_aed) >= 0 &&
    (details.size_sqft.trim() === "" || num(details.size_sqft) >= 0);
  const hours = num(holdForm.hours);
  const holdValid =
    holdForm.client_name.trim() !== "" &&
    Number.isInteger(hours) &&
    hours >= 1 &&
    hours <= MAX_HOLD_HOURS;
  const saleValid =
    saleForm.buyer_name.trim() !== "" &&
    price > 0 &&
    saleForm.sale_date !== "" &&
    commissionPercent >= 0 &&
    commissionPercent <= 100 &&
    planOk;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogTitle className="flex flex-wrap items-center gap-2">
          {unit ? `Unit ${unit.unit_number}` : "Add a unit"}
          {unit && <StatusBadge status={status} />}
        </DialogTitle>
        <DialogDescription>
          {unit
            ? [
                unit.unit_type,
                Number(unit.size_sqft) > 0
                  ? `${Number(unit.size_sqft).toLocaleString("en-US")} sq ft`
                  : "",
                unit.floor ? `Floor ${unit.floor}` : "",
                unit.view,
                aed(Number(unit.price_aed)),
              ]
                .filter(Boolean)
                .join(" · ")
            : `Units are added to ${data.project.name} as free.`}
        </DialogDescription>

        {mode === "view" && unit && (
          <div className="space-y-4 text-sm">
            {status === "held" && openHold && (
              <div className="space-y-1 rounded-md bg-amber-500/10 p-3">
                <p className="font-medium">
                  Held for {openHold.client_name}
                  {openHold.client_phone ? ` (${openHold.client_phone})` : ""}
                </p>
                <p>
                  {holdTimeLeft(openHold.expires_at, now)} · until {when(openHold.expires_at)}. It
                  ends by itself then.
                </p>
                <p className="text-muted-foreground">
                  Placed by {memberName(openHold.held_by)} on {when(openHold.created_at)}
                </p>
                {openHold.broker_name && (
                  <p>
                    Outside broker: {openHold.broker_name}
                    {openHold.broker_agency ? `, ${openHold.broker_agency}` : ""}
                    {openHold.broker_phone ? ` (${openHold.broker_phone})` : ""}
                  </p>
                )}
                {openHold.notes && <p className="text-muted-foreground">{openHold.notes}</p>}
              </div>
            )}
            {status === "sold" && sale && (
              <div className="space-y-1 rounded-md bg-muted p-3">
                <p className="font-medium">
                  Sold to {sale.buyer_name}
                  {sale.buyer_phone ? ` (${sale.buyer_phone})` : ""}
                </p>
                <p>
                  {aed(Number(sale.sale_price_aed))} on {longDate(sale.sale_date)} · recorded by{" "}
                  {memberName(sale.sold_by)}
                </p>
                {sale.broker_name && (
                  <p>
                    Outside broker: {sale.broker_name}
                    {sale.broker_agency ? `, ${sale.broker_agency}` : ""} ·{" "}
                    {Number(sale.broker_commission_percent)}% ={" "}
                    {aed(
                      commissionAed(
                        Number(sale.sale_price_aed),
                        Number(sale.broker_commission_percent),
                      ),
                    )}
                  </p>
                )}
                {sale.lead_id && (
                  <p className="text-muted-foreground">
                    Linked lead:{" "}
                    {data.leads.find((l) => l.id === sale.lead_id)?.name ?? "linked in Leads"}
                  </p>
                )}
              </div>
            )}
            {status === "sold" && schedule.length > 0 && (
              <ul className="divide-y divide-border rounded-md border border-border">
                {schedule.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span>
                      {i.label}
                      <span className="block text-xs text-muted-foreground">
                        {i.due_date ? `Due ${longDate(i.due_date)}` : "Due on handover (no date)"}
                      </span>
                    </span>
                    <span className="text-end tabular-nums">
                      {aed(Number(i.amount_aed))}
                      <span className="block text-xs text-muted-foreground">
                        {isSettled(i)
                          ? "Paid"
                          : Number(i.paid_amount ?? 0) > 0
                            ? `${aed(Number(i.paid_amount))} received`
                            : "Not paid"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {status === "free" && (
              <p className="text-muted-foreground">
                This unit is free. Holding it reserves it for one client for a set time; the first
                hold wins.
              </p>
            )}
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {status === "free" && (
                <Button disabled={busy} onClick={() => setMode("hold")}>
                  Hold
                </Button>
              )}
              {status !== "sold" && (
                <Button
                  variant={status === "held" ? "default" : "outline"}
                  disabled={busy}
                  onClick={startSale}
                >
                  {status === "held" ? "Convert to sale" : "Mark sold"}
                </Button>
              )}
              {status === "held" && openHold && canRelease && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => run(() => release({ data: openHold.id }))}
                >
                  Release hold
                </Button>
              )}
              {status === "sold" && sale && data.isOwner && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Undo this sale? The sale and its payment schedule are removed and the unit becomes free.",
                      )
                    )
                      void run(() => undoSale({ data: sale.id }));
                  }}
                >
                  Undo sale
                </Button>
              )}
              {data.isOwner && (
                <Button variant="ghost" disabled={busy} onClick={() => setMode("edit")}>
                  Edit details
                </Button>
              )}
            </div>
            {status === "held" && openHold && !canRelease && (
              <p className="text-xs text-muted-foreground">
                Only {memberName(openHold.held_by)} or the owner can release this hold.
              </p>
            )}
          </div>
        )}

        {mode === "edit" && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Unit number"
                maxLength={30}
                value={details.unit_number}
                onChange={(e) => setDetails({ ...details, unit_number: e.target.value })}
              />
              <label className="text-sm">
                Type
                <Input
                  className="mt-1 h-9"
                  list="dev-unit-types"
                  maxLength={30}
                  value={details.unit_type}
                  onChange={(e) =>
                    setDetails({
                      ...details,
                      unit_type: e.target.value,
                      bedrooms: /\d|studio/i.test(e.target.value)
                        ? String(bedroomsFromType(e.target.value))
                        : details.bedrooms,
                    })
                  }
                />
                <datalist id="dev-unit-types">
                  {UNIT_TYPES.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </label>
              <Field
                label="Bedrooms"
                type="number"
                min={0}
                max={20}
                value={details.bedrooms}
                onChange={(e) => setDetails({ ...details, bedrooms: e.target.value })}
              />
              <Field
                label="Size (sq ft)"
                inputMode="decimal"
                value={details.size_sqft}
                onChange={(e) => setDetails({ ...details, size_sqft: e.target.value })}
              />
              <Field
                label="Floor"
                maxLength={20}
                value={details.floor}
                onChange={(e) => setDetails({ ...details, floor: e.target.value })}
              />
              <Field
                label="View"
                maxLength={80}
                value={details.view}
                onChange={(e) => setDetails({ ...details, view: e.target.value })}
              />
              <Field
                label="Price (AED)"
                inputMode="decimal"
                value={details.price_aed}
                onChange={(e) => setDetails({ ...details, price_aed: e.target.value })}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                disabled={busy || !detailsValid}
                onClick={() =>
                  run(
                    () =>
                      save({
                        data: {
                          projectId: data.project.id,
                          unitId: unit?.id ?? null,
                          unit_number: details.unit_number.trim(),
                          unit_type: details.unit_type.trim(),
                          bedrooms: num(details.bedrooms),
                          size_sqft: details.size_sqft.trim() === "" ? 0 : num(details.size_sqft),
                          floor: details.floor.trim(),
                          view: details.view.trim(),
                          price_aed: num(details.price_aed),
                        },
                      }),
                    !unit,
                  )
                }
              >
                {busy ? "Saving…" : unit ? "Save" : "Add unit"}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => (unit ? setMode("view") : onClose())}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {mode === "hold" && unit && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Client name"
                maxLength={120}
                value={holdForm.client_name}
                onChange={(e) => setHoldForm({ ...holdForm, client_name: e.target.value })}
              />
              <Field
                label="Client phone"
                maxLength={40}
                inputMode="tel"
                value={holdForm.client_phone}
                onChange={(e) => setHoldForm({ ...holdForm, client_phone: e.target.value })}
              />
              <Field
                label="Hold for (hours)"
                type="number"
                min={1}
                max={MAX_HOLD_HOURS}
                value={holdForm.hours}
                onChange={(e) => setHoldForm({ ...holdForm, hours: e.target.value })}
              />
              <p className="self-end pb-2 text-xs text-muted-foreground">
                The hold ends by itself after this time and the unit shows as free again.
              </p>
              <Field
                label="Outside broker (if any)"
                maxLength={120}
                value={holdForm.broker_name}
                onChange={(e) => setHoldForm({ ...holdForm, broker_name: e.target.value })}
              />
              <Field
                label="Broker's agency"
                maxLength={120}
                value={holdForm.broker_agency}
                onChange={(e) => setHoldForm({ ...holdForm, broker_agency: e.target.value })}
              />
              <Field
                label="Broker's phone"
                maxLength={40}
                inputMode="tel"
                value={holdForm.broker_phone}
                onChange={(e) => setHoldForm({ ...holdForm, broker_phone: e.target.value })}
              />
              <Field
                label="Note"
                maxLength={500}
                value={holdForm.notes}
                onChange={(e) => setHoldForm({ ...holdForm, notes: e.target.value })}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                disabled={busy || !holdValid}
                onClick={() =>
                  run(() =>
                    hold({
                      data: {
                        unitId: unit.id,
                        client_name: holdForm.client_name.trim(),
                        client_phone: holdForm.client_phone.trim(),
                        hours,
                        broker_name: holdForm.broker_name.trim(),
                        broker_agency: holdForm.broker_agency.trim(),
                        broker_phone: holdForm.broker_phone.trim(),
                        notes: holdForm.notes.trim(),
                      },
                    }),
                  )
                }
              >
                {busy ? "Holding…" : "Hold unit"}
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => setMode("view")}>
                Back
              </Button>
            </div>
          </div>
        )}

        {mode === "sell" && unit && (
          <div className="space-y-4">
            {!planOk && (
              <p className="rounded-md bg-secondary px-3 py-2 text-sm">
                This project has no complete payment plan yet, so a sale cannot be recorded.{" "}
                {data.isOwner
                  ? "Set it on the Payment plan tab first."
                  : "Ask the owner to set it on the Payment plan tab."}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm sm:col-span-2">
                Link to a lead (optional)
                <select
                  className={selectClass}
                  value={saleForm.leadId}
                  onChange={(e) => {
                    const lead = data.leads.find((l) => l.id === e.target.value);
                    setSaleForm({
                      ...saleForm,
                      leadId: e.target.value,
                      buyer_name: saleForm.buyer_name || lead?.name || "",
                      buyer_phone: saleForm.buyer_phone || lead?.phone || "",
                    });
                  }}
                >
                  <option value="">No lead</option>
                  {data.leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} {l.phone}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-muted-foreground">
                  Your {data.leads.length} most recent leads are listed.
                </span>
              </label>
              <Field
                label="Buyer name"
                maxLength={120}
                value={saleForm.buyer_name}
                onChange={(e) => setSaleForm({ ...saleForm, buyer_name: e.target.value })}
              />
              <Field
                label="Buyer phone"
                maxLength={40}
                inputMode="tel"
                value={saleForm.buyer_phone}
                onChange={(e) => setSaleForm({ ...saleForm, buyer_phone: e.target.value })}
              />
              <Field
                label="Sale price (AED)"
                inputMode="decimal"
                value={saleForm.sale_price_aed}
                onChange={(e) => setSaleForm({ ...saleForm, sale_price_aed: e.target.value })}
              />
              <Field
                label="Sale date"
                type="date"
                value={saleForm.sale_date}
                onChange={(e) => setSaleForm({ ...saleForm, sale_date: e.target.value })}
              />
              <Field
                label="Outside broker (if any)"
                maxLength={120}
                value={saleForm.broker_name}
                onChange={(e) => setSaleForm({ ...saleForm, broker_name: e.target.value })}
              />
              <Field
                label="Broker's agency"
                maxLength={120}
                value={saleForm.broker_agency}
                onChange={(e) => setSaleForm({ ...saleForm, broker_agency: e.target.value })}
              />
              <Field
                label="Broker's phone"
                maxLength={40}
                inputMode="tel"
                value={saleForm.broker_phone}
                onChange={(e) => setSaleForm({ ...saleForm, broker_phone: e.target.value })}
              />
              <Field
                label="Broker commission (%)"
                inputMode="decimal"
                disabled={!saleForm.broker_name.trim()}
                value={saleForm.broker_commission_percent}
                onChange={(e) =>
                  setSaleForm({ ...saleForm, broker_commission_percent: e.target.value })
                }
              />
            </div>
            {saleForm.broker_name.trim() && price > 0 && commissionPercent > 0 && (
              <p className="text-sm text-muted-foreground">
                Broker commission: {aed(commissionAed(price, commissionPercent))}
              </p>
            )}
            {preview.length > 0 && (
              <div>
                <p className="text-sm font-medium">Payment schedule that will be created</p>
                <ul className="mt-1 divide-y divide-border rounded-md border border-border text-sm">
                  {preview.map((l) => (
                    <li key={l.position} className="flex justify-between gap-3 px-3 py-1.5">
                      <span>
                        {l.label}
                        <span className="ms-2 text-xs text-muted-foreground">
                          {l.due_date ? longDate(l.due_date) : "on handover (no date set)"}
                        </span>
                      </span>
                      <span className="tabular-nums">{aed(l.amount_aed)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              This records the sale in your own books only. Registration and any escrow payments are
              handled outside this app.
            </p>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                disabled={busy || !saleValid}
                onClick={() =>
                  run(() =>
                    sell({
                      data: {
                        unitId: unit.id,
                        holdId: openHold?.id ?? null,
                        buyer_name: saleForm.buyer_name.trim(),
                        buyer_phone: saleForm.buyer_phone.trim(),
                        leadId: saleForm.leadId || null,
                        sale_price_aed: price,
                        sale_date: saleForm.sale_date,
                        broker_name: saleForm.broker_name.trim(),
                        broker_agency: saleForm.broker_agency.trim(),
                        broker_phone: saleForm.broker_phone.trim(),
                        broker_commission_percent: saleForm.broker_name.trim()
                          ? commissionPercent
                          : 0,
                      },
                    }),
                  )
                }
              >
                {busy ? "Saving…" : "Record sale"}
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => setMode("view")}>
                Back
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
