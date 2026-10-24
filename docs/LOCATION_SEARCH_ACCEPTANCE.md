# Siddhi location search acceptance

## Root cause and provider
Both the header picker and incident report searched only after submit. Nominatim searches were restricted to a Bengaluru bounding box. Public Nominatim explicitly prohibits autocomplete, so it remains on-demand reverse geocoding only.

Search-as-you-type now uses Photon `/api/` at `https://photon.komoot.io/`, India geographic bounding box plus country-code filtering, 320ms debounce, keyed request deduplication/cache, eight-second timeout and isolated stale query results. A configured `SIDDI_PHOTON_URL` can replace the public instance. No API key is required for the current public endpoint. Real Hyderabad and Kudlu Gate responses were verified in shell and through the running browser. Public Photon permits reasonable project use but has no availability guarantee and may throttle/ban extensive use; a hosted instance is required for predictable production scale. No such hosted service is currently configured.

## Location behavior
Shared AddressEntry offers automatic real suggestions, keyboard/click selection, loading/empty/retry states and manual entry. Exact address and optional city/state/PIN/directions are held in session drafts; no GPS permission is required. Manual lookup returns candidates for explicit review rather than automatically accepting the first match. Provider failure leaves an unverified text draft, not invented coordinates. A confirmed position is required for submission; text-only unresolved reports are not accepted. Provider result coordinates may describe a locality centre; the citizen should inspect/correct the existing map pin for the exact incident.

Shared incidentCoverage evaluates enabled configured coverage and active ward geometry; ambiguous overlaps remain unknown and cannot submit. Both the location validation endpoint and report submission use it. Submission validates before display-image upload, rechecks coverage, and persists original/normalized address and source/validation details in the existing routing snapshot alongside actual coordinates. Existing private tracking, idempotency and atomic routing are retained. No schema migration was needed.

Outside selections show the Siddhi explorer/Option B message; Change address preserves text and returns focus. Report changes retain photo and description. No unsupported report is created or routed.

## Changed surfaces
Geocoding search, shared address parser/entry, shared incident coverage and validation endpoint, header location picker/provider, report form/input/submission, outside-area illustration, location/coverage tests and documentation. Report incident address drafts are separate from header location drafts.

## Verification
- 215 tests across 27 files passed; new tests cover automatic search, keyboard/click selection, slow earlier responses, provider failure/manual exact text, empty results, India filtering, polygon/corporation matching, outside and ambiguous coverage.
- Real browser desktop: Hyderabad suggestions automatically shown and keyboard selected; outside message shown; correction preserves query; Kudlu Gate verified against live ward data.
- Real browser 390px: gallery photo and description preserved through unsupported selection and correction; Submit disabled outside and enabled at a supported incident. No browser page errors or horizontal overflow. No production complaint was created.
- Latest automatic preview validation: build OK.
- Full hosted submission→staff positive lifecycle not rerun because no verified operational teams or isolated hosted test environment exist. Physical mobile GPS/camera, all Indian PIN/village queries, provider throttling under load and external delivery remain unverified.

## Officer delivery blocker
No accessible connected delivery service or delivery credentials exist. An authorized government email/API/SMS channel, approved sender credentials and verified officer recipient-to-department/jurisdiction mapping are required. The setup question was skipped, so no channel was invented or connected and no government delivery is claimed. In-app notices still work independently.