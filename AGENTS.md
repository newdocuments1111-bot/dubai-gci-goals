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
- Real HubSpot leads and "Save to HubSpot" stay Elite Visions-only (owner email / HQ check server-side) because HubSpot is HQ's own connected account; the UI gate is cosmetic.
- Multi-agency access: every business row has agency_id (default my_agency_id(), child rows inherit from their lead by trigger); RLS helpers is_hq_admin/is_agency_member/is_agency_owner/can_access_lead enforce hq (read all), owner (whole agency) and agent (agency rows + assigned leads). Server functions call getAccess()/requireOwner()/requireHq() from browser-safe agency-access.ts and always filter list queries by the caller's agency so HQ never sees mixed agencies on normal pages.
- Private routes live under the client-only _authenticated layout, which loads the membership into route context (useMembership) and sends people without an agency to /onboarding; self sign-up creates an agency via create_my_agency, invites go through the admin invite API only after an owner/HQ check, and the plan login limit is enforced again by a database trigger.
- Storage paths are agency-scoped: documents/<agency>/<client>/…, listing-media|listing-photos/<listings|photos>/<agency>/…, chat-media/<lead>/…; single-level legacy listing files belong to Demo Agency.
- Deal maths, goals, login limits, leaderboard and hours-saved live in browser-safe agency.ts with tests; ai_handled and closed_at are set by the deals trigger, usage_events rows come from a chat_messages trigger so the billing meter cannot be skipped.
- Missed-lead alerts are created by check_missed_leads() when the home or HQ screen loads (no polling job), since alerts are only shown in the app.
- Paperwork (Form F / Ejari) drafts and checklists come from browser-safe paperwork.ts using vault file names; drafts are always labelled as drafts and never filed anywhere.
- Market insights (price per sq ft by area/type/month) are computed in browser-safe market.ts from shared market_transactions; shared market data and UAE knowledge are read by every agency and edited only by HQ.
- Listing freshness and future AI eligibility derive from timestamps in the browser-safe listings module; nightly SQL persists the check flag without replacing the exact-time read filter.
- Inventory sources use source/external_id identity and source adapters; connected adapters must upsert inventory before the nightly freshness check, never confirm unchanged listings automatically.
- Listing map fallback, filtering, permit validation and WhatsApp content use browser-safe listings helpers with unit tests; enforce permits again in the database to protect every write path.
- Listing details use their own authenticated route and Embla swipe gallery; duplicated listings copy uploaded photos, videos and floor plans into independent paths so deleting either unit cannot break the other.
- Store shareable photos separately from private videos/floor plans; resolve sharing through an owner-checked function that verifies permanent public access, never copy expiring signed or bundled asset URLs.
- Listing AI detail validation and field definitions live in a browser-safe helper shared by CSV, editor and details views to keep optional values consistent.
- Future reply defaults and validation live in a browser-safe module; app_settings and ai_reply_settings hold one row per agency (unique agency_id, owner-only writes), without activating messaging automation.
- Owner app modules: settings.ts, knowledge.ts, market.ts, leads-app.ts, documents.ts are browser-safe helpers with unit tests; their *.functions.ts counterparts use requireSupabaseAuth + agency access checks.
- The AI reply brain lives in src/lib/chat.server.ts (createOpenAI + generateText against the Lovable AI gateway, openai/gpt-6-astra); conversation flow in leads-app.functions.ts inserts client/AI/owner messages, checks AML flags privately, and queues replies during client quiet hours (9pm-8am).
- Test Chat policy and consent transitions live in browser-safe chat-policy.ts with tests; persist invitation/offered/selected state in reserved learned fields so generated prose cannot bypass booking agreement. Shared viewing-slots.ts and viewings.server.ts calculate availability for both chat and Viewings; recheck slots before booking and confirm only after a successful insert.
- New media and public-demo AI calls use the generated @lovable.dev/ai-gateway contracts; existing text and HubSpot calls retain their transport and model to avoid unrelated behavior changes.
- Chat media is inspected before private storage; identity-document images never enter storage or model conversation history, and owner-only thread reads resolve short-lived media links.
- Public demo context comes exclusively from browser-safe fictional fixtures; its privileged server access is limited to an atomic daily visitor counter, never owner data.
- Phone installation uses manifest-only metadata and derived app icons without a service worker so preview pages cannot become stale.
- Revival drafts require opted-in inactive leads, are deduplicated, and approval atomically rechecks consent/STOP/timing before adding any message.
- Document Vault files live in the private "documents" bucket under one folder per client name; 10-minute signed links only, every upload/view/delete logged in document_log, deletion blocked inside the retention period.
- Private pages render inside OwnerLayout (role-aware nav + "Powered by Elite Visions" footer) from _authenticated/route.tsx.
- Chat coaching uses the generated @lovable.dev/ai-gateway contract in coach.server.ts; the conversation is passed as untrusted data.
