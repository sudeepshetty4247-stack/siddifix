# CivicFix: integrated operational workflow

## Audit checklist

| Requirement | Current evidence | Status |
|---|---|---|
| Citizen submission | Photo upload, AI/manual fallback, location and atomic report/creation-event persistence exist; previously tested submit/read-back | Implemented; rerun regression checks |
| Duplicate review | Nearby same-category candidates and citizen linking exist; no staff confirm/reject/merge/reverse workflow | Incomplete |
| Responsible-team assignment | Department text and routing snapshots exist; no assignment lifecycle/history | Incomplete |
| Citizen tracking | Public reference/timeline and private reporter-action token exist; citizen confirm/reopen writes are not atomic | Incomplete |
| Staff queues | Open/overdue/all filters exist; dedicated operational queues missing | Incomplete |
| Analytics | Client calculations capped at 1,000 rows; report/canonical distinction and required metrics missing | Incomplete |
| Resolution evidence | Resolution note exists; separate evidence upload missing | Missing |
| Notifications | Live page updates exist; outbound delivery absent | Missing |
| Reliability | Submission retry protection and backend staff status checks exist; error/retry states and workflow tests are partial | Incomplete |

Current database: zero reports, zero accounts, zero imported ward boundaries. Six existing routing/directory tests pass. A first test run after removing the Authorities page encountered stale generated navigation; after automatic refresh all six passed. No current deep security scan is available: run one from the Security tab before release. Existing dependency scan is outdated and does not establish production readiness.

## Immediate correction
- Remove the separate citizen Authorities page, home directory and its navigation links. Completed.
- Retain verified civic data for use inside cases, not as a substitute for case handling.
- Keep all case totals based on actual CivicFix submissions; no invented cases, ward officers or copied reference counts.

## Priority implementation
1. **Duplicate review:** persist candidate evidence and staff decisions; compare proximity/category/text and available image evidence; explicit merge and reversal preserve original reports, photos, timestamps and history. Uncertain matches remain separate.
2. **Assignment lifecycle:** verified authority/staff-team assignment, reassignment, accept/reject with reason, ownership pending and internal escalation, each with durable history.
3. **Integrated case experience:** map selection opens the case details in-place with evidence, age, timeline, verified responsibility chain and internal actions. No external complaint portal is presented as a completed CivicFix workflow. Source citations remain available as provenance. Missing ward/officer data stays clearly unverified.
4. **Operational staff queues and resolution:** unassigned, duplicate review, assigned, rejected assignments, overdue, escalated and resolved; require evidence when resolving; atomic citizen confirm/reopen and staff field edits.
5. **Complete analytics:** aggregate persisted records without the 1,000-row cutoff; total citizen reports versus canonical issues, duplicate rate, status distribution, pending, resolution rate, overdue, average resolution time and reopened count. Empty datasets return accurate zeros/nulls.
6. **Notifications and release checks:** persistent in-app notifications, delivery outcomes, complete loading/error/retry states, and full workflow tests. External email/SMS/push delivery requires its own configured service and cannot be claimed from page updates.

## Technical implementation and verification
- Preserve TanStack Start, existing Cloud/storage and the two interfaces. Extend the existing data model additively; backend-authorized atomic operations enforce decisions and write audit events together.
- Add focused rule tests alongside existing tests, plus database-backed checks for merges/reversal, concurrent assignment/status changes, unauthorized actions, analytics and AI-failure submission.
- Verify a signed-in staff workflow and anonymous citizen read-back before marking each stage complete; remove temporary validation records afterward.
- Staff verification currently waits on an account: the owner must establish the intended administrator account; never silently create or select an administrator.
- Government delivery is not configured. Internal assignment/escalation is operational within CivicFix, not government acceptance or action. Current official ward boundaries and ward-specific officer sources are still needed for precise local responsibility.

This is a staged completion of the existing project, not a rewrite or a declaration that it is already production-ready.