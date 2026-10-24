<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## CivicFix architecture
- Citizens use `_citizen`; protected administration uses `_authenticated/admin*`, operations `_authenticated/staff*`. BackButton dismisses overlays and handles same-page/redirect fallback. Read nested AGENTS.md before changes there.
- Citizen submit/confirm/dispute use public `issues.functions.ts` server functions with privileged writes; anonymous users never write tables. Safe case/event projections, hashed reporter capabilities and persistent request limits protect public access.
- `issue_secrets` holds recovery tokens with no client grants. Service-only `create_civic_report` atomically persists report, secret and creation event; retries never return existing credentials.
- Photos remain private. Submission stores a long-lived signed URL; validated, hashed originals persist atomically in `issue_photos`, separate from display/annotated copies and corrected coordinates.
- `staff_change_issue` enforces expected-status concurrency, transitions and atomic events; clients cannot directly update issue fields. Duplicate review, assignment, classification and reporter decisions also use atomic audited database operations.
- Citizen duplicate suggestions remain candidates; only staff review controls canonical linking, preserving uncertain originals.
- Inspection/completion evidence uses separate private `issue_evidence`, authorized atomic event writes and short-lived public-safe signed projections; a trigger requires completion evidence before resolution.
- Acknowledgements persist message, inspection time and ETA with an event; tracking reads `public_case_rows`. Notifications record actual outcomes, never assumed external delivery.
- Staff roles: field_worker, supervisor (legacy staff counts as supervisor), admin. Database predicates enforce active department/category/team/ward/corporation scope on every case read/action, including acknowledgement, ETA and status.
- PortalShell verifies active server-authorized access before mounting children; operational staff cannot enter administration. Super Admin uses protected `admin_permissions`, provisioned only for the registered one-time owner email; admin creation requires explicit delegation. Signup never grants roles.
- Account invitations and role/profile/audit setup are atomic. Suspension persists before provider-ban synchronization, blocking existing-session actions. Atomic scope edits and eligible handler assignment are guarded; suspension releases handlers with case-history events.
- Staff metrics use full-dataset database aggregates, not capped triage lists. Transparency aggregates canonical cases by submission ward, never personal elected-member scores.
- Home retains photo-led actions/recent real reports; CitizenMap owns geographic browsing. Case-local authority information reads the protected directory; no standalone citizen authority directory.
- Leaflet loads client-side through LazyMap; use tile.openstreetmap.org (Carto needs a key). Citizen bounds derive from live ward polygons; optional map props leave report/staff maps unrestricted for honest out-of-coverage handling.
- LocationProvider stores citizen preferences locally without continuous background tracking. Civic Map/report camera watch live position only while open: blue dot, accuracy circle, own-ward highlight/card. Fixes over 100 m remain approximate, never auto-confirmed; automatic attempts never open dialogs.
- Map focus and boundary clicks retain actual GPS/manual coordinates, never ward samples or clamped outside-city points. Reliable camera-session GPS suggests an editable report point; gallery EXIF/manual pins require confirmation, and gallery images never inherit current device GPS.
- Nearby totals aggregate all canonical cases; map/list share the distance radius. Ward jurisdiction remains independent of the neighbourhood circle.
- Nominatim reverse lookup is on-demand only; Photon provides India-wide debounced address suggestions with bounded timeout and country filtering. Prefer hosted providers for production scale; never autocomplete against public Nominatim.
- Protected civic_* tables hold coverage, authorities, category routes and boundaries. Availability rectangles do not prove jurisdiction; ownership needs asset rules. Source publication date, check time and SHA256 remain separate; provenance never verifies ownership/contacts.
- Admin-editable civic_wards/civic_department_routes and representative rows have trigger-written civic_directory_audit. public/data/bengaluru-wards.json is import source only; cases retain submission ward in routing_snapshot.
- MLA/MP mapping uses Election Commission results and each ward's official assembly constituency number. Corporators remain not in office until council elections. AuthorityPortrait requires independent verified photos and credits, HTTPS/managed media or initials; profiles are ward-scoped and audited.
- Ward/routing fixtures stay in tests, never citizen controls.
- Manifest/icons support installation without a service worker; BrandOpening has a bounded per-load timer and never caches private pages.
- Visit-only assistant streams validated text history/public aggregates without private access or writes; access pauses persist separately from classification.

- Recipient notifications reuse issue_notifications with guarded ownership/current-scope RPCs, event keys and 15-second recovery-safe polling; notification_reads stores read/archive state. Public/internal messages are separate event visibility, and reminder timing is explicitly admin-configured.
- Unresolved report ownership is null, not a routing department; the legacy review label is treated as unknown so unique category/ward team routing remains possible without inventing ownership.
- Shared incidentCoverage validates enabled coverage and unique ward polygons for location UI and submission; unresolved text stays a separate session draft and validated address provenance persists in routing_snapshot.
