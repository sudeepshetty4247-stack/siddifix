# CivicFix — how the app works today (simple guide)

CivicFix has two parts that share the same reports: the **citizen site** (open to everyone, no login) and the **staff workspace** (login, access given by an admin).

## Part 1 — Citizen site

```text
Home  ->  Report a Problem  ->  Track my report  ->  Civic Map / Explore
```

1. **Home**
   - Vidhana Soudha photo page with buttons to report or track, plus the latest real reports. It has no map.
2. **Report a Problem** (photo, location, send)
   - Opening this page reads the phone's location and shows a card such as "Location locked ±15 m — Garvebavi Palya, South #65 · Bommanahalli".
   - The citizen takes a photo, or picks one from the gallery.
     - A gallery photo's own GPS is used only if the photo has it, and the citizen confirms it.
     - Otherwise the citizen places a pin on the map.
   - AI guesses the problem type and how serious it is, and writes a short description. The citizen can change it.
   - The original photo is kept private. A separate copy is made with the place and time on it.
   - On submit the citizen gets a reference code (for example, BLR-XXXXXX) and a private tracking link.
3. **Location and ward details**
   - All 369 Bengaluru ward boundaries are loaded from the December 2025 official source.
   - Any point resolves to its ward, number, corporation and zone.
   - Each ward shows its assembly seat, MLA (2023 results) and MP (2024 results) from Election Commission data. Corporators show as "not in office" because no council elections have been held.
   - Searching an address (for example, Kudlu Gate) finds the place name.
   - Outside Bengaluru, the app says so honestly and doesn't guess a ward.
4. **Civic Map**
   - A full map limited to Bengaluru, showing a blue "you are here" dot and your ward shaded.
   - Red bubbles show how many reports each ward has.
   - Filters for severity, status and problem type, and a Map/List switch.
   - A list of wards ranked by reports, with search.
   - Active, resolved and overdue cases within 2 km of you.
5. **Report tracking page**
   - A progress bar: Reported, Assigned, Acknowledged, Work underway, Fixed.
   - A "Response from the team" card: who acknowledged it, their message, the inspection day and the estimated completion date.
   - The full history of every change.
   - When the work is marked done, the reporter is asked "Has this problem been fixed?" (Yes, fixed / No, still there). "No" reopens the case.
   - Follow and share buttons, and a "My Tracking" list saved on the phone.
6. **Duplicates**
   - If a new report looks like an existing one nearby, it is flagged as a possible match, not merged automatically. Staff decide.
7. **Explore**
   - All reports, plus a ward leaderboard with resolution rates.

## Part 2 — Staff workspace

1. **Sign in** with email/password or Google.
   - Signing up never gives access on its own. An admin must grant a role.
2. **Roles**
   - Field team: acknowledges, schedules inspections, records work and uploads the completion photo. Limited to the problem types and wards set for them.
   - Supervisor: everything the field team can do, plus assign, reject, review duplicates and close cases.
   - Admin: manages the team and the ward and department records.
3. **Overview**: open cases, cases awaiting acknowledgement, overdue cases, average fix time, and charts by problem type.
4. **Issue Queue**: all cases, with filters.
5. **Case page**
   - **Acknowledge & give a date:** a message plus inspection and completion dates. The citizen sees it straight away.
   - **Change the estimate:** a new date always needs a reason, and the citizen sees it.
   - **Move the case forward:** only the steps allowed next are shown, for example Inspection scheduled, Work in progress, Awaiting verification or Resolved.
   - A case can't be marked resolved without a completion photo.
   - Duplicate review: link reports, reject a match or undo a link. The original reports are always kept.
   - Notifications log: shows only what really happened.
6. **Map & Hotspots**: the staff view of where problems are clustered.
7. **Routing Setup** (admin): edit ward and department records. Every change is recorded with who made it.
8. **Team Management** (admin): give roles and set the name and designation citizens see, plus each person's problem types and wards.

## Rules followed throughout

- No fake reports, counts or people.
- Names, photos or phone numbers are never invented. Unverified officers stay hidden.
- The app never claims the government was told about a report unless that actually happened.
- Every status change is recorded with time and person, and the database re-checks every staff permission.

## What is not done yet (needs you)

1. **First admin account**
   - Sign up on the staff sign-in page and share the email so it can be made admin.
   - Then the full report, acknowledge, fix and confirm flow can be tested.
2. **Sending reports to government offices**
   - Needs an official email or complaint-system access you are allowed to use.
   - Today reports stay in the CivicFix staff queue, marked "Not configured".
3. **Ward officers' names, photos and phone numbers**
   - Need a current official list. MLA and MP names are already shown; their photos show initials until official photos are verified.
4. **Reports**: there are zero reports right now, after your clean-up, so all counts show 0 until real reports come in.

## Suggested next step

Once the admin account exists, run one complete test case end to end: citizen report, staff acknowledgement with a date, completion photo, citizen confirmation. Check that the map and leaderboard update, then delete the test case.
