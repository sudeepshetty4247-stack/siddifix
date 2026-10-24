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
