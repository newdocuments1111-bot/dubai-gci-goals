import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarDays, Phone, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { completionPlan, WORKING_DAYS_PER_WEEK, type Rates } from "@/lib/gci";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dubai AI GCI — Commission Calculator for Agents" },
      { name: "description", content: "Calculate your daily call target and working days to reach your AED GCI goal as a Dubai real estate agent." },
      { property: "og:title", content: "Dubai AI GCI" },
      { property: "og:description", content: "See your daily calls and working days to reach your Dubai real estate GCI goal in AED." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const aed = (n: number) => "AED " + Math.round(n).toLocaleString("en-US");
const up = (n: number) => (isFinite(n) ? Math.ceil(n - 1e-9) : 0).toLocaleString("en-US");
const number = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

function Num({ label, value, onChange, suffix, max }: { label: string; value: number; onChange: (n: number) => void; suffix?: string; max?: number }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1 flex items-center rounded-lg border border-input bg-card focus-within:ring-2 focus-within:ring-ring">
        <input
          type="number"
          min={0}
          max={max}
          step="any"
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
  const [paceUnit, setPaceUnit] = useState<"week" | "day">("week");
  const [price, setPrice] = useState(2_000_000);
  const [commission, setCommission] = useState(2);
  const [weeks, setWeeks] = useState(46);
  const [rates, setRates] = useState<Rates>({ callsToTalks: 36, talksToAppraisals: 34, appraisalsToListings: 59, listingsToDeals: 31 });

  const n = (x: number) => (Number.isNaN(x) ? 0 : x);
  const inputs = { price: n(price), commissionPct: n(commission), weeks: n(weeks), rates };
  const plan = completionPlan(mode, goal, callsWeek, inputs);
  const setRate = (k: keyof Rates) => (v: number) => setRates({ ...rates, [k]: n(v) });

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
        <header className="mb-6">
          <h1 className="text-3xl font-bold sm:text-4xl">Dubai AI GCI</h1>
          <p className="mt-1 text-muted-foreground">Your goal. Your daily calls. Your timeline.</p>
        </header>

        <div className="mb-5 grid grid-cols-2 rounded-lg bg-muted p-1 sm:inline-flex">
          {(["goal", "effort"] as const).map((m) => (
            <Button key={m} onClick={() => setMode(m)} variant="ghost" aria-pressed={mode === m}
              className={`px-3 sm:px-4 ${mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
              {m === "goal" ? "Start from my goal" : "Start from my effort"}
            </Button>
          ))}
        </div>

        <section aria-label="Goal completion" aria-live="polite" className="mb-6 rounded-lg bg-primary p-5 text-primary-foreground sm:p-6">
          <div className="flex items-center gap-2 text-sm font-medium"><CalendarDays className="size-4" />Time to complete your GCI goal</div>
          {plan ? <>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-3xl font-bold sm:text-4xl">{number(plan.workingDays)} working days</h2>
              <span className="text-lg opacity-80">({number(plan.workingWeeks)} weeks)</span>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed opacity-90">
              {mode === "effort"
                ? `At your pace of ${number(plan.callsPerDay)} calls/day, it will take ${number(plan.workingDays)} working days to complete your ${aed(goal)} GCI.`
                : `To complete your ${aed(goal)} GCI in ${number(plan.workingWeeks)} weeks / ${number(plan.workingDays)} working days, you need ${number(plan.callsPerDay)} calls per day.`}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-primary-foreground/20 pt-4">
              <div className="flex items-center gap-3"><Phone className="size-5" /><div><p className="text-2xl font-bold">{number(plan.callsPerDay)} <span className="text-sm font-normal">calls / day</span></p><p className="text-xs opacity-80">{number(plan.callsPerDay * WORKING_DAYS_PER_WEEK)} calls / week</p></div></div>
              <p className="text-xs opacity-80">5 working days per week · Estimated from your rates</p>
            </div>
          </> : <p className="mt-3 text-sm">Enter a valid goal, property price, commission and conversion rates{mode === "effort" ? ", plus a call pace above zero" : ", plus working weeks above zero"} to calculate your timeline.</p>}
        </section>

        <div className="grid gap-6 sm:grid-cols-2">
          <section aria-label="Goal and pace" className="space-y-4">
            <h2 className="text-sm font-semibold">{mode === "goal" ? "Your goal & deadline" : "Your goal & pace"}</h2>
            <Num label="Target GCI goal" value={goal} onChange={setGoal} suffix="AED" />
            {mode === "goal" ? <Num label="Working weeks to complete goal" value={weeks} onChange={setWeeks} /> : <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Call pace</span>
                <div className="flex rounded-md bg-muted p-1">
                  {(["week", "day"] as const).map((unit) => <Button key={unit} variant="ghost" size="sm" aria-pressed={paceUnit === unit} onClick={() => setPaceUnit(unit)} className={paceUnit === unit ? "bg-card shadow-sm" : "text-muted-foreground"}>Per {unit}</Button>)}
                </div>
              </div>
              <Num label={paceUnit === "week" ? "Calls per week" : "Calls per day"} value={paceUnit === "week" ? callsWeek : callsWeek / WORKING_DAYS_PER_WEEK} onChange={(value) => setCallsWeek(paceUnit === "week" ? value : value * WORKING_DAYS_PER_WEEK)} />
            </>}
          </section>
          <section aria-label="Commission details" className="space-y-4">
            <h2 className="text-sm font-semibold">Your commission</h2>
            <div className="grid grid-cols-2 gap-4">
              <Num label="Property price" value={price} onChange={setPrice} suffix="AED" />
              <Num label="Commission" value={commission} onChange={setCommission} suffix="%" max={100} />
            </div>
            <div className="border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">Total GCI per deal</p>
              <p className="mt-1 text-2xl font-bold">{aed(gciPerDeal(inputs))}</p>
              <p className="mt-1 text-xs text-muted-foreground">Every figure below is total GCI, the full commission on your deals.</p>
            </div>
          </section>
        </div>

        <details className="group mt-6 border-t border-border pt-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold">Conversion rates & goal breakdown<ChevronDown className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" /></summary>
          <div className="grid gap-6 pt-4 sm:grid-cols-2">
            <div>
              <div className="grid grid-cols-2 gap-4">
                <Num label="Calls → talks" value={rates.callsToTalks} onChange={setRate("callsToTalks")} suffix="%" max={100} />
                <Num label="Talks → appraisals" value={rates.talksToAppraisals} onChange={setRate("talksToAppraisals")} suffix="%" max={100} />
                <Num label="Appraisals → listings" value={rates.appraisalsToListings} onChange={setRate("appraisalsToListings")} suffix="%" max={100} />
                <Num label="Listings → deals" value={rates.listingsToDeals} onChange={setRate("listingsToDeals")} suffix="%" max={100} />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">These % are examples. Change them to your own.</p>
            </div>
            <div>
              <h3 className="text-sm font-medium">Total activity to reach your goal</h3>
              {plan && <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3">
                {Object.entries(plan.funnel).reverse().map(([label, count]) => <div key={label} className="flex justify-between gap-2 border-b border-border pb-2"><dt className="text-sm capitalize text-muted-foreground">{label}</dt><dd className="text-sm font-semibold tabular-nums">{up(count)}</dd></div>)}
              </dl>}
              <p className="mt-3 text-xs text-muted-foreground">Activity counts rounded up.</p>
            </div>
          </div>
        </details>

        <section className="mt-8 border-t border-dashed border-border py-6 text-center">
          <h2 className="text-xl font-semibold">AI lead finder</h2>
          <p className="mt-1 text-sm text-muted-foreground">Coming soon.</p>
        </section>
      </div>
    </main>
  );
}
