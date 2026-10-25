# Siddhi final Anantapur verification — 25 October 2026

## Acceptance: partially implemented, not demonstration-ready for Anantapur lifecycle

No missing boundary, staff workflow, photograph permission or hosted test result is represented as completed.

| Requested result | Observed result |
| --- | --- |
| Approximately 500 Anantapur demo entities | **0 seeded**. Reporting is disabled because no verified municipal polygon was obtained. No fabricated geometry or Bengaluru-labelled Anantapur cases were inserted. |
| Reports with working Anantapur images | **0 Anantapur reports**. All **13 existing licensed demonstration images** return image responses successfully; Bengaluru Home has no broken rendered images. |
| Boundary scope/source | Target remains **Anantapur Municipal Corporation**, not Ananthapuramu district or Anantapur mandal. Official CDMA GIS identifies ULB 1 but supplies encrypted Sachivalayam data, not a verified public boundary download. APSAC's advertised Andhra-MunicipalBnd service returns 404. OSM relation 10215519 is Anantapur Mandal and was rejected. |
| Authority records | Four existing official-source identities preserved: Daggupati Prasad, Ambica G. Lakshminarayana Valmiki, O. Anand, C. Vishnu Charan. Collector and Joint Collector public telephone/email updated from the official district administration page. |
| Authentic portraits | Official MLA/MP portrait URLs identified and stored as source provenance. **0 published portraits**: website policy requires permission by email before reproduction. Neutral placeholders retained. |
| Anantapur teams/accounts | **0 teams, 0 accounts created**. Area-aware secure provisioning repaired, but no hosted creation claimed. |
| Report lifecycle | Existing isolated PostgreSQL lifecycle tests pass; **no hosted Anantapur citizen → staff → evidence → resolution run**. Reporting remains disabled. |
| In-app notifications | Seven isolated transaction tests pass, covering authorized recipients, retries, read/unread, archive and access revocation. No hosted Anantapur notification created or delivered. No SMS/calls/push added. |
| Bengaluru regression | Database readback: **2,101 reports = 2,100 labelled showcase + 1 genuine**; **369 active wards preserved**. Home statistics and showcase cards render; area switching does not show Bengaluru rows in Anantapur. |
| Automated tests | **311 tests across 43 files passed** in the final full run, with two workers. |
| Build/type validation | Latest automatic preview validation: **build OK**. No separate manual build or typecheck run. |
| Lint | Full repository lint **failed: 7,256 errors / 40 warnings** at the recorded run, mainly 7,246 fixable formatting errors. Targeted lint of new test/resource/location files passed. Changed frontend/server files formatted. Repository-wide lint cleanliness is not claimed. |
| Browser checks | Public Home/map, English/Telugu/Kannada document language, explicit Telugu persistence across area switches, officer contact link, 390px overflow check, reusable images, signed-out staff/admin redirects. No page errors in observed public runs. |

## Critical repairs delivered

1. Seeder now explicitly selects one service area, filters its active verified ward polygons and category routes, persists matching team geography, refuses another area's existing dataset, and validates generated coordinates before insertion.
2. Polygon interior points replace the unsafe average-of-vertices placement assumption. This avoids placing concave-polygon reports outside the boundary.
3. Atomic account provisioning accepts and validates geographic scopes before staff insertion, rather than creating an Anantapur team member with Bengaluru's default scope. Same-area team validation and administrative permission persistence share the transaction.
4. Dataset management is Super Admin-only. Staff invitations now select and validate a service area and its teams before sending an invitation. Passwords no longer appear in the rendered credential list; protected download behavior is retained.
5. District administrators now derive geographic access exclusively from protected administrator permissions. An operational profile cannot widen administrator scope. Suspended accounts cannot manage area directory records.
6. Unverified/disabled service-area locations stay **unresolved**, not falsely described as outside a known boundary. The map clearly displays the verification-pending notice.
7. Server-side location checks invoke a server helper instead of calling another server-function RPC stub, avoiding a published manifest-boundary failure.
8. Kannada shared resources cover every Telugu shared key; status labels now use Kannada translations as well. Full application-wide translation remains incomplete.

## Source checks

- Public representatives: https://ananthapuramu.ap.gov.in/public-representatives/
- District administration: https://ananthapuramu.ap.gov.in/divisions/district-administration/
- District officers: https://ananthapuramu.ap.gov.in/contact-district-officers/
- Copyright permission policy: https://ananthapuramu.ap.gov.in/website-policies/
- Municipal map: https://anantapur.cdma.ap.gov.in/ulbprofile/anantapur/gis-map/
- APSAC municipal service listing: https://apsac.ap.gov.in/?page_id=6966

The official municipal commissioner entry gives a role-level number but no named incumbent. District Revenue Officer names conflict between official pages; no guessed name imported.

## Remaining blockers

- **Municipal boundary:** a usable source-verified Anantapur Municipal Corporation polygon is required before activating geographic reporting or seeding coordinates.
- **Anantapur organization:** configured demonstration teams and invited accounts plus an authorized session are needed for hosted end-to-end acceptance. The requesting user's verified email has no matching application account; managed self-session minting failed. No other user's session was selected without authorization.
- **Portrait reproduction:** email permission required by the government's website policy. Identity matching does not establish reuse permission.
- **Localization:** remaining hardcoded forms, notification text, detailed staff/admin content, errors and exports need translation and native review. Shared-resource coverage is not full application coverage.
- **Quality:** repository-wide lint failures and physical-device/browser speech/camera/load testing remain outstanding.

No deployment performed. No citizen report, existing Bengaluru report, real account or existing team was deleted or overwritten.