# Siddhi separate portals — acceptance report

## Delivered
- Citizen reporting and private tracking remain public, without staff accounts.
- Admin sign-in: `/admin-login`; control centre: `/admin`.
- Government staff sign-in: `/staff-login`; operations: `/staff`.
- Citizen footer now links to the two distinct sign-in pages.
- Portal children mount only after server-authorized active-account checks. Operational staff cannot enter administration; administrators use their own operations pages instead of entering the staff portal.
- One-time owner invitation was requested for the registered owner, and the protected Super Admin designation was verified in persisted records. Existing test administrators were not promoted to owner.
- Additional administrator invitations require explicit administrator-management permission. Only Super Admin can grant that delegation. Public signup never grants roles.
- Staff invitations require configured departments and authorized categories; team and jurisdiction validation occurs in privileged provisioning as well as subsequent atomic scope edits.
- Account suspension persists before provider-ban synchronization, immediately denying database operations for existing sessions. Open handler assignments are released with case-history events. A provider synchronization failure is returned rather than presented as a successful ban.
- Case handlers must be active and eligible for the actual department/category/team/jurisdiction; assignments are audited.
- Database scope predicates protect operational case reads, actions, evidence and metrics. Citizen-safe projections remain intentionally public.
- Dashboard and queue refresh at 15-second intervals. Queues are paginated with server-side filters and exact row counts. Notification read state is stored per account.
- CSV and print/PDF outputs use authorized persisted metrics; external delivery is never assumed.

## Verified in this change
- Full automated regression suite: 170 tests passed across 21 files.
- Preview validation after final changes: build OK.
- Signed-in staff workload and empty scoped queue rendered without page errors.
- Staff access to `/admin` was denied; administrator links absent from the staff navigation.
- Direct staff requests to grant roles, delegate administrator management, bootstrap ownership, suspend another account and write an unauthorized case note were rejected.
- Scope predicate returned true for a matching department/category/team/ward/corporation and false for each mismatch and empty categories.
- Scoped case count and scoped dashboard total both returned zero for the tested staff account.
- Dashboard Assigned-to-me opened the corresponding queue; notification empty state loaded; sign-out returned to staff sign-in.
- Dedicated admin sign-in rendered separately. Admin dashboard and account-management pages were inspected earlier in this change.
- No synthetic reports, teams, repairs or government-delivery records were added.

## Remaining real-world acceptance
- There are no active operational teams configured. The owner must configure real authorized departments, categories, teams and ward/corporation scope before inviting operational personnel. These details cannot be guessed.
- Invitation request success does not prove inbox delivery or link consumption. The owner must consume the email, set a private password and sign in at `/admin-login`.
- New operational invitation consumption, supervisor-to-field-worker handler assignment, evidence upload, resolution, citizen confirmation/dispute, notification read persistence across sessions and account suspension/reactivation require a genuine authorized scenario or an isolated test environment.
- This preview shares persisted data with the published app; positive write-through tests were not fabricated in production.
- Physical-phone GPS/camera checks, government handoff, external notification channels and unverified officer information remain outside this portal upgrade's verified acceptance.
- This change was not published automatically.

## Owner-led workflow
1. Open the secure owner invitation, set your password, then use Admin sign-in.
2. Configure verified operational teams in Staff management, with department, categories and jurisdictions; review directory routes and service targets.
3. Invite a supervisor and field worker using their real work email addresses and the authorized scope. They set their own passwords through invitation links.
4. Citizens submit genuine in-coverage reports and retain their private tracking links. Automatic routing either chooses a configured eligible team or records a routing exception for administration.
5. A scoped supervisor assigns an eligible case handler; staff acknowledge, record inspection/ETA, add public updates and completion evidence, then resolve.
6. The citizen verifies the fix or disputes it through private tracking; persisted events and in-app notifications show what actually occurred.
7. Check scoped totals/exports and audit history. Suspend an authorized test account only with permission; verify its existing session loses case access and open assignments remain visible for reassignment.