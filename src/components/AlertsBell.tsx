import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { listAlerts, markAlertRead } from "@/lib/leads-app.functions";
import { markAllAlertsRead } from "@/lib/alerts.functions";
import { alertIcon, alertTitle, timeAgo } from "@/lib/alerts";
import { playChime } from "@/lib/push-client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

/** Header bell: unread alerts, checked every 30 seconds, with a chime when a new one arrives. */
export function AlertsBell() {
  const client = useQueryClient();
  const markRead = useServerFn(markAlertRead);
  const markAll = useServerFn(markAllAlertsRead);
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => listAlerts(),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  const unread = (data ?? []).filter((a) => !a.read);
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!data) return;
    const ids = data.filter((a) => !a.read).map((a) => a.id);
    if (seen.current && ids.some((id) => !seen.current?.has(id))) playChime();
    seen.current = new Set([...(seen.current ?? []), ...ids]);
  }, [data]);

  const refresh = () => void client.invalidateQueries({ queryKey: ["alerts"] });
  const now = new Date();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unread.length ? `${unread.length} new alerts` : "Alerts"}
          className="relative flex size-11 items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:text-foreground md:size-9"
        >
          <Bell className="size-4" />
          {unread.length > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-semibold text-destructive-foreground">
              {unread.length > 99 ? "99+" : unread.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <p className="text-sm font-semibold">Alerts</p>
          {unread.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={async () => {
                await markAll();
                refresh();
              }}
            >
              Mark all read
            </Button>
          )}
        </div>
        {unread.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            You're all caught up.
          </p>
        ) : (
          <ul className="max-h-96 divide-y divide-border overflow-y-auto">
            {unread.slice(0, 20).map((a) => (
              <li key={a.id}>
                <Link
                  to={a.lead_id ? "/lead/$leadId" : "/inbox"}
                  params={a.lead_id ? { leadId: a.lead_id } : {}}
                  onClick={async () => {
                    setOpen(false);
                    await markRead({ data: a.id });
                    refresh();
                  }}
                  className="flex gap-3 px-4 py-3 hover:bg-muted/50"
                >
                  <span aria-hidden className="text-base leading-5">
                    {alertIcon(a.kind)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{alertTitle(a.kind)}</span>
                    <span className="block text-sm text-muted-foreground">{a.message}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {timeAgo(a.created_at, now)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-border px-4 py-2.5 text-xs">
          <Link
            to="/settings/alerts"
            onClick={() => setOpen(false)}
            className="text-muted-foreground underline"
          >
            Phone and WhatsApp alerts
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
