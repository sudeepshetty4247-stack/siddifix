# CivicFix roadmap

## Current request — supplied logo and Back fix
- [x] Applied supplied Siddi logo/slogan and complete-logo favicon/install icons; existing workflow copy remains unchanged.
- [x] Fixed Back for location overlay and same-page/redirect history; staff Back now above content. Browser verified overlay → sign-in and direct sign-in → Home; logo decoded, no page errors, 128 tests passed and preview validation clean.

## Current request — staff testing and Back navigation
- [x] Added shared Back controls to citizen, sign-in and staff interfaces; browser verified direct sign-in → Home fallback and Report → sign-in history return after location setup.
- [x] Signed-in administrator verified loaded Overview, Queue, Routing Exceptions, Overdue, Notifications, Team Management, Audit/Health and existing case read-back. 128 tests pass; complete testing guide delivered. No fake live complaint or repair inserted.
- [ ] Fresh write-through acceptance and field-worker negative flow: requires isolated test data or a genuine case and authorised actual work; physical-phone checks remain user-dependent.

## Authority portraits and photo QA — 24 October 2026
- [x] Diagnose directory photo fields and elected-card rendering; initially all 781 profiles lacked photo URL/source. Elected profiles were also wrongly filtered by constituency versus city zone.
- [x] Shared source-backed portrait display with fixed dimensions, loading state and initials fallback; scope case-page people reads to the relevant ward.
- [x] Integrate three licensed Commons portraits with independent verification, credits and licence links across 235 existing ward-linked profiles; other 546 profiles retain initials. No official-hosted portraits or guessed officer photos claimed.
- [x] Build 40 licensed local photo fixtures covering 20 subjects, with per-file provenance, hash and independent scenario coordinates; 128 tests passed. Real case portrait decoded at desktop and 390px; fixed case-page horizontal overflow. Evidence and limits: docs/AUTHORITY_PHOTO_QA_2026-10-24.md.
- [ ] Bulk persisted photo E2E tests — blocked until a separate test backend is available; preview and published app share the live database. Do not seed public sample complaints.

## Current priority — simplify and complete the real product
- [x] Operational teams model (master prompt §3): civic_teams table (name, department, categories, wards, supervisor, fallback, active, audit), automatic category+ward routing on every new report, routing-exception queue page for supervisors, admin team manager in Team Management; both routing paths verified in the database (assigned + exception), test rows removed.
- [x] Overdue & Escalated page (cases past promised ETA with overdue age + escalate-with-reason action, escalated list, 30 s refresh) and Notifications & Handoffs page (honest channel states: posted in app / external not configured / failed) added to staff nav. Build OK, 56 tests pass.
- [x] Team-scoped staff queue filtering and audit/system-health page (master prompt §5 nav) — next increment.
- [x] Backend-enforced team-scoped Issue Queue (staff_queue_issues DB function: field workers restricted to their category/ward scope, supervisors/admins full; all filters — category, ward, status, severity, team, acknowledgement, overdue, search — applied in the database; loading/empty/error/retry states). Signed-in click-through still blocked on admin account.
- [x] Admin Audit Log & System Health page (/staff/audit, admin-only): merged read-only audit events (case, assignment, duplicates, notifications, directory/teams) + honest live health checks (database, AI state, geocoding config, notification failures, unverified routes, team/fallback coverage).
- [x] Automatic overdue escalation: escalate_overdue_issues DB function (idempotent — verified in the real database: first run escalated, second run did nothing, exactly one event + one supervisor in-app notification) + authenticated cron route /api/public/jobs/escalate-overdue (returns 401 without the managed credential) + hourly managed schedule (escalate-overdue-hourly, minute 7). Test case removed afterwards.
- [ ] Browser push notifications — deferred: needs a push provider (VAPID keys) and subscription storage; documented as a later enhancement rather than faked.
- [ ] Ask CivicFix assistant and community threads — deferred per the brief's reliability clause (community needs moderation/spam controls; assistant must never see private case data).
- [ ] Full Hindi/Kannada localisation of every screen — not done; only navigation + home are translated today. Not claimed as complete.
- [x] Security hardening audit (final brief): revoked direct staff UPDATE/DELETE on cases (all writes now only through guarded functions with concurrency/evidence/scope checks), removed browser history inserts (new team-scoped staff_add_note function), locked photo records to read-only for staff, revoked anonymous access to all admin/staff/trigger database functions (only the 5 intended public citizen reads remain), tightened tracking-token and case-reference validation into a shared tested module. Live attack checks as an anonymous visitor all rejected; 62 tests pass, build OK. Confirmed already-correct: hashed tracking tokens, private photo bucket with no public policies, idempotent submission, guarded status transitions, no self role-granting (RLS), public signup grants nothing.
- [x] Signed-in staff end-to-end run still blocked: no staff/admin account exists yet.
- [x] Live end-to-end run with test accounts (civicfix.test.admin@ / civicfix.test.field@example.com): citizen submitted BLR-PJSC6T via real browser flow (photo, GPS, AI, reverse geocode, ward south-60 Bilekahalli) → routing exception (needs classification) → admin reclassified to roads → under review → assigned to Test Roads Team with reason → acknowledged with ETA → public note posted → audit page shows all events + health checks. Field worker scoped to roads/north-65 correctly does NOT see the south-60 case in queue and gets a read-only out-of-scope case view (UI gate added over the already-enforced backend). Fixed a real regression found during testing: role-helper functions must stay executable for anonymous policy evaluation (migration 0020). 62 tests pass, build OK.
- [ ] Remaining blocked: physical phone GPS/camera test (user), government notification channel (no authorised integration), verified ward officer roster (no official source), full Hindi/Kannada translation of every screen (only nav + home today).
- [x] NammaKasa-style simplicity rebuild (Home kept as Vidhana Soudha photo page): full-screen map-first Civic Map with floating Active/Reports pill, severity/status/category filters, Map/List toggle, per-ward red count bubbles, ward bottom sheet with Know-your-ward, bottom Report-a-Problem bar; camera-first report entry with LOCATION LOCKED ward overlay; issue page severity·status header with age line; Explore gained resolution-bar ward leaderboard. 48 tests passed, build OK, browser-checked.
- [x] Address search (e.g. Kudlu Gate) and place names work; every ward shows assembly/Lok Sabha constituency, MLA (2023) and MP (2024) from Election Commission results; corporator shown as not in office. Officer names/photos still need a current official roster.
- [x] Restored the previous map-free Vidhana Soudha Home and its existing photo; latest direct preference overrides map-first brief.
- [x] Short photo/location/submit flow, private original preservation, separate annotated copy and operational-first verified-profile presentation implemented; anonymous gallery submit and public case read-back verified, 48 regression tests passed. Latest direct request keeps Vidhana Soudha Home map-free.
- [ ] Full acceptance remains blocked on an explicitly provisioned intended administrator, hosted address service and current verified officer/elected records; physical camera and signed-in staff flows remain unverified.
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
- [x] Original retention and separate annotated derivative verified through anonymous submit/read-back; capture metadata remains distinct from report location. Temporary report removed; existing case preserved.
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
- [x] Live location on Civic Map and report camera (blue dot, own ward, active counts)
- [x] Staff acknowledgement + promised date shown on citizen tracking page; new stages (Acknowledged, Inspection scheduled, Awaiting verification); field/supervisor/admin roles with category/ward scope; honest notification log.
- [ ] Signed-in staff end-to-end run — blocked: no staff/admin account exists yet.
- [ ] External authority notification (email/grievance API) — blocked: no authorized channel or credentials.
- [x] Real Bengaluru authority directory populated (24 Oct 2026): 6 verified leadership (GBA Chief Commissioner + 5 corporation commissioners), 37 zone-level operational officers pending admin verification (independent directory source, 31-07-2026), 369 ward-linked MLA + 369 ward-linked MP profiles verified against official KLA/Sansad lists. Case pages now load ward info via a lightweight point lookup instead of the 4 MB full-boundary download. Zone names on officer profiles corrected to official zone names. Ward-level engineers and corporators remain absent: no verified per-ward officer source exists and councils are not elected yet — documented, not fabricated.
- [x] Master production audit (24 Oct 2026, docs/PRODUCTION_AUDIT_2026-10-24.md): fixed critical citizen-tracking regression (migration 0021), 4.2 MB case-page download, field-worker scope UI, zone naming. Full lifecycle verified live: submit → route → assign → acknowledge → resolve → citizen confirm → closed. Decision: READY WITH DOCUMENTED LIMITATIONS.
