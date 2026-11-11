# Multilingual replies, Monday reports, and post-viewing follow-up

## What changes
- Keep existing page layouts and working WhatsApp behaviour intact.
- Complete Arabic, English, Hindi (including Latin Hinglish), and Russian replies across chat, appointment messages, time labels, and STOP confirmations. Remember the client's language and script; show English translations above originals to agents.
- Add small Test Chat language controls and four sample buyer messages.
- Add **Monday report** at `/owner/weekly-report`, restricted to owners and HQ, with a week picker, agency and agent numbers, GCI progress, saved past-week reports, copy and print controls. Add a compact current-week summary to Owner home.
- Extend the existing hourly database task to save Monday reports and create one approval-required follow-up after 48 hours without a client reply following the next-morning viewing follow-up.

## Measurement assumptions
- Count only recorded events; missing activity is zero, not an estimate. Clearly identify metrics whose historical timestamps are unavailable.
- GCI goals use saved agency/agent goals. If an agency goal is not currently stored in Settings, add an editable agency annual goal without changing existing goals.
- First reply means the first recorded AI response after the client's first message; agent takeover means an agent-written reply during the chosen week.
- Listings freshness is measured at report generation, and frozen in saved snapshots.
- The explicitly requested AED 40,000 fallback is labelled as an assumption when no deals have closed that year.
- Post-viewing drafts never bypass consent, STOP, approval, WhatsApp template requirements, or quiet hours. No launch, renewal, referral, or revival automation is added.

## Technical details
- Add browser-safe translation and reporting helpers with focused unit tests.
- Apply additive migrations for lead language, English translations if required, weekly report snapshots, agency goal if required, and per-viewing follow-up identity/timestamps.
- Preserve server-side agency checks and RLS; reports are owner/HQ-only and always agency-scoped.
- Reuse the existing hourly SQL job, with idempotent report and follow-up creation. No extra polling or scheduled AI calls.
- Run the full existing test suite plus new language, report maths, access, and follow-up rule tests; verify authenticated report and chat screens.

## Delivery
Summarise changes, migrations applied, test results, and any unverified live delivery or unavailable historical data.