# Roadmap — full app build (uploaded spec)

Keep calculator, Lead Finder, My Listings, AI Reply Rules working as-is. Owner-only unless stated.

## Current request: final update (tone, area guide, reminders, stats)
- [x] Warm guided conversation: location → purpose → budget/timing → appointment, compliments before questions, no "no data" phrasing, Hot on 4 signs or viewing/offer intent
- [x] Area Guide: 10 Dubai areas in UAE Knowledge, editable, marked verify
- [x] Sample Marina apartment set Available with permit TEST-123, checked today
- [x] Scheduled reminders (hourly job): day-before viewing 6pm client time, lease-end 120 days, anniversary 7 days, off-plan payment 7 days — all drafts to Follow-ups
- [x] Manager statistics page (/stats): leads by source, scores by source, viewings/valuations/offers, avg AI first-reply time, weekly/monthly
- [x] "Use my real rates" button on Calculator (owner only; calls→talks stays manual)
- [ ] Email alerts for Hot/AML — blocked: needs an email domain the user owns (setup dialog shown)
- [ ] Voice notes / image understanding — skipped: AI package still inside the 24h safety window

## A. Foundations
- [x] Make listing-photos bucket public and verify WhatsApp photo links open without login
- [x] Settings page: agent name, agency name, RERA/BRN, working days/hours, viewing length, UAE holidays (pre-filled, editable), compliance officer email, document retention (default 5 years), mortgage partner name
- [x] Navigation: Dashboard · Test Chat · Leads · Viewings · Follow-ups · My Listings · Owners · Market Data · UAE Knowledge · AI Reply Rules · Settings · Calculator · Lead Finder
- [x] Document Vault: private bucket, one folder per client, 10-min signed links, upload/view/delete audit log, retention setting, "delete on request" blocked for legally required records
- [x] Footer on owner pages: "Powered by Elite Visions"

## B. AI reply brain
- [x] Test Chat (WhatsApp-style, play buyer/seller/tenant, follows Reply Rules + UAE Knowledge + eligible listings, sends photo/video/map links, New conversation)
- [ ] Voice note transcription + image/screenshot understanding — blocked: @lovable.dev/ai-gateway install waits for the 24h bunfig guard (~13h); user chose to wait
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
- [ ] Old leads revival drafts for approval

## G. Real data
- [x] Market Data page: CSV import of DLD transactions (date, area, building, type, size, price), source + import date shown
- [x] UAE Knowledge page: editable facts with source + last verified; >6 months shows "please re-verify"; pre-filled with spec facts marked "verify before going live"

## H. Dashboard and proof
- [x] Dashboard (owner home): today's Hot leads, viewings, pending follow-ups, AML alerts — [ ] missing documents + avg AI first-reply time pending
- [ ] Manager stats: leads by source, scores by source, viewings, offers, valuations, response time, per week/month
- [ ] Real conversion rates + "Use my real rates" button on Calculator
