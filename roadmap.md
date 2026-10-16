# Roadmap — full app build (uploaded spec)

Keep calculator, Lead Finder, My Listings, AI Reply Rules working as-is. Owner-only unless stated.

## A. Foundations
- [ ] Make listing-photos bucket public (workspace now allows it) and verify WhatsApp photo links open without login
- [ ] Settings page: agent name, agency name, RERA/BRN, working days/hours, viewing length, UAE holidays (pre-filled, editable), compliance officer email, document retention (default 5 years), mortgage partner name
- [ ] Navigation: Dashboard · Test Chat · Leads · Viewings · Follow-ups · My Listings · Owners · Market Data · UAE Knowledge · AI Reply Rules · Settings · Calculator · Lead Finder
- [ ] Document Vault: private bucket, one folder per client, 10-min signed links, upload/view/delete audit log, retention setting, "delete on request" blocked for legally required records
- [ ] Footer on owner pages: "Powered by Elite Visions"

## B. AI reply brain
- [ ] Test Chat (WhatsApp-style, play buyer/seller/tenant, follows Reply Rules + UAE Knowledge + eligible listings, sends photos/video/map links, New conversation)
- [ ] Voice note transcription + image/screenshot understanding
- [ ] Reply in client's language; owner-facing summaries in English with original underneath
- [ ] Time zone from phone country code, editable per lead; no non-urgent messages 9pm–8am client time
- [ ] Conversation types: buyer / seller-landlord (book valuation) / tenant
- [ ] Mortgage: offer adviser connection (partner name in Settings); never give mortgage advice
- [ ] Confidence rule: unsure/legal/financial/contract → agent will confirm + flag lead
- [ ] Take over / Hand back to AI per conversation
- [ ] STOP/consent handling + consent log per contact
- [ ] Audit log of every AI message per lead

## C. Leads and alerts
- [ ] Leads page: type, full chat, learned facts, Hot/Warm/Cold score, source; "Save to HubSpot" button
- [ ] Hot alert: red banner + email to owner
- [ ] AML red-flag alert to compliance officer email (cash ≥ AED 55,000, crypto, third-party payments, ID refusal, rushed deals); never shown to client

## D. Viewings and follow-ups
- [ ] Viewings page: book free slots (Settings hours, holidays, existing bookings), Mark as done / No-show, day-before 6pm reminder with map link
- [ ] Post-viewing follow-up: next morning 10am message; 2-day no-reply draft waits on Follow-ups page (Approve/Edit/Cancel)
- [ ] Until WhatsApp connected, "sent" = appears in lead's Test Chat marked Sent

## E. Documents (UAE)
- [ ] Per-lead checklist by role (buyer individual/company, seller, landlord, tenant, POA), private upload link into Vault, received/missing, notify owner when complete

## F. After the deal
- [ ] Off-plan payment schedule + milestones; reminders 7 days before; milestone updates → Follow-ups approval
- [ ] Owners page: agreed-to-updates flag, handover date, owner/investor, frequency (3 months default / monthly)
- [ ] Value updates from real Market Data only, with source+date, → Follow-ups approval
- [ ] Home anniversary reminder 7 days before; rental owners: 120-day lease-end reminder
- [ ] Old leads revival drafts for approval

## G. Real data
- [ ] Market Data page: CSV import of DLD transactions (date, area, building, type, size, price), source + import date shown
- [ ] UAE Knowledge page: editable facts with source + last verified; >6 months shows "please re-verify"; pre-filled with spec facts marked "verify before going live"

## H. Dashboard and proof
- [ ] Dashboard (owner home): today's Hot leads, viewings, pending follow-ups, missing documents, AML alerts, avg AI first-reply time
- [ ] Manager stats: leads by source, scores by source, viewings, offers, valuations, response time, per week/month
- [ ] Real conversion rates + "Use my real rates" button on Calculator
