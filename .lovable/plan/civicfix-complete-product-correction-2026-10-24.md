# CivicFix complete product correction

## Audit results
- The current report still has four stages. Camera and gallery use the same processing path, which strips photo metadata and does not retain the untouched original.
- Reliable GPS, manual pins, live ward lookup, anonymous reporting, private reporter actions, duplicate review, completion evidence and case totals have reusable foundations.
- Home is currently map-free. This latest brief takes precedence and restores a map-first opening screen, without citizen test controls.
- Live checks found **1 report, 0 staff accounts, 369 wards and 0 verified representative records**. Preserve the existing report.
- All **43 existing tests passed**. This does not prove the staff acceptance flow or camera behavior on physical devices.
- The requested NammaKasa reference returned its loading screen, so its full interaction could not be inspected.

## 1. Short photo reporting
- Replace the four-stage form with photo selection, a compact editable preview and one Submit action.
- Camera: request fresh GPS near capture, keep accuracy and acquisition time, and allow camera use even when GPS is denied. Ask for a map point only when necessary.
- Gallery: read supported embedded GPS and capture metadata before processing. Suggest valid photo GPS for confirmation; without it, ask where the problem is. Never inherit current device GPS.
- Run existing AI suggestions automatically. Corrections are optional; failures save an unclassified case for review rather than demand a category.
- Preserve untouched originals privately. Keep a separate display/annotated copy containing only supported location and time information, then add the report reference after creation. Distinguish capture time, file metadata, submission time and corrected report location.

## 2. Place names and map-first Home
- Reuse the existing Bengaluru map, ward restrictions, nearby totals, filters, report action and tracking navigation.
- Resolve selected coordinates through the configured hosted address service; use meaningful locality labels when returned, and an honest selected-location fallback otherwise.
- Support address search through the same hosted service, with manual pin fallback and bounded requests.
- Map selection opens the issue photo, status, history and case-local responsibility details. No fake cases or totals.

## 3. Responsibility people and verified data
- Replace the long responsibility chain with the receiving department and operational team first, verified person/contact details where available and neutral avatars otherwise.
- Put leadership and MLA/MP information behind optional extended details.
- Reuse the protected directory and source dates. Add profile/photo records only as necessary; no disconnected directory or hardcoded identities.
- Import official profiles only after checking current role, constituency/ward linkage, public-contact purpose and portrait source. Missing official records remain missing; a screenshot is not verification.

## 4. Complete staff continuity and duplicates
- Generate possible duplicate candidates after saving, using geographic/category filtering and supported description evidence; image similarity only if a tested integration supports it.
- Keep uncertain originals separate until authorized staff review, with merge rejection/reversal, stable report references, evidence and histories.
- Preserve and validate assignment, reassignment, ownership-review, rejected handoff, escalation, completion evidence and reporter resolution workflows.
- Keep authority recommendations distinct from actual external acknowledgement; record handoff evidence manually where no authorized integration exists.

## 5. Security before acceptance testing
- Remove automatic first-signup administrator promotion. Use explicit owner-authorized administrator provisioning; ordinary signup never grants roles.
- Inspect effective live grants and close any direct operational write paths; enforce staff mutations and audit writes atomically.
- Store reporter token hashes, consistently validate tracking inputs, and separate public case data from internal notes, actor IDs, originals and recovery credentials.
- Add bounded abuse controls to public analysis, submission and tracking actions; strengthen evidence-object validation.

## Verification
- Add focused tests for camera/gallery provenance, embedded/missing GPS, corrected locations, original preservation and annotation labels.
- Test multiple Bengaluru wards, outside coverage, address-service failure, AI failure and missing profiles.
- Test two reports of one issue versus different nearby issues, staff authorization, stale assignments, merge/reversal, required completion evidence, tracking denial and aggregate changes.
- Run the real acceptance sequence with actual saved reports and an authorized staff session. Clearly identify temporary test records and obtain permission before removing them; preserve existing records.
- Report passing checks, failures and unavailable integrations separately. Physical camera behavior still needs a phone check.

## External prerequisites
- **Hosted geocoding:** no hosted Nominatim service URL is configured. Address labels/search cannot be claimed live until a service is supplied and tested.
- **Official profiles:** current officer/representative lists, permitted portraits and geographic constituency mappings are incomplete. Continue authoritative-source research; do not fabricate missing entries.
- **Staff verification:** no staff account exists. Secure bootstrap must be implemented before the owner creates or authorizes the first administrator account.

## Technical approach
Keep TanStack routes, Lovable Cloud, existing private photo storage, client-only Leaflet, protected directory and transactional database operations. Use additive schema changes, preserve current records and integrations, and retain the existing AI model and limits unless its actual request contract needs correction.