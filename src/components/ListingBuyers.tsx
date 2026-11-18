import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { listLeads } from "@/lib/leads-app.functions";
import { matchBuyers, type MatchListing } from "@/lib/inbox";

/** Open buyers whose area and budget fit this listing (the same test the Inbox uses the other way round). */
export function ListingBuyers({ listing }: { listing: MatchListing }) {
  const { data: leads, isLoading } = useQuery({ queryKey: ["leads"], queryFn: () => listLeads() });
  const buyers = leads ? matchBuyers(listing, leads, 10) : [];
  return (
    <section aria-label="Matching buyers" className="mt-8 rounded-xl border border-border p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Users className="size-5" />
        Matching buyers{" "}
        {leads && (
          <span className="text-sm font-normal text-muted-foreground">({buyers.length})</span>
        )}
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Open buyers whose area or budget fits this listing. Budget fits when the price is between
        60% and 110% of it.
      </p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Checking your leads…</p>
      ) : buyers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No open buyer fits this listing yet.</p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {buyers.map((b) => (
            <li key={b.id}>
              <Link
                to="/lead/$leadId"
                params={{ leadId: b.id }}
                className="flex flex-wrap items-center gap-x-3 py-2 hover:underline"
              >
                <span className="font-medium">{b.name || "Unnamed lead"}</span>
                <span className="text-muted-foreground">
                  {[b.area, b.budget].filter(Boolean).join(" · ")}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">{b.score}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
