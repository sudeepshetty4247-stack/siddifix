# Add real photos for MLAs, MPs and officers

## Where things stand now
- MLAs: 27 people, and only 1 has a photo.
- MPs: 5 people, and only 2 have photos.
- Officers (6 leaders and 37 operational officers): none have photos. Phone numbers are already stored for 42 of them.
- No photos were ever actually collected. That's why most profiles show initials.

## What I'll do
1. **MLAs and MPs:** for each person, get the official portrait from the Karnataka Legislative Assembly member pages, the Lok Sabha / Sansad member profile, or Wikimedia Commons (which shows the licence). Save the photo, the source link, who took it and the licence for each person.
2. **Official contacts:** add the public office email and phone for each MLA and MP where Sansad or the Assembly site lists them.
3. **GBA leadership and officers:** add photos only where the official GBA website or a government press release shows a clear portrait of that named officer. Anyone without one keeps initials. I won't use a guessed or look-alike photo.
4. **Hosting:** store every photo on the app's own media storage. The app won't link to outside images that can break or be swapped.
5. **Check:** open several wards on the Civic Map and on case pages and confirm the faces, names and credits show correctly. Then report the exact count of who now has a photo and who doesn't, with the reason for each gap.

## Technical details
- Download through a script, then upload to the asset CDN. Update the `civic_people` rows with photo_url, photo_source_url, photo_credit, photo_license_url, photo_verified = true and photo_verified_at. All of these go through the audited directory tables.
- Match each MLA to their constituency number, so all of their ward rows update together.
- AuthorityPortrait already shows the verified photo and falls back to initials, so no screen changes are needed.
