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
- Staff analytics use full-dataset database aggregates, not the capped triage sample; the map keeps case selection and public history in-place.
- Bengaluru ward boundaries and representatives ship as static public/data/bengaluru-wards.json (OpenCity GBA 369 wards, lng/lat order) and resolve client-side in src/lib/wards.ts; officer names are role-level only because they aren't reliably published.
