# CivicFix roadmap

## Current priority — simplify and complete the real product
- [x] Restored the previous map-free Vidhana Soudha Home and its existing photo; latest direct preference overrides map-first brief.
- [ ] Latest complete correction brief: audit existing behavior, simplify camera/gallery/location/submit, retain originals plus annotated copies, restore map-first Home, improve operational profiles and close staff/security gaps before acceptance verification.
- [x] Home and Civic Map show full-dataset nearby canonical active/resolved/overdue/critical totals within 2 km, refreshing every 15 seconds. Kudlu-area GPS/browser read verified with real zero counts, no demo inserts; 43 tests passed. Positive-data aggregate flow remains unverified while reports are empty.
- [x] Civic Map uses reliable GPS/manual coordinates and actual ward-click points, no interior sample substitution; browser checks passed for GPS, manual confirmation, Mysuru outside coverage, denied-permission callback and weak GPS. 41 tests passed.
- [ ] Officer/elected separation delivered; names/photos/contacts blocked by missing current official roster and constituency mapping. All 369 ward rows have zero MLA/MP/member names; reference numbers and portraits remain unverified, not copied into live data.
- [x] Removed citizen ward-test controls and unused screen; Home is now map-free with reporting, tracking and recent real reports. 37 regression tests passed; home/map and phone-width layout verified.
- [ ] Official GBA/MLA/MP/ward names and photographs: official Karnataka MP list located, but current official portraits, GBA roster and ward-to-constituency mappings remain unverified; no guessed identities published.
- [x] Bengaluru-focused live ward map and citizen home with separate read-only ward/category test inputs. All five corporation lookups and Mysuru outside-coverage warning passed in the browser; 37 tests passed including interior pins for all 369 wards. No test reports inserted. Hosted address service, verified member contacts and administrator account remain blockers for full operational end-to-end checks.
- [x] Imported 369 December-2025 GBA ward polygons and zones atomically with publication/check dates and source hash; real Bengaluru UI lookup and shared-edge/manual-review rules verified (29 tests).
- [ ] Hosted OpenStreetMap/Nominatim reverse-geocoding integration implemented but blocked by missing hosted service URL; donated public endpoint deliberately not used. Department routes remain verification-required, not official assignments. GPS denial callback tested deterministically, real browser permission denial remains unverified.
- [x] Audit existing citizen reporting, map, staff workflows, directory and tests against the latest uploaded brief.
- [x] Map-first opening screen, explicit report-location confirmation, manual pin correction and AI network-failure fallback; anonymous submit/photo/history/map read-back verified, temporary reports removed (zero reports).
- [ ] Duplicate review, assignment, status, completion evidence requirement, public tracking and full-dataset analytics implemented; signed-in transaction/evidence/reporter-resolution verification blocked by zero staff accounts.
- [ ] Restricted directory editing verification blocked by zero admin accounts; 369 wards are loaded, missing-ward and out-of-city notices verified.
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
- [ ] Official December-2025 ward boundaries imported; current representative names and contacts still need verified sources.
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
