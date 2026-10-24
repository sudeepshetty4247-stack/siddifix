# Siddi staff workflow and notification acceptance

## Delivered
- Recipient-owned persisted notification centre and header bell, read/unread/archive/restore and bulk mark-read, accurate badge totals, search/type/priority/state filters and paginated results.
- Event-key deduplication; current recipient, active-account and case-scope checks on every read/action. Revoked scope hides linked notifications. Account notifications remain accessible during team setup.
- Fifteen-second polling, reconnect refresh, explicit failures and retries. This is polling, not guaranteed instantaneous push or offline synchronization.
- Public case updates, internal notes and supervisor instructions separated by visibility; audited response-template configuration.
- Evidence upload object validation and atomic retry keys. Completion evidence must reference a stored object; uploading evidence alone never resolves a case. Only the original reporter capability confirms closure.
- Atomic report target snapshot and routing before creation event delivery; ambiguous/missing mappings become routing exceptions rather than guessed teams.
- Configurable approaching-deadline reminders and overdue escalation, queue sorting and per-user in-memory filter restoration, dashboard scope context, explicit case/history failures.

## Checked
- All 189 automated tests in 24 files passed.
- Isolated in-memory PostgreSQL executes migration-defined notification and workflow functions. Covers recipient isolation, duplicate prevention, read timestamp idempotency, unread/archive/restore/bulk actions, revoked scope and suspended sessions, acknowledgements, public/private projections, expected-status concurrency, stored completion prerequisite and citizen reopen/confirmation.
- These tests use stubbed identity/scope and storage-object fixtures, not the hosted auth/storage providers. They are transaction tests, not a complete hosted browser lifecycle.
- Signed-in staff browser: team-configuration blocker, zero unread bell, direct notification ownership rejection, bulk zero-state action, no private notifications visible, Admin portal denied. No write to complaints/evidence.
- Signed-in administrator browser: notification filters, response settings, reminder controls, actual report queue read and opening case, queue filter/sort restoration on Back. No case status changes.
- Desktop and 390px mobile notification layouts checked; no horizontal overflow or browser page errors.
- Managed hourly schedule exists and is active at minute 7, targeting `/api/public/jobs/escalate-overdue`. New reminder execution through the hosted schedule has not been observed.
- Latest automatic preview validation reported `build OK`.

## Operational blockers and limits
1. No active operational teams exist. Owner must configure genuine department/category/team/jurisdiction assignments before staff work can proceed. Existing eleven indicative category routes remain verification-required; they are not government acceptance or authorization.
2. Preview and publication share data. Full hosted invitation/suspension/assignment/evidence/confirmation positive browser acceptance requires an isolated hosted test backend or authorized real work; no synthetic production reports were created.
3. Reminder lead hours default to zero (disabled) until explicitly configured by administrators.
4. External government delivery, SMS, email dispatch and browser push are not configured or claimed. In-app persisted notices do not imply government receipt.
5. Physical Android/iOS camera/GPS, upload interruptions, long offline recovery, concurrent devices and production load remain unverified. Never describe this as zero-known-defect certification.

## Operator acceptance sequence
Configure verified teams and staff scope in Admin; set targets/reminders and approved responses. On an isolated hosted environment, submit a report with photo and confirmed location; verify routing, recipient badge and case read-back. Acknowledge with public message and ETA; test private note remains private; progress to work underway; attach inspection/completion evidence; request verification and resolve; use the original tracking capability to reopen, then confirm after a subsequent resolution. Verify each persisted event and recipient notification. Repeat with an out-of-scope and suspended account, interrupted upload, offline reconnect and duplicate retry. Check scheduler-created notices after a due date passes. Do not run this as synthetic work in the shared production data.