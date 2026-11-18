import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  Plus,
  Upload,
  Download,
  CheckCheck,
  Pencil,
  Trash2,
  MapPin,
  BedDouble,
  Ruler,
  Lock,
  ImageIcon,
  Copy,
} from "lucide-react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ListingShareButton } from "@/components/ListingShareButton";
import { listingPhotos } from "@/lib/listing-media";
import { ListingEditor } from "@/components/ListingEditor";
import { listingsQuery } from "@/lib/listings-query";
import { useLang } from "@/hooks/use-lang";
import {
  confirmListings,
  deleteListing,
  importListings,
  setListingStatus,
  duplicateListing,
} from "@/lib/listings.functions";
import {
  csvColumns,
  dubaiDate,
  needsCheck,
  parseListingsCsv,
  matchesListing,
  defaultListingFilters,
  type Listing,
  type ListingInput,
} from "@/lib/listings";

export const Route = createFileRoute("/_authenticated/listings")({
  head: () => ({
    meta: [
      { title: "Private listings — Dubai AI GCI" },
      {
        name: "description",
        content: "Your private Dubai property inventory, availability and daily checks.",
      },
      { property: "og:title", content: "Private listings — Dubai AI GCI" },
      { property: "og:description", content: "Private property inventory for Dubai AI GCI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(listingsQuery),
  component: ListingsPage,
});

function ListingsPage() {
  const { t } = useLang();
  const { data } = useSuspenseQuery(listingsQuery);
  const client = useQueryClient();
  const confirm = useServerFn(confirmListings),
    remove = useServerFn(deleteListing),
    importRows = useServerFn(importListings);
  const [editor, setEditor] = useState<Listing | "new" | null>(null);
  const status = useServerFn(setListingStatus),
    duplicate = useServerFn(duplicateListing);
  const [toDelete, setToDelete] = useState<Listing | null>(null);
  const [csv, setCsv] = useState<ListingInput[] | null>(null);
  const [filters, setFilters] = useState(defaultListingFilters);
  const setFilter = (key: keyof typeof filters, value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const reload = async () => {
    await client.invalidateQueries({ queryKey: listingsQuery.queryKey });
  };
  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Please try again."));
    } finally {
      setBusy(false);
    }
  };
  const image = (row: Listing) => listingPhotos(row, data.mediaUrls)[0];
  const rows = data.listings.filter((r) => matchesListing(r, filters));
  const communities = [...new Set(data.listings.map((r) => r.community).filter(Boolean))].sort();
  const template = () => {
    const blob = new Blob([Papa.unparse({ fields: csvColumns, data: [] })], { type: "text/csv" });
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = "listing-template.csv";
    a.click();
    URL.revokeObjectURL(u);
  };
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <Button asChild variant="ghost" className="px-0">
            <Link to="/">
              <ArrowLeft className="size-4" />
              {t("Calculator & Lead Finder")}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/ai-reply-rules">{t("AI Reply Rules")}</Link>
          </Button>
        </div>
        <header className="mb-7 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3" />
              {t("Owner only · Dubai AI GCI")}
            </div>
            <h1 className="text-3xl font-bold">{t("My listings")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("{n} properties · {m} need a check", {
                n: data.listings.length,
                m: data.listings.filter((r) => needsCheck(r.last_checked)).length,
              })}
            </p>
          </div>
          <Button onClick={() => setEditor("new")}>
            <Plus className="size-4" />
            {t("Add listing")}
          </Button>
        </header>
        <div className="mb-6 flex flex-wrap gap-2 border-y border-border py-4">
          <Button
            variant="outline"
            disabled={busy || !data.listings.length}
            onClick={() =>
              void act(async () => {
                await confirm();
                setMessage(t("All listings checked just now."));
              })
            }
          >
            <CheckCheck className="size-4" />
            {t("Confirm all still correct")}
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => fileInput.current?.click()}>
            <Upload className="size-4" />
            {t("Import CSV")}
          </Button>
          <Button variant="ghost" onClick={template}>
            <Download className="size-4" />
            {t("Download CSV template")}
          </Button>
          <input
            ref={fileInput}
            aria-label={t("Import CSV file")}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                if (f.size > 5 * 1024 * 1024) throw new Error(t("CSV must be under 5 MB."));
                setCsv(parseListingsCsv(await f.text()));
                setError("");
              } catch (err) {
                setError(err instanceof Error ? err.message : t("Could not read CSV."));
              }
            }}
          />
        </div>
        <section
          aria-label={t("Search and filters")}
          className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          <Input
            aria-label={t("Search listings")}
            placeholder={t("Search title or building")}
            className="col-span-2"
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
          />
          {(
            [
              ["community", t("Community"), t("All community"), communities],
              [
                "status",
                t("Status"),
                t("All status"),
                ["Available", "Reserved", "Sold", "Needs check"],
              ],
              [
                "bedrooms",
                t("Bedrooms"),
                t("All bedrooms"),
                [...new Set(data.listings.map((r) => r.bedrooms))]
                  .sort((a, b) => a - b)
                  .map(String),
              ],
              ["completion", t("Completion"), t("All completion"), ["off-plan", "ready"]],
            ] as const
          ).map(([key, label, all, options]) => (
            <label key={key} className="min-w-0 text-xs text-muted-foreground">
              {label}
              <select
                aria-label={label}
                className="mt-1 h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                value={filters[key]}
                onChange={(e) => setFilter(key, e.target.value)}
              >
                <option value="">{all}</option>
                {options.map((v) => (
                  <option key={v} value={v}>
                    {key === "status" || key === "completion" ? t(v) : v}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label className="text-xs text-muted-foreground">
            {t("Min price (AED)")}
            <Input
              aria-label={t("Minimum price")}
              type="number"
              min="0"
              value={filters.minPrice}
              onChange={(e) => setFilter("minPrice", e.target.value)}
              className="mt-1"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            {t("Max price (AED)")}
            <Input
              aria-label={t("Maximum price")}
              type="number"
              min="0"
              value={filters.maxPrice}
              onChange={(e) => setFilter("maxPrice", e.target.value)}
              className="mt-1"
            />
          </label>
          <div className="col-span-2 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {t("{n} results · 00:00 Dubai check", { n: rows.length })}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setFilters(defaultListingFilters)}>
              {t("Clear filters")}
            </Button>
          </div>
        </section>
        {message && (
          <p role="status" className="mb-4 text-sm text-primary">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <article
              key={row.id}
              className="overflow-hidden rounded-lg border border-border bg-card"
            >
              <div className="relative aspect-[4/3] bg-muted">
                {image(row) ? (
                  <img
                    src={image(row)}
                    alt={
                      row.is_sample
                        ? t("Illustrative sample: {title}", { title: row.title })
                        : row.title
                    }
                    width={1024}
                    height={768}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <ImageIcon className="size-8" />
                  </div>
                )}
                <div className="absolute start-3 top-3 flex gap-2">
                  <span className="rounded bg-card px-2 py-1 text-xs font-semibold">
                    {t(row.status)}
                  </span>
                  {row.is_sample && (
                    <span className="rounded bg-secondary px-2 py-1 text-xs font-semibold text-secondary-foreground">
                      {t("Sample")}
                    </span>
                  )}
                </div>
              </div>
              <div className="p-4">
                <p className="text-xl font-bold">AED {row.price_aed.toLocaleString("en-US")}</p>
                <h2 className="mt-2 break-words font-semibold">{row.title}</h2>
                <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="size-3 shrink-0" />
                  {row.community || t("Area not provided")}
                </p>
                <p className="mt-1 break-words text-xs text-muted-foreground">
                  {row.project || t("Project not provided")}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                  <span className="flex gap-1">
                    <BedDouble className="size-3" />
                    {t("{n} beds", { n: row.bedrooms })}
                  </span>
                  <span className="flex gap-1">
                    <Ruler className="size-3" />
                    {t("{n} sq ft", { n: row.size_sqft.toLocaleString() })}
                  </span>
                  <span className="capitalize">{t(row.property_type)}</span>
                </div>
                <p className="mt-3 text-xs capitalize">
                  {t(row.completion)}
                  {row.handover_date
                    ? ` · ${t("Handover {date}", { date: row.handover_date })}`
                    : ""}
                </p>
                <div className="mt-4 border-t border-border pt-3">
                  <p
                    className={`text-xs font-medium ${needsCheck(row.last_checked) ? "inline-block rounded bg-warning px-2 py-1 text-warning-foreground" : "text-primary"}`}
                  >
                    {needsCheck(row.last_checked) ? t("Needs check") : t("Checked within 24 hours")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("Last checked: {date}", { date: dubaiDate(row.last_checked) })}
                  </p>
                </div>
                <div
                  aria-label={t("Status for {title}", { title: row.title })}
                  className="mt-3 grid grid-cols-3 gap-1"
                >
                  {(["Available", "Reserved", "Sold"] as const).map((value) => (
                    <Button
                      key={value}
                      variant={row.status === value ? "secondary" : "outline"}
                      size="sm"
                      className="min-w-0 px-1 text-xs"
                      aria-pressed={row.status === value}
                      disabled={busy}
                      onClick={() =>
                        void act(async () => {
                          const result = await status({ data: { id: row.id, status: value } });
                          if (!result.success) setError(result.message);
                        })
                      }
                    >
                      {t(value)}
                    </Button>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-1">
                  <Button asChild variant="outline" size="sm">
                    <Link to="/listing/$listingId" params={{ listingId: row.id }}>
                      {t("View details")}
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ms-auto"
                    title={t("Edit listing")}
                    aria-label={t("Edit {title}", { title: row.title })}
                    onClick={() => setEditor(row)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title={t("Delete listing")}
                    aria-label={t("Delete {title}", { title: row.title })}
                    onClick={() => setToDelete(row)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="mt-2 grid gap-2">
                  <ListingShareButton listing={row} photo={image(row)} />
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void act(async () => {
                        const result = await duplicate({ data: row.id });
                        setMessage(
                          t(
                            "Listing duplicated as Reserved. Add the new unit’s permit before marking Available.",
                          ),
                        );
                        await reload();
                        const updated = client.getQueryData(listingsQuery.queryKey);
                        const copy = updated?.listings.find((r) => r.id === result.id);
                        if (copy) setEditor(copy);
                      })
                    }
                  >
                    <Copy className="size-4" />
                    {t("Duplicate listing")}
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
        {!rows.length && (
          <p className="py-16 text-center text-muted-foreground">
            {data.listings.length ? t("No matching listings.") : t("No listings yet.")}
          </p>
        )}
        {editor && (
          <ListingEditor
            listing={editor === "new" ? undefined : editor}
            mediaUrls={data.mediaUrls}
            onClose={() => setEditor(null)}
            onSaved={reload}
          />
        )}
        <Dialog
          open={!!toDelete}
          onOpenChange={(open) => {
            if (!open && !busy) setToDelete(null);
          }}
        >
          <DialogContent>
            <DialogTitle>{t("Delete listing?")}</DialogTitle>
            <DialogDescription>
              {t("{title} and its uploaded media will be removed permanently.", {
                title: toDelete?.title ?? "",
              })}
            </DialogDescription>
            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={busy} onClick={() => setToDelete(null)}>
                {t("Cancel")}
              </Button>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => {
                  if (toDelete)
                    void act(async () => {
                      await remove({ data: toDelete.id });
                      setToDelete(null);
                    });
                }}
              >
                {t("Delete listing")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog
          open={!!csv}
          onOpenChange={(open) => {
            if (!open && !busy) setCsv(null);
          }}
        >
          <DialogContent>
            <DialogTitle>{t("Import {n} listings?", { n: csv?.length ?? "" })}</DialogTitle>
            <DialogDescription>
              {t(
                "These will be added as new private listings. Existing listings will not be changed.",
              )}
            </DialogDescription>
            <div className="max-h-60 overflow-y-auto text-sm">
              {csv?.map((r, i) => (
                <p key={i} className="border-b border-border py-2">
                  {r.title} · AED {r.price_aed.toLocaleString()}
                </p>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={busy} onClick={() => setCsv(null)}>
                {t("Cancel")}
              </Button>
              <Button
                disabled={busy}
                onClick={() => {
                  if (csv)
                    void act(async () => {
                      const result = await importRows({ data: csv });
                      setCsv(null);
                      setMessage(t("{n} listings imported.", { n: result.count }));
                    });
                }}
              >
                {busy ? t("Importing…") : t("Confirm import")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}
