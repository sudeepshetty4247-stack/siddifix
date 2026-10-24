# CivicFix roadmap

## Current priority — simplify and complete the real product
- [ ] Automatic confirmed-coordinate address lookup, source-backed 369-ward import and conservative department resolution; verify real coordinates and permission/coverage edge cases.
- [x] Audit existing citizen reporting, map, staff workflows, directory and tests against the latest uploaded brief.
- [x] Map-first opening screen, explicit report-location confirmation, manual pin correction and AI network-failure fallback; anonymous submit/photo/history/map read-back verified, temporary reports removed (zero reports).
- [ ] Duplicate review, assignment, status, completion evidence requirement, public tracking and full-dataset analytics implemented; signed-in transaction/evidence/reporter-resolution verification blocked by zero staff accounts.
- [ ] Restricted directory setup/import verification blocked by zero admin accounts; zero loaded wards, missing-ward and out-of-city notices verified.
- [ ] Finish end-to-end staff resolution and reporter decisions after administrator signup; browser GPS-denial feedback remains unverified (test timed out). 28 unit tests passed and latest preview validation passed.

## Done (phase 1)
- [x] Citizen site: home, 4-step report with AI photo analysis, duplicate linking, confirmation + private link
- [x] Civic map, explore, issue page with live timeline, My Tracking, reporter confirm/dispute
- [x] Staff workspace: sign-in (email + Google), overview, queue, issue actions with audit trail, map & hotspots, team roles
- [x] English / Hindi / Kannada switcher (navigation + home)

## Overhaul delivered
- [x] Persistent location with manual pin/coordinates, first-visit fallback, action-first home and nearby report reads
- [x] Five source-backed Bengaluru service authorities, candidate mappings, partial coverage configuration, public provenance cards
- [x] Protected ward-boundary validation/import page; no fabricated ward/representative records imported
- [x] Atomic report + private access + event persistence, duplicate eligibility validation, retry credential protection
- [x] Backend staff status transitions and atomic audit events; direct status updates revoked
- [x] Manifest-only home-screen support (PWA skill); desktop/phone layout and anonymous submit/read-back verified; 6 tests pass

## Remaining release work
- [x] Audit mandatory workflows completed; confirmed gaps recorded in approved plan
- [x] Standalone authority module removed; official portal CTAs removed; map has in-place case information/history
- [ ] New staff duplicate merge/reject/reverse, internal assignment/reassignment/accept/reject/escalation, atomic classification/reporter actions and full-dataset analytics implemented; signed-in operation verification BLOCKED on intended administrator account (zero accounts)
- [ ] Remaining approved stages: signed-in resolution evidence verification, notification persistence/delivery and end-to-end release checks; candidate queue/history refinements implemented
- [x] Current request: public Bengaluru authority directory, searchable service contacts, GBA chief commissioner and 1533 official contact, responsibility chain; CivicFix-only case totals retained; search/filter and phone layout verified
- [ ] Address lookup integration: blocked on a suitable anonymous-citizen geocoding service configuration
- [ ] Current official ward boundaries and representative sources: not obtained; no legal jurisdiction claim until verified/imported
- [ ] Staff action end-to-end verification: no auth users exist; requesting administrator must create their own account before testing
- [ ] Evidence original retention and separate annotated derivative, capture/submission timestamp distinction
- [ ] Security release review: bootstrap-admin provisioning, private credential hashing, abuse controls, public-safe projection
- [ ] Transactional citizen reopen/confirm and audited staff field edits implemented; signed-in end-to-end verification blocked by zero staff accounts
- [ ] Complete release testing and publish readiness; this milestone is not a completed production certification
- [ ] Full Hindi/Kannada translation of every screen
- [ ] Ask CivicFix assistant (grounded in real records)
- [ ] Community threads
- [ ] Escalations page + automatic overdue escalation
- [ ] Resolution evidence photos and backend resolution prerequisite implemented; signed-in upload/resolution verification blocked by zero staff accounts
- [ ] Area notifications (browser push)
- [ ] Analytics + civic memory and audit log page
