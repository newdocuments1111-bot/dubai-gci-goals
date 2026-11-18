import { useQuery } from "@tanstack/react-query";
import { getTargets } from "@/lib/team.functions";
import { targetProgress } from "@/lib/sellers";
import { Progress } from "@/components/ui/progress";

const aed = (n: number) => `AED ${Math.round(n).toLocaleString("en-US")}`;

function Bar({
  label,
  actual,
  target,
  money,
}: {
  label: string;
  actual: number;
  target: number | null;
  money?: boolean;
}) {
  const p = targetProgress(actual, target);
  const fmt = (n: number) => (money ? aed(n) : String(n));
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span>
          <strong>{fmt(actual)}</strong>
          {p ? ` of ${fmt(target as number)}` : ""}
          {p?.hit && <span className="ml-1 text-primary">· hit</span>}
        </span>
      </div>
      {p ? (
        <Progress value={p.percent} className="mt-1 h-1.5" aria-label={`${label} progress`} />
      ) : (
        <p className="text-[11px] text-muted-foreground">No target set</p>
      )}
    </div>
  );
}

/** This month against monthly targets: your own, your team's if you lead one, everyone for the owner. */
export function TargetsCard({ onlyMe }: { onlyMe?: boolean }) {
  const { data } = useQuery({ queryKey: ["targets"], queryFn: () => getTargets() });
  const rows = (data ?? []).filter((r) => !onlyMe || r.isMe);
  if (rows.length === 0) return null;
  const anyTarget = rows.some((r) => r.targetGci || r.targetViewings || r.targetCalls);
  return (
    <section
      aria-label="Monthly targets"
      className="rounded-xl border border-border bg-background p-5 shadow-xs"
    >
      <h2 className="mb-1 font-semibold">This month against target</h2>
      {!anyTarget && (
        <p className="mb-2 text-xs text-muted-foreground">
          No targets set yet. The owner sets them on the Team page.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <div key={r.userId} className="space-y-2 rounded-lg border border-border p-3">
            <p className="text-sm font-medium">
              {r.name}
              {r.isMe && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">(you)</span>
              )}
            </p>
            <Bar label="GCI closed" actual={r.gci} target={r.targetGci} money />
            <Bar label="Viewings done" actual={r.viewings} target={r.targetViewings} />
            <Bar label="Calls logged" actual={r.calls} target={r.targetCalls} />
          </div>
        ))}
      </div>
    </section>
  );
}
