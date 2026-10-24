# Authority portraits and photo QA

## Delivered

- Initial diagnosis: all 781 profiles lacked photo URLs and photo sources. Elected cards did not consume portrait records. Their profiles were additionally filtered out because constituency names were compared with operational city zones.
- Added independently verified portrait provenance fields, source and licence credits, fixed-size images, and initials on missing/unverified/failed images.
- Three licensed Wikimedia Commons portraits now populate 235 existing ward-linked representative profiles: Tejasvi Surya (106), Shobha Karandlaje (115), Krishna Byre Gowda (14). These are licensed sourced portraits, not official institutional photographs or evidence of endorsement. Shobha's image dates from 2014. Source records are in `authority-portrait-sources.json`; on-screen licence links retain attribution.
- Remaining 546 profiles use initials; 37 operational identities still require verification. No officer portrait, contact, or elected corporator was invented.
- Fixed elected constituency/operational-zone scope matching and the case-page horizontal overflow found at 390px.
- Added 40 distinct licensed test photographs across 20 subjects. They live only in `src/test/fixtures/civic-photos/`, with source URLs, author, licence, hashes, modifications and scenario metadata. Images were resized/recompressed and EXIF stripped. International and historical sample scenes are not Bengaluru incidents; test coordinates are independent manual inputs, not claimed capture GPS.
- Strengthened photo-container framing checks and category/subcategory consistency. Container checks are not full server-side decoding or malware scanning.

## Executed evidence

- `bunx vitest run`: **16 files, 128 tests passed**.
- All 40 fixtures passed actual shared submission-schema validation, byte/hash checks, category pairing and an official-boundary match for their specified corporation.
- Real encoded PNG and WebP fixtures passed format validation; malformed/unsupported formats, missing/out-of-range coordinates, oversized input and mismatched classification were rejected in unit tests.
- Portrait tests exercised missing provenance, insecure URLs, load/error fallback and URL replacement. Scope tests reject wrong ward/corporation and retain operational-zone restrictions.
- Playwright opened existing case `BLR-PJSC6T` at 1280px and 390px. Tejasvi Surya's image decoded at 250px natural width; names and source credits rendered; no horizontal page overflow and no page errors were observed. Screenshots are temporary execution evidence, not repository fixtures.
- Latest automatic preview check: `build OK` after the final code edits.

## Not executed or not established

- **40-case persisted citizen-to-staff lifecycle suite is blocked:** preview and published app share the live backend. No isolated test backend has been established. No sample complaints were inserted by this task.
- Fixture schema tests do not verify live AI classification, live routing, original-storage persistence, staff acknowledgement, completion evidence, citizen confirmation, or cleanup for those 40 photographs. Those are not claimed as passed.
- Scenario expected workflow fields describe intended acceptance checks, not observed outcomes. Actual starting status depends on AI confidence and can be `needs_classification`.
- Distinct image subjects do not guarantee classification: damaged-sign examples are not necessarily missing signage; lamp collision images cannot establish a night-time outage; public ownership, sewage and building jurisdiction require human review.
- Real physical Android/iOS camera and GPS checks, bad network/retry lifecycle branches, every portrait identity rendered through a real ward screen, current official officer photographs, and bulk test cleanup remain unverified.
- This task did not publish the changed app. Directory data changes apply immediately; preview code is current and published code changes require publishing.

## Safe next acceptance run

1. Establish a separate backend and confirm it is not the shared live one.
2. Provision dedicated test admin, supervisor and field-worker accounts with explicit scopes.
3. Use the manifest's IDs to submit each fixture through the actual citizen page, confirming manual locations for EXIF-free samples.
4. Record AI result, persisted ward/routing outcome and public/private tracking separately from expectations.
5. Exercise staff assignment, acknowledgement/ETA, in-progress, completion evidence, resolution and reporter confirmation; verify events and scope denial.
6. Cover duplicate review, retries, upload/AI failures, denied/rough GPS and outside coverage without treating a simulated test as a physical-device check.
7. Delete only tagged test reports and their related private files in the isolated backend, then verify zero tagged rows/files remain.

No complete-production-readiness certification is made by this report.