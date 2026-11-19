import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  connectMetaAds,
  disconnectMetaAds,
  getMetaAdsConnection,
  syncMetaAdsNow,
} from "@/lib/meta-ads.functions";
import { adsManagerUrl, syncTimeLabel as syncTime } from "@/lib/meta-ads";

const metaConnectionQuery = queryOptions({
  queryKey: ["meta-ads-connection"],
  queryFn: () => getMetaAdsConnection(),
});

/** Owner-only card in Settings: connect a Meta ad account. The token is sent once and never shown again. */
export function MetaAdsConnection() {
  const { data, isLoading, error: loadError } = useQuery(metaConnectionQuery);
  const client = useQueryClient();
  const connect = useServerFn(connectMetaAds);
  const disconnect = useServerFn(disconnectMetaAds);
  const sync = useServerFn(syncMetaAdsNow);
  const [adAccountId, setAdAccountId] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: metaConnectionQuery.queryKey }),
      client.invalidateQueries({ queryKey: ["meta-ads-report"] }),
    ]);
  const run = async (task: () => Promise<string>) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      setMessage(await task());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  return (
    <section className="mb-6 rounded-lg border border-border p-4 text-sm">
      <h2 className="font-semibold">Meta ads</h2>
      <p className="mb-3 text-muted-foreground">
        Shows spend, leads and deals per Meta campaign, ad set and ad on the Ads page. The CRM only
        reads from Meta: it never changes, pauses or creates ads.
      </p>
      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : loadError ? (
        <p role="alert" className="text-destructive">
          Could not load the Meta connection.
        </p>
      ) : data?.setupMissing ? (
        <p className="rounded-md bg-muted p-3">
          Meta ads needs a database update before it can be connected. Ask support to add it.
        </p>
      ) : data?.connected ? (
        <div className="space-y-3">
          <p>
            <span className="rounded bg-primary/15 px-1.5 text-[10px] font-bold uppercase text-primary">
              Connected
            </span>{" "}
            {data.accountName || data.adAccountId} · {data.adAccountId} · {data.currency} · last
            sync {syncTime(data.lastSyncAt)}
          </p>
          {data.lastSyncOk === false && data.lastSyncMessage && (
            <p role="alert" className="text-destructive">
              Last sync failed: {data.lastSyncMessage}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const r = await sync();
                  return `Synced ${r.rows} daily ad rows (${r.since} to ${r.until}).`;
                })
              }
            >
              <RefreshCw className="size-4" />
              Sync now
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={adsManagerUrl(data.adAccountId)} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                Open in Meta Ads Manager
              </a>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (
                  !window.confirm(
                    "Disconnect Meta? The token is deleted from the CRM. Your ads in Meta are not touched.",
                  )
                )
                  return;
                void run(async () => {
                  await disconnect();
                  return "Disconnected. The token was deleted.";
                });
              }}
            >
              Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const r = await connect({ data: { adAccountId, token } });
              setToken("");
              return r.syncError
                ? `Connected to ${r.accountName || adAccountId}, but the first sync failed: ${r.syncError}`
                : `Connected to ${r.accountName || adAccountId}. Spend is in ${r.currency}.`;
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Ad account ID
              <Input
                className="mt-1"
                placeholder="act_1234567890"
                maxLength={40}
                autoComplete="off"
                value={adAccountId}
                onChange={(e) => setAdAccountId(e.target.value)}
              />
            </label>
            <label className="text-sm">
              System user access token
              <Input
                className="mt-1"
                type="password"
                autoComplete="off"
                maxLength={2000}
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </label>
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              <strong>Ad account ID:</strong> Meta Business Settings → Accounts → Ad accounts. It
              starts with act_ (you can also type just the number).
            </p>
            <p>
              <strong>Token:</strong> Meta Business Settings → Users → System users → pick or add a
              system user → Assign assets → your ad account (view performance). Then Generate new
              token, pick your app and tick <code>ads_read</code> (and <code>leads_retrieval</code>{" "}
              if you also use it for lead forms).
            </p>
            <p>
              The token is checked with Meta, kept on the server only and never shown again — not
              even to you. Disconnect deletes it.
            </p>
          </div>
          <Button type="submit" disabled={busy || !adAccountId.trim() || !token.trim()}>
            {busy ? "Checking with Meta…" : "Connect"}
          </Button>
        </form>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
