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
- Citizen pages live under the `_citizen` pathless layout; staff pages under `_authenticated/staff*` — two separate interfaces sharing one data model.
- Citizens never write tables directly: report submit/confirm/dispute go through public server functions in `src/lib/issues.functions.ts` using the admin client, because anonymous users have no DB write grants.
- Recovery tokens live in `issue_secrets` (no client grants) so public issue reads can never leak them.
- Photos bucket is private (workspace blocks public buckets); submit stores a long-lived signed URL.
- Staff status changes use the staff_change_issue database RPC with expected-status concurrency checks, backend transitions and an atomic issue_events entry; clients have no status-column UPDATE grant.
- First account to sign up becomes admin via trigger; admins grant staff from Team Management.
- Maps load Leaflet only client-side via `LazyMap`; tiles from tile.openstreetmap.org (Carto now requires a key).
- Directory coverage, authorities, category mappings and ward boundaries live in protected civic_* tables; directory availability rectangles are not jurisdiction proof, and ownership remains review-required without asset rules.
- Citizen location preferences are provided by LocationProvider across the citizen layout and stored locally, not continuously tracked.
- Anonymous submission persists the report, recovery secret and creation event through the service-only create_civic_report transaction; retries never return existing recovery credentials.
- Home-screen installability uses a manifest and icons only; no app-shell service worker is registered, preserving fresh previews.
- Case-local civic information reads the protected civic directory; the standalone citizen authority directory has been removed to keep reporting and case work integrated.
- Duplicate review, assignment lifecycle, classification and reporter resolution decisions use atomic database operations with durable events; ordinary staff clients cannot directly update issue fields.
- Staff analytics use full-dataset database aggregates, not the capped triage sample; Home reads recent real reports while CitizenMap owns map discovery, keeping the opening actions distinct from geographic browsing.
- Citizen-suggested duplicates are persisted as candidates, not merges; staff review exclusively controls canonical linking to preserve uncertain originals.
- Completion and inspection photos use separate issue_evidence records in private storage, staff-authorized atomic event writes, and short-lived public-safe signed projections; a database trigger requires completion evidence before resolution.
- Report locations require explicit confirmation after a suggested GPS/manual point; low-accuracy GPS is not suggested, and gallery photos never establish their capture location.
- Confirmed coordinates use hosted Nominatim only for optional address labels; no donated public geocoder fallback. Ward matching is independent, uses published boundaries, and overlapping/shared edges require manual review.
- Ward import sources retain publication date, source-check time and SHA256 separately; verified snapshot provenance does not establish current asset ownership or verify department contacts.
- Ward, department-route and representative records are admin-editable rows in civic_wards / civic_department_routes with trigger-written civic_directory_audit; public/data/bengaluru-wards.json is only the official import source. Cases keep the ward recorded at submission in routing_snapshot.
- Citizen map boundaries and browsing limits derive from live directory ward polygons; optional map props keep report/staff maps unrestricted for honest out-of-coverage handling.
- Civic Map focuses reliable GPS or manual coordinates without replacing them with ward interior samples; boundary clicks retain their actual coordinates and outside-city points are never clamped into a ward.
- Nearby citizen totals use a public security-invoker database aggregate over all canonical cases; map-list distance filtering shares its radius, while ward jurisdiction remains independent of the neighbourhood circle.
- Ward and routing edge-case fixtures belong in automated tests only, not citizen-facing test controls; this preserves a real citizen experience and genuine case totals.
