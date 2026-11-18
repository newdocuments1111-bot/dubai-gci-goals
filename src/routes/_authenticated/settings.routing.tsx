import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import {
  addRule,
  deleteRule,
  getRouting,
  rotateIntakeKey,
  savePoolSettings,
  setRotation,
} from "@/lib/inbox.functions";
import { LEAD_SOURCES } from "@/lib/inbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const routingQuery = queryOptions({ queryKey: ["routing"], queryFn: () => getRouting() });

export const Route = createFileRoute("/_authenticated/settings/routing")({
  head: () => ({
    meta: [
      { title: "Lead routing — Dubai AI GCI" },
      {
        name: "description",
        content: "Who gets each new lead, the lead pool, and how portals send leads in.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(routingQuery),
  component: RoutingPage,
});

const selectCls = "h-9 rounded-md border border-input bg-background px-2 text-sm";
const LANGS = [
  ["en", "English"],
  ["ar", "Arabic"],
  ["ru", "Russian"],
  ["hi", "Hindi / Urdu"],
] as const;
const KIND_LABEL = { area: "Area contains", language: "Language is", source: "Source is" } as const;
const memberName = (m: { display_name: string | null; email: string | null } | undefined) =>
  m ? m.display_name || m.email || "Agent" : "Removed member";

function RoutingPage() {
  const { data } = useSuspenseQuery(routingQuery);
  const client = useQueryClient();
  const add = useServerFn(addRule);
  const remove = useServerFn(deleteRule);
  const rotation = useServerFn(setRotation);
  const savePool = useServerFn(savePoolSettings);
  const rotateKey = useServerFn(rotateIntakeKey);
  const [kind, setKind] = useState<"area" | "language" | "source">("area");
  const [value, setValue] = useState("");
  const [agentId, setAgentId] = useState(data.members[0]?.user_id ?? "");
  const [minutes, setMinutes] = useState(String(data.poolAfterMinutes));
  const [limit, setLimit] = useState(String(data.poolDailyLimit));
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, done = "") => {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      await fn();
      await client.invalidateQueries({ queryKey: ["routing"] });
      void client.invalidateQueries({ queryKey: ["inbox"] });
      if (done) setMsg(done);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const endpoint = `${origin}/api/public/leads/intake`;
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMsg("Copied.");
    } catch {
      setError("Could not copy.");
    }
  };
  const agents = data.members.filter((m) => m.role === "agent");

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Lead routing and portals</h1>
        <p className="text-sm text-muted-foreground">
          Every new lead goes to the first rule that fits. No rule fits: the agent in the rotation
          who waited longest. Nobody free: the lead pool. See them in the{" "}
          <Link to="/inbox" className="underline">
            Inbox
          </Link>
          .
        </p>
      </div>

      {(msg || error) && (
        <p
          role={error ? "alert" : "status"}
          className={`text-sm ${error ? "text-destructive" : "text-primary"}`}
        >
          {error || msg}
        </p>
      )}

      <section className="rounded-xl border border-border bg-background p-5">
        <h2 className="font-semibold">1. Rules</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Checked top to bottom. The first match wins.
        </p>
        {data.rules.length === 0 ? (
          <p className="mb-3 text-sm text-muted-foreground">
            No rules yet, so every lead goes by turns.
          </p>
        ) : (
          <ol className="mb-3 divide-y divide-border rounded-lg border border-border text-sm">
            {data.rules.map((r, i) => (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2">
                <span className="w-5 text-muted-foreground">{i + 1}</span>
                <span className="flex-1">
                  {KIND_LABEL[r.kind as keyof typeof KIND_LABEL] ?? r.kind}{" "}
                  <strong>
                    {r.kind === "language"
                      ? (LANGS.find(([k]) => k === r.value)?.[1] ?? r.value)
                      : r.value}
                  </strong>{" "}
                  → {memberName(data.members.find((m) => m.user_id === r.agent_id))}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove rule"
                  disabled={busy}
                  onClick={() => void run(() => remove({ data: r.id }))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ol>
        )}
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await add({ data: { kind, value, agent_id: agentId } });
              setValue("");
            }, "Rule added.");
          }}
        >
          <select
            aria-label="Rule type"
            className={selectCls}
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as typeof kind);
              setValue("");
            }}
          >
            <option value="area">Area contains</option>
            <option value="language">Language is</option>
            <option value="source">Source is</option>
          </select>
          {kind === "area" ? (
            <Input
              aria-label="Area"
              className="h-9 w-48"
              placeholder="e.g. Marina"
              maxLength={100}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          ) : (
            <select
              aria-label="Value"
              className={selectCls}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            >
              <option value="" disabled>
                Choose…
              </option>
              {kind === "language"
                ? LANGS.map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))
                : LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}
            </select>
          )}
          <span className="pb-2 text-sm text-muted-foreground">→</span>
          <select
            aria-label="Agent"
            className={selectCls}
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
          >
            {data.members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {memberName(m)}
              </option>
            ))}
          </select>
          <Button
            type="submit"
            size="sm"
            className="h-9"
            disabled={busy || !value.trim() || !agentId}
          >
            <Plus className="size-4" />
            Add rule
          </Button>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-background p-5">
        <h2 className="font-semibold">2. Taking turns</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Agents switched on share leads no rule catches, one each in turn.
        </p>
        {agents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No agents yet. Invite them on the{" "}
            <Link to="/team" className="underline">
              Team
            </Link>{" "}
            page. Until then new leads wait in the pool for you.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {agents.map((m) => (
              <li key={m.user_id} className="flex items-center justify-between px-3 py-2">
                <span>{memberName(m)}</span>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  {m.in_rotation ? "Getting leads" : "Paused"}
                  <Switch
                    checked={m.in_rotation}
                    disabled={busy}
                    onCheckedChange={(on) =>
                      void run(() => rotation({ data: { userId: m.user_id, on } }))
                    }
                  />
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-background p-5">
        <h2 className="font-semibold">3. Lead pool</h2>
        <form
          className="mt-3 flex flex-wrap items-end gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              () =>
                savePool({
                  data: {
                    pool_after_minutes: Math.round(Number(minutes) || 15),
                    pool_daily_limit: Math.round(Number(limit) || 5),
                  },
                }),
              "Pool settings saved.",
            );
          }}
        >
          <label className="text-sm">
            Back to pool if no reply in (minutes)
            <Input
              className="mt-1 h-9 w-32"
              type="number"
              min={5}
              max={1440}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Pool leads an agent can take a day
            <Input
              className="mt-1 h-9 w-32"
              type="number"
              min={1}
              max={100}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
          </label>
          <Button type="submit" size="sm" variant="outline" className="h-9" disabled={busy}>
            Save
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          &quot;No reply&quot; means the agent sent no message and booked no viewing. AI replies
          don&apos;t count. A lead you assign by hand never goes back to the pool by itself.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-background p-5">
        <h2 className="font-semibold">4. Connect portals, ads and your website</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Anything that can send a web request (Zapier, Make, a Meta lead form, your website form, a
          portal lead email parser) can post leads here. A repeat phone number is added to the
          existing lead, not duplicated.
        </p>
        {data.intake ? (
          <div className="space-y-2 text-sm">
            <Field label="Address (POST)" value={endpoint} onCopy={() => void copy(endpoint)} />
            <Field
              label="Secret key (header x-intake-key)"
              value={data.intake.token}
              onCopy={() => void copy(data.intake?.token ?? "")}
              secret
            />
            <p className="text-xs text-muted-foreground">
              Last lead received:{" "}
              {data.intake.last_used_at
                ? new Date(data.intake.last_used_at).toLocaleString("en-GB", {
                    timeZone: "Asia/Dubai",
                  })
                : "none yet"}
            </p>
            <details className="rounded-lg bg-muted/50 p-3">
              <summary className="cursor-pointer text-sm font-medium">What to send</summary>
              <pre className="mt-2 overflow-x-auto text-xs">{`{
  "name": "Sara K",
  "phone": "+971501112222",
  "email": "sara@example.com",
  "source": "Bayut",            // Property Finder, Dubizzle, Facebook, Website…
  "area": "Dubai Marina",
  "budget": "AED 2.1M",
  "language": "English",
  "message": "Is the 2BR still available?",
  "listing_ref": "BY-123456",
  "campaign": "Marina off-plan"   // matches a campaign name on the Ads page
}`}</pre>
            </details>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                if (window.confirm("Make a new key? The old key stops working at once."))
                  void run(
                    () => rotateKey(),
                    "New key ready. Update it in Zapier or your website.",
                  );
              }}
            >
              <KeyRound className="size-4" />
              Make a new key
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => void run(() => rotateKey(), "Key ready.")}
          >
            <KeyRound className="size-4" />
            Create my lead key
          </Button>
        )}
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onCopy,
  secret,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  secret?: boolean;
}) {
  const [show, setShow] = useState(!secret);
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs">
          {show ? value : "•".repeat(24)}
        </code>
        {secret && (
          <Button variant="ghost" size="sm" onClick={() => setShow(!show)}>
            {show ? "Hide" : "Show"}
          </Button>
        )}
        <Button variant="ghost" size="icon" aria-label={`Copy ${label}`} onClick={onCopy}>
          <Copy className="size-4" />
        </Button>
      </div>
    </div>
  );
}
