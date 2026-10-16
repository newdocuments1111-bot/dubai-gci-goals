<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep GCI and completion-time calculations in the browser-safe `src/lib/gci.ts` module with unit tests; the page uses the same calculations for both input modes to avoid inconsistent targets.
- Real HubSpot leads are fetched only after a server-side owner check in the lead server function; the UI gate is cosmetic.
- Private listing routes live under the client-only authenticated layout; listing server functions verify owner claims and use the caller's RLS-scoped client, including signed media reads.
- Listing freshness and future AI eligibility derive from timestamps in the browser-safe listings module; nightly SQL persists the check flag without replacing the exact-time read filter.
- Inventory sources use source/external_id identity and source adapters; connected adapters must upsert inventory before the nightly freshness check, never confirm unchanged listings automatically.
- Listing map fallback, filtering, permit validation and WhatsApp content use browser-safe listings helpers with unit tests; enforce permits again in the database to protect every write path.
- Listing details use their own authenticated route and Embla swipe gallery; duplicated listings copy private media into independent paths so deleting either unit cannot break the other.
