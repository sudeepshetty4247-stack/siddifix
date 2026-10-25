# Siddhi report integrity — acceptance and limits

## Implemented
- Server schema validation for fields, category/subcategory, coordinates, MIME and byte limits; enabled live coverage and unique ward checks before persistence. Confirmed incident location remains independent of device location.
- Private session-bound original-upload reservations, actual byte-size checks, type/dimension checks, JPEG pixel decoding and PNG decoding with CRC validation. Original and processed photos are both checked. Staff evidence and annotated copies use the same validation.
- Atomic report + private capability + evidence + integrity state persistence. Retry fingerprints and session ownership prevent a changed request from obtaining an existing reference. No reference is returned on save failure.
- Configurable database-backed temporary session/network/authenticated-account limits. Defaults: 10 session, 60 shared-network, 15 account requests per 10-minute phase window. No permanent IP-only bans. Daily keyed network pseudonyms; raw addresses are not persisted in new controls. Account limits apply when a validated bearer identity exists; anonymous reporting remains available.
- Signed, expiring, one-use session-bound arithmetic verification after repeated submissions. Keyboard and screen-reader usable, no third-party credential needed. This is a lightweight hurdle, not a strong CAPTCHA.
- Atomic explainable risk signals: reused original bytes (30), repeated report fingerprint within a day (25), nearby same-category candidate (15), submission burst (15), unverified address/photo mismatch (20), incomplete other-category details (10). Threshold defaults to 30; score is capped at 100. No AI-fraud flag, anonymous/new-user penalty or missing-photo penalty.
- Separate review state: unverified, pending review, verified, information requested, invalid, appealed. Reports remain preserved during review; urgent operational work is not automatically paused by uncertain signals.
- Staff/admin review queue with pagination and scope enforcement. Only active in-scope supervisors/admins verify, request information or mark invalid; a reason is mandatory. Decisions store reviewer, time, prior/new integrity state and operational status, and a public event. Existing duplicate review now requires scope on both records and supervisor authority.
- Private reporter-token clarification and appeal. Clarification text is an internal event, not public evidence; decision reasons are public. Appeal does not silently undo invalidity; authorized verification can reopen the operational case.
- Integrity events connected to persisted scoped in-app notifications, preserving dataset segregation. Demo cleanup includes integrity dependencies. Admin can clean expired unclaimed originals without removing attached evidence.
- Photo-free citizen reporting with meaningful description; explicit confirmation summary and incident map; existing duplicate view/track/continue path remains.

## Verified on 25 October 2026
- 292 tests across 38 files passed. 27 new tests cover signals, upload content, configuration, anonymous text reporting, direct SQL review permissions, rejected reasons, stale reviews, private-token denial/appeal, temporary limits/concurrent requests, challenge nonce replay, inactive accounts, forged outside coordinates, reservations and retry conflicts.
- Final unrestricted parallel run hit four existing database-fixture startup timeouts; rerunning the complete suite with two workers passed all 292 tests with no skips.
- Preview harness reported build OK after the changes. No manual build was run (the managed harness builds automatically).
- Browser: anonymous photo-free form, pin confirmation and report summary displayed; authorized labelled demo admin opened review/settings and saved verification on DEMO-DEMO-V1-00001. The saved decision was read back visually and from the database; no browser page errors.
- Existing report totals remained 2,101: 2,100 labelled showcase + 1 genuine. No genuine report was changed or new live complaint created for acceptance testing. One labelled existing case received a verification audit event.
- Deployed schema, integrity notification mapping and cleanup integration verified through live database reads.

## Remaining risks and unverified acceptance
- This is not perfect fraud detection or a zero-critical-defect certification. Human review remains necessary.
- Arithmetic challenges are straightforward for sophisticated bots; session cookies can be reset, proxies can rotate and shared-network users can hit aggregate allowances. A managed CAPTCHA/edge WAF and independently verified ingress-IP contract remain production hardening dependencies. No provider credentials were available.
- WebP type, dimensions and RIFF chunks are checked, but WebP pixels are NOT fully decoded server-side. JPEG/PNG receive deeper validation. Edge-compatible WebP codec and independent malware scanning remain outstanding.
- No claim is made that a selected in-coverage point proves the physical event occurred there. Photo GPS/address metadata is unverified and only generates review signals. No current-device GPS disagreement penalty is applied.
- Image matching is exact-byte matching, not robust perceptual matching. Cropping/re-encoding can evade it. Similar descriptions/nearby reports are signals, not proof.
- Original files and processed display files are not cryptographically proven to show the same content; reviewers retain originals. Storage upload and SQL commit cannot be one transaction. Best-effort cleanup plus an admin expired-original cleanup command cover some orphans; crash-orphaned processed images and automated cleanup scheduling remain outstanding.
- Review retention policy needs owner-approved duration; no evidence is silently purged. Consumed reservation/session hashes currently remain for retry verification. Limit windows/challenge rows are pruned during new requests; older legacy limiter rows are not automatically pruned.
- The full new anonymous submission → storage → review → appeal flow was verified in isolated database tests, not newly seeded against shared live data. Production byte-decoder runtime/load limits, mass abusive traffic and physical-device accessibility need further acceptance. Existing 2,100-case dataset was preserved.
- Publish to apply the new signing secret and code to the published site; preview already uses them. No deployment was requested or performed in this turn.

## Where to use it
Staff → Report review; Administration → Report integrity. A scoped case page exposes integrity decisions to authorized supervisors. Citizen private tracking exposes clarification/appeal only when requested or invalidated.