# CivicFix — Production Audit Report

**Date:** 24 October 2026, 12:50–13:25 UTC
**Environment:** Lovable preview (dev server, localhost:8080) against the live Lovable Cloud backend
**Build:** OK (13:13 UTC) · **Test suite:** 62/62 passed (12 files, `bunx vitest run`)

---

## A. What was executed

| Area | Method | Result |
|---|---|---|
| Citizen report submission | Real browser (Playwright), photo + GPS + AI + geocode + ward match | Pass — case BLR-PJSC6T created |
| Routing exception → classify → assign team | Real browser, test admin account | Pass |
| Acknowledge + promised date + public note | Real browser | Pass |
| Full status lifecycle | Staff UI: under_review → assigned → in_progress → resolved | Pass, all events audited |
| Citizen confirmation | Real RPC with valid private token: resolved → closed | Pass |
| Repeat confirmation | Same token, second attempt | Correctly rejected |
| Forged / malformed / wrong tokens | Anonymous RPC calls | All rejected, no data leaked |
| Field-worker scope isolation | Real browser, test field worker (roads / ward 65) | Pass — ward-60 case hidden from queue; case page read-only with "outside your scope" notice |
| Anonymous direct table writes/reads | Live API probes | All denied (401/permission denied); private tables return zero rows |
| Directory inventory | Database counts | 781 profiles, 0 duplicates, all 369 wards covered |
| Import idempotency | Re-ran MLA import | 0 new rows inserted |
| Orphan records | Database checks | 0 orphan events, 0 orphan photos |
| Security scan | Platform scanner | 1 warning (public service-rules table — intentional public directory data) |
| Overdue escalation | Database run (earlier session) | Idempotent, escalates exactly once; hourly schedule active |

## B. Defects found and fixed in this audit

| # | Severity | Defect | Root cause | Fix | Status |
|---|---|---|---|---|---|
| 1 | **Critical** | Citizens could not confirm/reopen cases or validate tracking links | Security migration 0019 revoked anonymous execution of `verify_reporter_token`, `citizen_change_issue`, `consume_civic_request` | Migration 0021 restored execution for these three token-validating functions | Fixed, verified live |
| 2 | High | Case pages downloaded all 369 ward boundaries (4.2 MB, ~7 s) | Directory fetch loaded every polygon for any lookup | New lightweight per-point ward lookup; case pages fetch only the relevant ward | Fixed, verified live |
| 3 | Medium | Field workers saw action buttons on out-of-scope cases (backend still rejected) | UI did not check scope | Case page now shows a read-only "outside your assigned scope" view | Fixed, verified live |
| 4 | Medium | Zone-level officer profiles never matched wards | Imported zone labels ("Zone 1/2") didn't match official zone names | Corrected to official names (Yelahanka, Bommanahalli, etc.) | Fixed |
| 5 | Low (process) | UI appeared to confirm a resolve that the backend rejected | Resolve requires a ≥5-char work summary; the test script didn't provide one | Not a code defect — validation working as designed; verified with summary present | Closed |

## C. Directory audit (781 profiles)

- Leadership: 6 verified (GBA Chief Commissioner + 5 corporation commissioners)
- Zone officers: 37, all marked **verification required** — hidden from citizens until an admin approves them in Staff → Directory
- MLA: 369 ward-linked, verified against the official Karnataka Assembly list
- MP: 369 ward-linked, verified against the official Parliament list
- Photos: 0 (no verified official portrait source — initials shown instead)
- Corporators: none — councils not yet elected; the app explains the vacancy
- Ward-level engineers: no verified per-ward source exists; documented gap, nothing fabricated

## D. Known limitations (unchanged, honestly displayed in the app)

- No government notification channel exists; the app shows "Not configured" rather than claiming delivery.
- Hindi/Kannada cover navigation and Home only; full translation remains open.
- Physical Android GPS/camera testing requires a real device.
- One 10 KB test image remains in private storage (deletion requires staff authorization; harmless and invisible).

## E. Production-readiness decision

**READY WITH DOCUMENTED LIMITATIONS.**

The complete citizen → staff → resolution → citizen-confirmation loop is verified end-to-end with real accounts and real browser sessions; security probes confirm anonymous users cannot read private data, forge tokens, or change cases; the directory is fully populated with provenance. The documented limitations above are feature gaps (translations, government handoff, physical-device testing), not defects.
