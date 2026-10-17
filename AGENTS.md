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
- Private listing and reply-settings routes live under the client-only authenticated layout; server functions verify owner claims and use the caller's RLS-scoped client.
- Listing freshness and future AI eligibility derive from timestamps in the browser-safe listings module; nightly SQL persists the check flag without replacing the exact-time read filter.
- Inventory sources use source/external_id identity and source adapters; connected adapters must upsert inventory before the nightly freshness check, never confirm unchanged listings automatically.
- Listing map fallback, filtering, permit validation and WhatsApp content use browser-safe listings helpers with unit tests; enforce permits again in the database to protect every write path.
- Listing details use their own authenticated route and Embla swipe gallery; duplicated listings copy uploaded photos, videos and floor plans into independent paths so deleting either unit cannot break the other.
- Store shareable photos separately from private videos/floor plans; resolve sharing through an owner-checked function that verifies permanent public access, never copy expiring signed or bundled asset URLs.
- Listing AI detail validation and field definitions live in a browser-safe helper shared by CSV, editor and details views to keep optional values consistent.
- Future reply defaults and validation live in a browser-safe module; owner-edited settings persist in an RLS-protected singleton, without activating messaging automation.
- Owner app modules: settings.ts, knowledge.ts, market.ts, leads-app.ts, documents.ts are browser-safe helpers with unit tests; their *.functions.ts counterparts are owner-gated via requireSupabaseAuth + isOwnerEmail.
- The AI reply brain lives in src/lib/chat.server.ts (createOpenAI + generateText against the Lovable AI gateway, openai/gpt-6-astra); conversation flow in leads-app.functions.ts inserts client/AI/owner messages, checks AML flags privately, and queues replies during client quiet hours (9pm-8am).
- Test Chat policy and consent transitions live in browser-safe chat-policy.ts with tests; persist invitation/offered/selected state in reserved learned fields so generated prose cannot bypass booking agreement. Shared viewing-slots.ts and viewings.server.ts calculate availability for both chat and Viewings; recheck slots before booking and confirm only after a successful insert.
- AI calls use the gateway URL + LOVABLE_API_KEY headers pattern from leads.server.ts; @lovable.dev/ai-gateway stays uninstalled until the bunfig 24h minimumReleaseAge allows it.
- Document Vault files live in the private "documents" bucket under one folder per client name; 10-minute signed links only, every upload/view/delete logged in document_log, deletion blocked inside the retention period.
- Owner pages render inside OwnerLayout (nav + "Powered by Elite Visions" footer) from _authenticated/route.tsx.
