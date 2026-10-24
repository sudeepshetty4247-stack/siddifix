# Siddhi: final product audit (24 Oct 2026)

## Baseline before changes
- 17 test files, 136 tests passed.
- Preview build clean.
- Live database: 0 citizen reports (cleared earlier on request). Shared by preview and published app.

## Checklist
| Area | Status |
|---|---|
| Citizen reporting (photo, GPS/pin, optional text, idempotent submit, private tracking token) | Implemented and verified (tests + earlier browser runs) |
| AI classification with editable result and manual fallback | Implemented; no labelled accuracy set exists, so no accuracy is claimed |
| Ward/corporation matching from 369 official polygons | Implemented and verified |
| Team routing with visible routing exceptions | Implemented and verified in database |
| Duplicate handling: citizen-suggested candidates, staff merge/reject/reverse with audit | Implemented earlier |
| **Automatic multi-signal duplicate suggestions** | **Added in this round** |
| **"Related, keep separate" decision** | **Added in this round** (database operation, audited) |
| **Recurring-issue intelligence with explainable priority** | **Added in this round** |
| **Separate counts: reports vs unique issues vs linked duplicates** | **Added in this round** (staff insights page) |
| Status transitions, completion evidence trigger, citizen confirm/reopen | Implemented (database-enforced) |
| Overdue escalation (hourly scheduled job, idempotent) | Implemented and verified |
| Role enforcement (field worker / supervisor / admin) in the database | Implemented |
| Authority directory with provenance; licensed portraits (10/27 MLAs, 3/5 MPs) | Partial: see docs/Siddhi-Portrait-Report |
| Configurable SLA targets per category/severity | Not built; ETAs are set by staff, and no official SLAs are invented |
| Government notification / handoff | Blocked: needs an authorised municipal integration |
| SMS / push notifications | Blocked: needs a provider and credentials |
| Physical Android camera/GPS | Blocked: needs a real device |
| Isolated test backend for persisted end-to-end runs | Blocked: preview and live share one database |

## Duplicate detection rules (src/lib/case-intelligence.ts)
- A suggestion needs **all** of the following:
  - same category,
  - at most 60 m apart,
  - at most 21 days apart,
  - the earlier issue not repaired before the newer report.
- Score = 0.5 × proximity + 0.3 × time closeness + 0.2 × description word overlap. A suggestion appears at 0.55 or above.
- Proximity alone cannot trigger a match.
- Pairs staff have already decided are never suggested again.
- Nothing is merged automatically. Linking keeps every original report, photo and tracking reference.
- The thresholds are starting values checked against the fixture scenarios below. Tune them once real report volumes exist.

## Recurring-issue rules
- **Incident:** a canonical (unlinked, not rejected) case. Linked duplicate reports never count as incidents.
- **Cluster:** incidents of the same category within 50 m over the last 365 days.
- **Recurrence:** an incident that starts 3 or more days after an earlier incident in the cluster was resolved, or a reopened incident.
- A cluster of separate incidents that were all open at the same time is **not** recurrence.
- **Priority** = (incidents − 1) + 2 × returns + severity weight (1–4) + 3 if open now + 2 if it returned within 30 days of a repair.
- An uncertainty flag appears when an earlier incident has no recorded repair.

## Metric definitions
- **Citizen reports:** every submitted report.
- **Unique issues:** canonical reports, excluding rejected ones.
- **Linked duplicate reports:** reports linked to a canonical issue.
- **Active issues:** canonical issues not resolved, closed or rejected.
- **Resolved issues:** canonical issues resolved or closed. Each issue counts once.
- **Reopened:** canonical issues currently reopened.

## Tests after changes
- 18 new tests in src/test/case-intelligence.test.ts cover:
  - same place and time,
  - different descriptions,
  - 200 m apart,
  - different categories,
  - distant similar text,
  - a report made after resolution,
  - pairs staff already decided,
  - already-linked reports,
  - counting with linked reports,
  - 10 duplicates not counted as a recurrence,
  - return after repair,
  - reopened issues,
  - unrelated category nearby,
  - concurrent incidents,
  - report count versus recurrences,
  - link and unlink recalculation,
  - the uncertainty flag,
  - the exact priority formula.
- Full suite totals are recorded in the chat summary of this round.

## Demo plan
1. Create one clearly labelled test report (for example, title starting "DEMO").
2. Staff then acknowledge it, add a note, upload completion evidence and resolve it.
3. The citizen confirms through the private tracking link.
4. Delete the demo data afterwards.

If AI classification fails, choose the category manually. If the address lookup fails, the pin and ward still work.

## Production-readiness decision
The core report-to-resolution workflow, security model and the new duplicate and recurrence intelligence are ready for a pilot. The following still have to be supplied before running at city scale with real municipal teams:
- municipal partner authorisation and notification channels,
- configured SLA targets,
- a separate test environment,
- real-device testing.

## Update — final master prompt
- service_targets table + admin_upsert_service_target (admin-only, audited, version bump); issues.ack_due_at / target_snapshot / ack_escalated_at.
- escalate_overdue_issues: escalates past ETA or resolution target, and separately past acknowledgement target; SKIP LOCKED + per-case timestamps make reruns idempotent. Runs hourly on the existing managed schedule.
- submitIssue rejects points outside every active ward (shared boundaries allowed for staff review); ref codes are always BLR-.
- Demo mode: fixed Cubbon Park point, labelled banner, final submit simulated client-side — no rows written, public metrics unaffected.
- Tests: 154 → 158 passing (service-target calculation, overdue rule, coverage acceptance). Browser: Vijayawada GPS shows coverage screen → demo → banner, neighbourhood panel and launcher; no page errors.
- Not done: portrait review centre; staff demo with isolated data (no separate test backend).
