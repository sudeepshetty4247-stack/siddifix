# Collect and verify real photos for MLAs, MPs and officers

## Where things stand now
- MLAs: 27 people (repeated across 369 ward rows), and only 1 has a photo.
- MPs: 5 people, and only 2 have photos.
- GBA leaders: 6 people. Operational officers: 37. None have photos. Phone numbers are stored for 42 of them.
- No photos were ever actually collected. That's why most profiles show initials.

## What I'll do
1. **Audit and list everyone.** Write a list of each unique person with their name, role, constituency or area, and current photo status.
2. **Collect photos, in this order of sources:**
   - **MLAs:** Karnataka Legislative Assembly member pages, matched by name, constituency and constituency number.
   - **MPs:** Digital Sansad / Lok Sabha profiles, matched by name and constituency.
   - **GBA and corporation leaders, and officers:** official GBA and corporation websites, and government press releases.
   - **Fallback:** Wikimedia Commons, only when the person's identity is confirmed. I'll record the exact file and its licence.
   - I won't guess, use AI-made faces, use private social media, or match on name alone.
3. **Check every image.** Confirm it's a real picture, the right file type, a sensible size, and that it opens properly. Then host it on the app's own media storage. A record is only updated after every step succeeds. Running the process again won't create duplicates.
4. **Store where each photo came from:** the source page, the original image link, credit, licence, a status and notes. Statuses: verified, candidate found, pending review, not found, licence unclear, download failed, upload failed. Images with an unclear licence keep only the source link for review and aren't copied.
5. **Admin review screen.** Admins can see the current and candidate photo, the source, credit, licence and status. They can approve, reject, fix the credit, retry, or mark a photo as unavailable. Every change is audited, and only admins are allowed to make it. This is checked on the server, not just on the screen.
6. **How photos appear.** Profiles show verified photos only and fall back to initials when a photo is missing or broken. Faces are cropped cleanly, the page doesn't jump while a photo loads, and the credit can be seen. This works on the Civic Map, case pages and mobile.
7. **Tests and final report.** Add automated tests using sample images and fake source responses, then visit a few wards to check in person. The report will give the counts and a per-person list of anyone still missing a photo, with the reason.

## Technical details
- A migration adds photo_status, photo_license, photo_original_url and photo_verification_notes to civic_people. It also adds an admin-only security-definer RPC to approve or reject photos, which writes to civic_directory_audit.
- The collection script runs on the server through a controlled admin job. Downloads are rate-limited with timeouts and retries, and images are checked by their actual content (magic bytes) and dimensions. Photos go to the Lovable Assets CDN. Each person is identified by constituency number so all of their ward rows update together.
- AuthorityPortrait will be extended with alt text, a fixed aspect ratio, a one-time fallback on error and a credit popover.
- Expected gaps: many operational officers have no public portrait, so they'll keep initials and be listed in the report.
