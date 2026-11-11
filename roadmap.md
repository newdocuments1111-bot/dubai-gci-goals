# Roadmap — full app build (uploaded spec)

## Current request: multilingual replies + Monday reports + post-viewing follow-up
- [ ] A. Language memory, translated booking/STOP strings, original + English conversation display, Test Chat controls, tests
- [ ] B. Owner/HQ weekly report, real-row metrics, goal gaps, Monday snapshots through hourly job, home summary, tests
- [ ] C. One consent-safe, agent-approved 48-hour post-viewing draft per viewing, multilingual matching options, tests
- [ ] Run existing tests and verify authenticated flows; report migrations and any blockers

## Current request: vault storage fix + WhatsApp part 2 (templates + send queue)
- [x] Vault: private, lead folders, owner/assigned agent/HQ only, server-only signed links, every view logged; security scan clean
- [x] message_templates + Templates page (write, preview, submit to Meta, Sync status, webhook status updates, marketing STOP line)
- [x] whatsapp_outbox + send rules (consent log, not stopped, approved, 9am–8pm Dubai, 7-day marketing gap, safety list) with tests
- [x] Per-agency approve/auto setting, Queue page (filters, approve/edit/cancel, send log; agents own leads only), lead "Send template"
- [x] 5-minute send job (usage_events, WhatsApp id for ticks); published
- [ ] First real template submitted to Meta and sent — waiting on the user (Meta review up to 48h); agent-role session not tested end-to-end (no agent account)


## Current request: WhatsApp Cloud API (Meta, direct) — part 1 (A + B) built; parts 2–3 later
- [x] A. Per-agency WhatsApp settings (phone_number_id, WABA id, display number, status, test-recipient safety list); Demo Agency on Meta test number
- [ ] A. Secrets WHATSAPP_ACCESS_TOKEN / WHATSAPP_APP_SECRET / WHATSAPP_VERIFY_TOKEN — waiting on the user to add them in Project Settings → Secrets
- [x] A. Webhook /api/public/whatsapp/webhook: GET verify, POST X-Hub-Signature-256; text, voice, image, location, buttons, statuses; stored inbox + recovery on later deliveries
- [x] A. Shared AI reply logic with Test Chat (ai_paused/flagged/stopped), Graph send, usage_events whatsapp_message + ai_reply, CRM fill
- [x] A. Agent takeover replies sent to WhatsApp; 24-hour rule; STOP/unsubscribe/توقف/إلغاء
- [x] A. Settings → WhatsApp page: callback URL, verify-token name, status, test mode, safety list, Send test message
- [x] B. Voice notes via media API + existing transcription
- [ ] Live test from a real phone — waiting on secrets + Meta webhook setup
- [ ] C. message_templates page (write, submit, sync); start-message rules (consent log, not stopped, approved, 9am–8pm Dubai, 7-day marketing gap); "Reply STOP to stop"; send queue approve/auto; send log
- [ ] D. Wake old leads on new listing / price drop
- [ ] E. Off-plan "New launch" matching
- [ ] F. Rental renewals 90/60 days to tenant + landlord, agent task, outcome cancels reminders
- [ ] G. Referral asks X days after close (default 30); referral leads source 'referral'

## Current request: AI Vision 2.0 (multi-agency, GCI, owner tools) — WhatsApp NOT connected
- [x] 1. Agencies + members (hq_admin/owner/agent), agency_id everywhere, assigned agent on leads, Demo Agency backfill, access rules per role
- [x] 1b. Onboarding: self sign-up creates agency; HQ creates agency + invites owner; owners invite agents within plan_logins (limit message verified); goal_setting_mode in Settings
- [x] 2. Deals + GCI (agent/agency share), lead → deal (verified: AED 2M × 2% → 40,000 / 20,000 / 20,000)
- [x] 3. Agent home (GCI month/year, goal bar, hot leads, today's viewings, follow-ups due, AI daily summary)
- [x] 4. Owner home, missed-lead alerts (checked when home/HQ opens), leaderboard, Coach me (verified live), Market Insights, Hours saved (estimate)
- [x] 5. CRM fills itself from every chat (verified: area, budget, timing, score, next step)
- [x] 6. Prepare paperwork (checklist + Form F / Ejari draft, "Draft – agent must check")
- [x] 7. Usage meter (one row per AI reply, owner + HQ monthly counts)
- [x] 8. Elite Visions HQ screen (table, edit plan/fee/status, create agency + invite owner)
- [x] Tests for money/limit/goal/paperwork/insights/CRM rules (80 passing)
- [ ] Live check of an invited agent's login and invite emails — not run (would send real emails); needs a real agent email from the user

Keep calculator, Lead Finder, My Listings, AI Reply Rules working as-is. Owner-only unless stated.

## Current request: media, agency demo, phone app, export, revival
- [x] Upload/record voice notes, transcription and same-language replies (English and Spanish live-tested)
- [x] Image understanding with confidential document rejection (fictional screenshot and passport tested; no identity attachment persisted)
- [x] Public sample-only /demo, Demo Realty, server-checked 20/day visitor counter (20th accepted, 21st rejected, allowance survives reload)
- [x] Home demo button and manifest-only phone installation with icons (icons/head/manifest verified; physical phone installation requires published update)
- [x] Owner-only Leads CSV export (download and eight columns verified)
- [x] Verify/build consent-only old-lead revival drafts and approval checks (30-day default, one draft per lead; consent/STOP exclusions and withdrawn-consent rejection verified)
- [x] Test each flow and give short checklist (66 unit tests passed; owner and public browser flows checked)

## Current request: final update (tone, area guide, reminders, stats)
- [x] Warm guided conversation: location → purpose → budget/timing → appointment, compliments before questions, no "no data" phrasing, Hot on 4 signs or viewing/offer intent
- [x] Area Guide: 10 Dubai areas in UAE Knowledge, editable, marked verify
- [x] Sample Marina apartment set Available with permit TEST-123, checked today
- [x] Scheduled reminders (hourly job): day-before viewing 6pm client time, lease-end 120 days, anniversary 7 days, off-plan payment 7 days — all drafts to Follow-ups
- [x] Manager statistics page (/stats): leads by source, scores by source, viewings/valuations/offers, avg AI first-reply time, weekly/monthly
- [x] "Use my real rates" button on Calculator (owner only; calls→talks stays manual)
- [ ] Email alerts for Hot/AML — blocked: needs an email domain the user owns (setup dialog shown)
- [x] Voice notes / image understanding — completed after the package safety window

## A. Foundations
- [x] Make listing-photos bucket public and verify WhatsApp photo links open without login
- [x] Settings page: agent name, agency name, RERA/BRN, working days/hours, viewing length, UAE holidays (pre-filled, editable), compliance officer email, document retention (default 5 years), mortgage partner name
- [x] Navigation: Dashboard · Test Chat · Leads · Viewings · Follow-ups · My Listings · Owners · Market Data · UAE Knowledge · AI Reply Rules · Settings · Calculator · Lead Finder
- [x] Document Vault: private bucket, one folder per client, 10-min signed links, upload/view/delete audit log, retention setting, "delete on request" blocked for legally required records
- [x] Footer on owner pages: "Powered by Elite Visions"

## B. AI reply brain
- [x] Test Chat (WhatsApp-style, play buyer/seller/tenant, follows Reply Rules + UAE Knowledge + eligible listings, sends photo/video/map links, New conversation)
- [x] Voice note transcription + image/screenshot understanding — package installed with the 24h guard intact
- [ ] Reply in client's language; owner-facing summaries in English with original underneath — AI prompt supports it; original-underneath stored on messages
- [x] Time zone from phone country code, editable per lead; no non-urgent messages 9pm–8am client time
- [x] Conversation types: buyer / seller-landlord (book valuation) / tenant
- [x] Mortgage: offer adviser connection (partner name in Settings); never give mortgage advice
- [x] Confidence rule: explain limits honestly without deferred promises; privately flag unsure/legal/financial/contract questions
- [x] Take over / Hand back to AI per conversation
- [x] STOP/consent handling + consent log per contact
- [x] Audit log of every AI message per lead

## C. Leads and alerts
- [x] Leads page: type, full chat, learned facts, Hot/Warm/Cold score, source; "Save to HubSpot" button
- [x] Hot alert: red banner on Dashboard — [ ] email to owner pending (no email infra configured)
- [x] AML red-flag alert (cash ≥ AED 55,000, crypto, third-party payments, ID refusal, rushed deals); never shown to client — [ ] email to compliance officer pending (no email infra configured)

## D. Viewings and follow-ups
- [x] Viewings page: book free slots (Settings hours, holidays, existing bookings), Mark as done / No-show — [ ] day-before 6pm reminder pending (needs a scheduled job)
- [x] Post-viewing follow-up: next morning 10am draft queued on Mark as done; approve on Follow-ups page — [ ] 2-day no-reply draft pending (needs a scheduled job)
- [x] Until WhatsApp connected, "sent" = appears in lead's chat marked Sent

## E. Documents (UAE)
- [x] Per-lead checklist by role (buyer individual/company, seller, landlord, tenant, POA), private upload into Vault, received/missing — [ ] notify owner when complete pending

## F. After the deal
- [ ] Off-plan payment schedule + milestones; reminders 7 days before; milestone updates → Follow-ups approval — tables ready (payment_schedules), UI pending
- [x] Owners page: agreed-to-updates flag, handover date, owner/investor, frequency (3 months default / monthly)
- [ ] Value updates from real Market Data only, with source+date, → Follow-ups approval — Market Data import ready; draft generation pending
- [ ] Home anniversary reminder 7 days before; rental owners: 120-day lease-end reminder — needs a scheduled job
- [x] Old leads revival drafts for approval — owner-triggered, consent-only, after 30 inactive days

## G. Real data
- [x] Market Data page: CSV import of DLD transactions (date, area, building, type, size, price), source + import date shown
- [x] UAE Knowledge page: editable facts with source + last verified; >6 months shows "please re-verify"; pre-filled with spec facts marked "verify before going live"

## H. Dashboard and proof
- [x] Dashboard (owner home): today's Hot leads, viewings, pending follow-ups, AML alerts — [ ] missing documents + avg AI first-reply time pending
- [ ] Manager stats: leads by source, scores by source, viewings, offers, valuations, response time, per week/month
- [ ] Real conversion rates + "Use my real rates" button on Calculator
