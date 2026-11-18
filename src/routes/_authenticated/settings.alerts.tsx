import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { BellRing, MessageCircle, Smartphone } from "lucide-react";
import {
  getMyAlertSettings,
  removePushSubscription,
  saveMyAlerts,
  savePushSubscription,
  submitAlertTemplate,
} from "@/lib/alerts.functions";
import { ALERT_TEMPLATE, mobileDigits } from "@/lib/alerts";
import {
  currentSubscription,
  playChime,
  pushSupport,
  subscribeThisDevice,
  unsubscribeThisDevice,
  type PushSupport,
} from "@/lib/push-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const alertsQuery = queryOptions({ queryKey: ["my-alerts"], queryFn: () => getMyAlertSettings() });

export const Route = createFileRoute("/_authenticated/settings/alerts")({
  head: () => ({
    meta: [
      { title: "My alerts — Dubai AI GCI" },
      { name: "description", content: "Phone notifications and WhatsApp alerts for new leads." },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(alertsQuery),
  component: AlertsPage,
});

const TEMPLATE_STATUS: Record<string, string> = {
  pending: "Waiting for Meta review (usually 1–2 days)",
  approved: "Approved: WhatsApp alerts are live",
  rejected: "Rejected by Meta",
  paused: "Paused by Meta",
  disabled: "Disabled by Meta",
};

function AlertsPage() {
  const { data } = useSuspenseQuery(alertsQuery);
  const client = useQueryClient();
  const save = useServerFn(saveMyAlerts);
  const saveSub = useServerFn(savePushSubscription);
  const removeSub = useServerFn(removePushSubscription);
  const submitTemplate = useServerFn(submitAlertTemplate);
  const [mobile, setMobile] = useState(data.mobile);
  const [push, setPush] = useState(data.alertPush);
  const [whatsapp, setWhatsapp] = useState(data.alertWhatsapp);
  const [support, setSupport] = useState<PushSupport>("unsupported");
  const [thisDevice, setThisDevice] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setSupport(pushSupport());
    void currentSubscription().then((s) =>
      setThisDevice(!!s && data.subscriptions.some((x) => x.endpoint === s.endpoint)),
    );
  }, [data.subscriptions]);

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      await fn();
      await client.invalidateQueries({ queryKey: ["my-alerts"] });
      setMsg(done);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const mobileOk = !mobile.trim() || mobileDigits(mobile) !== null;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My alerts</h1>
        <p className="text-sm text-muted-foreground">
          Get told the moment a lead is yours, again if it is still waiting, and (owners) when one
          goes back to the pool. The bell at the top of every page shows the same alerts.
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
        <h2 className="flex items-center gap-2 font-semibold">
          <Smartphone className="size-4" />
          Phone notifications
        </h2>
        <p className="mb-3 mt-1 text-sm text-muted-foreground">
          Turn this on once on each phone or computer you use. It shows on the lock screen even when
          the app is closed.
        </p>
        {support === "ios-needs-home-screen" ? (
          <p className="rounded-lg bg-muted/60 p-3 text-sm">
            On iPhone: tap <strong>Share</strong> → <strong>Add to Home Screen</strong>, open the
            app from the Home Screen, then come back to this page. (iOS 16.4 or newer.)
          </p>
        ) : support === "unsupported" ? (
          <p className="rounded-lg bg-muted/60 p-3 text-sm">
            This browser can&apos;t show phone notifications. Try Chrome or Safari.
          </p>
        ) : support === "blocked" ? (
          <p className="rounded-lg bg-muted/60 p-3 text-sm">
            Notifications are blocked for this site. Allow them in the browser&apos;s site settings,
            then reload.
          </p>
        ) : thisDevice ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              On for this device
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const endpoint = await unsubscribeThisDevice();
                  if (endpoint) await removeSub({ data: endpoint });
                  setThisDevice(false);
                }, "Phone notifications are off for this device.")
              }
            >
              Turn off here
            </Button>
          </div>
        ) : (
          <Button
            disabled={busy || !data.publicKey}
            onClick={() =>
              void run(async () => {
                const sub = await subscribeThisDevice(data.publicKey);
                await saveSub({ data: sub });
                setThisDevice(true);
              }, "Phone notifications are on for this device.")
            }
          >
            <BellRing className="size-4" />
            Turn on for this device
          </Button>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Devices with notifications on: {data.subscriptions.length}.{" "}
          <button type="button" className="underline" onClick={playChime}>
            Play the in-app sound
          </button>
        </p>
      </section>

      <section className="rounded-xl border border-border bg-background p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <MessageCircle className="size-4" />
          WhatsApp alerts and my settings
        </h2>
        <form
          className="mt-3 grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => save({ data: { mobile, push, whatsapp } }), "Saved.");
          }}
        >
          <label className="text-sm">
            My mobile for WhatsApp alerts (with country code)
            <Input
              className={`mt-1 h-9 max-w-xs ${mobileOk ? "" : "border-destructive"}`}
              placeholder="+971 50 123 4567"
              maxLength={30}
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm sm:max-w-md">
            Phone notifications
            <Switch checked={push} onCheckedChange={setPush} />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm sm:max-w-md">
            WhatsApp alerts to my mobile
            <Switch checked={whatsapp} onCheckedChange={setWhatsapp} />
          </label>
          <div>
            <Button type="submit" size="sm" disabled={busy || !mobileOk}>
              Save
            </Button>
          </div>
        </form>
      </section>

      {data.isOwner && (
        <section className="rounded-xl border border-border bg-background p-5">
          <h2 className="font-semibold">WhatsApp alerts for the whole team (owner)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Alerts go out from your agency&apos;s WhatsApp number using one message Meta must
            approve first:
          </p>
          <blockquote className="my-3 rounded-lg border-l-4 border-primary/40 bg-muted/40 px-3 py-2 text-sm">
            {ALERT_TEMPLATE.body}
          </blockquote>
          {!data.whatsappConnected ? (
            <p className="text-sm">
              Connect WhatsApp first in{" "}
              <Link to="/settings/whatsapp" className="underline">
                Settings → WhatsApp
              </Link>
              .
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              {data.template && (
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${data.template.status === "approved" ? "bg-primary/10 text-primary" : data.template.status === "pending" ? "bg-warning/15 text-warning-foreground" : "bg-destructive/10 text-destructive"}`}
                >
                  {TEMPLATE_STATUS[data.template.status] ?? data.template.status}
                  {data.template.detail ? `: ${data.template.detail}` : ""}
                </span>
              )}
              <Button
                size="sm"
                variant={data.template ? "outline" : "default"}
                disabled={busy}
                onClick={() =>
                  void run(
                    () => submitTemplate(),
                    data.template
                      ? "Status refreshed."
                      : "Sent to Meta for review. Check back in a day.",
                  )
                }
              >
                {data.template ? "Check approval" : "Send to Meta for approval"}
              </Button>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Each agent adds their own mobile on this page. While WhatsApp test mode is on, only
            numbers on the safety list get alerts.
          </p>
        </section>
      )}
    </main>
  );
}
