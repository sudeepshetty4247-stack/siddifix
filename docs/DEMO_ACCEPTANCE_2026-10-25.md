# Siddhi demonstration acceptance — 25 October 2026

## Persisted, verified results
- Current database: **2,100 synthetic reports + 1 preserved genuine report**.
- Dataset: `demo-v1`; **7 synthetic teams, 70 operational accounts and 1 synthetic administrator**. Admin is delegated, not Super Admin.
- Generated histories: **4,752 events**, **1,361 synthetic in-app notifications**, **350 feedback entries**, **2,100 hashed tracking secrets**, **99 duplicate links** at seed completion. A subsequent live acknowledgement added real demonstration activity.
- Lifecycle buckets: confirmed/closed 350; resolved awaiting confirmation 250; in progress 350; pending acknowledgement 200; assigned unacknowledged 200; overdue 200; routing exceptions 150; reopened 150; new 250.
- Public list and public city total both read **1 genuine report**; **0 demo rows** leaked into the public list. Synthetic reports are accessible by explicit DEMO reference, with a conspicuous warning.
- Verified synthetic case notification recipients outside the dataset: **0**.

## Browser and live workflow checks
- Administrator page displays 2,100 reports; cleanup preview reports safe, with no genuine cross-links.
- Synthetic supervisor password sign-in succeeded; loaded scoped queue displays 50 labelled rows on page one, 118 open cases in that supervisor's authorized view.
- Notification centre loaded persisted assignments and 17 unread notifications for the tested supervisor.
- Operational supervisor could not mount the Admin demo page.
- Live guarded staff acknowledgement succeeded for **DEMO-DEMO-V1-00988**; the same acknowledgement was read back on its citizen page.
- Citizen case warning, preserved history and India illustration rendered. Home contains no DEMO references.

## Safety and repairs
- Fixed the actual provisioning failure: persisted staff notifications were rejected by an outdated audience constraint.
- Atomic seed batches roll back on errors; retries skip existing labelled references.
- Fixed the API 1,000-row cap that made the admin total incorrectly display 1,000.
- Genuine routing, duplicate suggestions and scheduled production deadlines exclude synthetic data; handlers/teams/links and recipients are dataset-matched.
- Cleanup checks dependencies transactionally before data deletion; authentication-account removal follows successful data cleanup. No cleanup of this dataset was executed, so the demo remains available.
- India/Commons photos are illustrative; they are not proof of the reported event. Credits remain in the application source.

## Tests and remaining limitations
- **260 tests passed across 35 files**; latest preview validation **build OK**.
- This is a completed seeded demonstration, not certification that every requested real-world dependency exists.
- Generated resolved/closed histories are synthetic fixtures, not verified completion evidence. A full hosted camera/upload/evidence → resolution → confirmation lifecycle was NOT repeated this round; existing isolated lifecycle tests passed.
- Same/different-angle visual recognition was not added; uncertain duplicate matches still require human review.
- No external government email/SMS/API delivery occurred or is configured; authorized channel credentials and verified recipients are still required.
- Physical-phone GPS, camera, speech, push delivery and provider load remain unverified.
- Controlled clock/reset presentation tools and synthetic PDF/XLSX dashboard reconciliation were not completed this round. Existing public exports intentionally exclude demo rows.
- Full official officer-photo/contact coverage still depends on verified, licensed sources; nothing was fabricated.

## Demonstration access
Use the accompanying private account file. The admin page also supports protected demo-password reset and download. Resetting invalidates passwords in the file. Never distribute these credentials publicly or treat demo teams as genuine operational government teams.
Sample citizen reference: /issues/DEMO-DEMO-V1-00001. Live acknowledgement example: /issues/DEMO-DEMO-V1-00988.
