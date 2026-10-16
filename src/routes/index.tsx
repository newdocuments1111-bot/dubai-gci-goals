import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { fromEffort, fromGoal, gciPerDeal, type Rates } from "@/lib/gci";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dubai AI GCI — Commission Calculator for Agents" },
      { name: "description", content: "Plan your yearly GCI in AED: calls, talks, appraisals, listings and deals for Dubai real estate agents." },
      { property: "og:title", content: "Dubai AI GCI" },
      { property: "og:description", content: "GCI calculator in AED for Dubai real estate agents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const aed = (n: number) => "AED " + Math.round(n).toLocaleString("en-US");
const up = (n: number) => (isFinite(n) ? Math.ceil(n - 1e-9) : 0).toLocaleString("en-US");

function Num({ label, value, onChange, suffix }: { label: string; value: number; onChange: (n: number) => void; suffix?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1 flex items-center rounded-lg border border-input bg-card focus-within:ring-2 focus-within:ring-ring">
        <input
          type="number"
          inputMode="decimal"
          className="w-full bg-transparent px-3 py-2 text-base outline-none"
          value={Number.isNaN(value) ? "" : value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
        {suffix && <span className="pr-3 text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </label>
  );
}

function Index() {
  const [mode, setMode] = useState<"goal" | "effort">("goal");
  const [goal, setGoal] = useState(1_000_000);
  const [callsWeek, setCallsWeek] = useState(200);
  const [price, setPrice] = useState(2_000_000);
  const [commission, setCommission] = useState(2);
  const [split, setSplit] = useState(60);
  const [weeks, setWeeks] = useState(46);
  const [rates, setRates] = useState<Rates>({ callsToTalks: 36, talksToAppraisals: 34, appraisalsToListings: 59, listingsToDeals: 31 });

  const n = (x: number) => (Number.isNaN(x) ? 0 : x);
  const inputs = { price: n(price), commissionPct: n(commission), splitPct: split, weeks: n(weeks) || 1, rates };
  const f = mode === "goal" ? fromGoal(n(goal), inputs) : fromEffort(n(callsWeek), inputs);
  const gci = mode === "goal" ? n(goal) : f.deals * gciPerDeal(inputs);
  const takeHome = gci * (split / 100);
  const days = inputs.weeks * 5;

  const rows: [string, number][] = [
    ["Deals", f.deals], ["Listings", f.listings], ["Appraisals", f.appraisals], ["Talks", f.talks], ["Calls", f.calls],
  ];
  const setRate = (k: keyof Rates) => (v: number) => setRates({ ...rates, [k]: n(v) });

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Dubai AI GCI</h1>
          <p className="mt-1 text-muted-foreground">Your yearly commission plan in AED.</p>
        </header>

        <div className="mb-6 inline-flex rounded-xl bg-muted p-1">
          {(["goal", "effort"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${mode === m ? "bg-card text-foreground shadow" : "text-muted-foreground"}`}>
              {m === "goal" ? "Start from my goal" : "Start from my effort"}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-5 rounded-2xl border border-border bg-card p-5">
            {mode === "goal"
              ? <Num label="Yearly GCI goal" value={goal} onChange={setGoal} suffix="AED" />
              : <Num label="Calls per week" value={callsWeek} onChange={setCallsWeek} />}
            <div className="grid grid-cols-2 gap-4">
              <Num label="Property price" value={price} onChange={setPrice} suffix="AED" />
              <Num label="Commission" value={commission} onChange={setCommission} suffix="%" />
              <div>
                <span className="text-xs font-medium text-muted-foreground">Agent split</span>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {[60, 80].map((s) => (
                    <button key={s} onClick={() => setSplit(s)}
                      className={`rounded-lg border py-2 text-sm font-medium ${split === s ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}>
                      {s}%
                    </button>
                  ))}
                </div>
              </div>
              <Num label="Working weeks" value={weeks} onChange={setWeeks} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Conversion rates</h3>
              <div className="grid grid-cols-2 gap-4">
                <Num label="Calls → talks" value={rates.callsToTalks} onChange={setRate("callsToTalks")} suffix="%" />
                <Num label="Talks → appraisals" value={rates.talksToAppraisals} onChange={setRate("talksToAppraisals")} suffix="%" />
                <Num label="Appraisals → listings" value={rates.appraisalsToListings} onChange={setRate("appraisalsToListings")} suffix="%" />
                <Num label="Listings → deals" value={rates.listingsToDeals} onChange={setRate("listingsToDeals")} suffix="%" />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">These % are examples. Change them to your own.</p>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
              <p className="text-sm opacity-80">Your yearly take-home ({split}% split)</p>
              <p className="mt-1 text-3xl font-bold sm:text-4xl">{aed(takeHome)}</p>
              <p className="mt-2 text-sm opacity-80">GCI: {aed(gci)}</p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr><th className="p-3 text-left font-medium"></th><th className="p-3 text-right font-medium">Year</th><th className="p-3 text-right font-medium">Week</th><th className="p-3 text-right font-medium">Day</th></tr>
                </thead>
                <tbody>
                  {rows.map(([k, v]) => (
                    <tr key={k} className="border-t border-border">
                      <td className="p-3 font-medium">{k}</td>
                      <td className="p-3 text-right tabular-nums">{up(v)}</td>
                      <td className="p-3 text-right tabular-nums">{up(v / inputs.weeks)}</td>
                      <td className="p-3 text-right tabular-nums">{up(v / days)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">Numbers rounded up. Day = 5 working days per week.</p>
          </section>
        </div>

        <section className="mt-10 rounded-2xl border-2 border-dashed border-border p-8 text-center">
          <h2 className="text-xl font-semibold">AI lead finder</h2>
          <p className="mt-1 text-sm text-muted-foreground">Coming soon.</p>
        </section>
      </div>
    </main>
  );
}
