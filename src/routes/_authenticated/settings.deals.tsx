import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getDealSettings, saveDealSettings } from "@/lib/dealroom.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const settingsQuery = queryOptions({
  queryKey: ["deal-settings"],
  queryFn: () => getDealSettings(),
});

export const Route = createFileRoute("/_authenticated/settings/deals")({
  head: () => ({
    meta: [{ title: "Deals and fees — Dubai AI GCI" }, { name: "robots", content: "noindex" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQuery),
  component: DealSettingsPage,
});

const NUMBERS = [
  ["default_commission_percent", "Usual commission %", "New deals start with this"],
  ["vat_percent", "VAT %", "On commission invoices"],
  ["dld_fee_percent", "DLD transfer fee %", "Of the sale price"],
  ["dld_admin_aed", "DLD admin and knowledge fees (AED)", ""],
  ["trustee_fee_low_aed", "Trustee fee under AED 500k (AED)", "Incl. VAT"],
  ["trustee_fee_high_aed", "Trustee fee AED 500k and above (AED)", "Incl. VAT"],
  ["mortgage_reg_percent", "Mortgage registration % of loan", ""],
] as const;

function DealSettingsPage() {
  const { data } = useSuspenseQuery(settingsQuery);
  const client = useQueryClient();
  const save = useServerFn(saveDealSettings);
  const [form, setForm] = useState(() => ({
    ...data,
    ...Object.fromEntries(NUMBERS.map(([k]) => [k, String(data[k])])),
  }));
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Deals and fees</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Your invoice details and the fee figures the Deal Room uses for buyer cost estimates.
        Defaults are public figures as of November 2026. Check them with the trustee office now and
        then.
      </p>
      {(msg || error) && (
        <p
          role={error ? "alert" : "status"}
          className={`mb-3 text-sm ${error ? "text-destructive" : "text-primary"}`}
        >
          {error || msg}
        </p>
      )}
      <form
        className="space-y-5 rounded-xl border border-border bg-background p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          setMsg("");
          try {
            const num = (k: string) =>
              Number(
                String((form as unknown as Record<string, string>)[k]).replace(/[^\d.]/g, ""),
              ) || 0;
            await save({
              data: {
                company_trn: form.company_trn,
                bank_details: form.bank_details,
                default_commission_percent: num("default_commission_percent"),
                vat_percent: num("vat_percent"),
                dld_fee_percent: num("dld_fee_percent"),
                dld_admin_aed: num("dld_admin_aed"),
                trustee_fee_low_aed: num("trustee_fee_low_aed"),
                trustee_fee_high_aed: num("trustee_fee_high_aed"),
                mortgage_reg_percent: num("mortgage_reg_percent"),
              },
            });
            await client.invalidateQueries({ queryKey: ["deal-settings"] });
            setMsg("Saved.");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Company TRN (VAT number)
            <Input
              className="mt-1 h-9"
              maxLength={30}
              value={form.company_trn}
              onChange={(e) => setForm({ ...form, company_trn: e.target.value })}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Bank details printed on invoices
            <Textarea
              className="mt-1"
              rows={3}
              maxLength={500}
              placeholder={"Bank name\nAccount name\nIBAN"}
              value={form.bank_details}
              onChange={(e) => setForm({ ...form, bank_details: e.target.value })}
            />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {NUMBERS.map(([k, label, hint]) => (
            <label key={k} className="text-sm">
              {label}
              <Input
                className="mt-1 h-9"
                inputMode="decimal"
                value={(form as unknown as Record<string, string>)[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
              {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
            </label>
          ))}
        </div>
        <Button type="submit" disabled={busy}>
          Save
        </Button>
      </form>
    </main>
  );
}
