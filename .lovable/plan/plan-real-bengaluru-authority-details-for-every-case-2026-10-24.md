# Plan: Real Bengaluru authority details for every case

## Goal
When a citizen or staff member opens a case, show who is responsible for that location: the ward, the city corporation, the department, the officers, and the elected representatives. Every detail must come from an official public source, show where it came from, and show the date it was checked. Nothing gets made up.

## What we will collect (official sources only)
1. **Ward boundaries and names.** These come from the current Greater Bengaluru Authority (GBA) ward maps, covering the 5 new city corporations, plus the official ward lists. We will import the ward shapes so any pin on the map finds its ward automatically.
2. **City corporation and zone for each ward.** This includes the Commissioner and Zonal Commissioner, with office phone and email where these are published.
3. **Department contacts by issue type:**
   - Roads, footpaths and potholes: GBA Roads / Ward Engineer (AE/AEE)
   - Garbage: BSWML / ward Health Inspector
   - Streetlights: GBA Electrical
   - Water and sewage: BWSSB service station
   - Power lines: BESCOM sub-division
   - Traffic signals: BTP
   - Lakes and storm drains: GBA SWD / Lakes
4. **Elected representatives.** These are the MLA for each Assembly constituency and the MP, taken from the Election Commission and Karnataka Legislative Assembly lists. Ward corporators will be added only once GBA elections have happened. Until then, the screen will say "Administrator-run, no elected corporator".
5. **Helplines** that work right now: the GBA control room, BWSSB, BESCOM 1912, and others.

## How it appears
- **Case details (citizen and staff):** a "Responsibility chain" card shows Ward, then Corporation/Zone, then Department, then Officer, then MLA/MP. Each entry has call and email buttons, a "Source · checked on date" note, and the "indicative" label.
- **Map:** ward outlines, with each ward showing its CivicFix case count (real counts only).
- **Ward leaderboard:** a ranking of wards by unresolved, resolved and resolution rate, using CivicFix cases only.
- **Staff "Directory admin" screen:** staff can fix or update a contact and mark it as re-verified. Every change is logged.

## Honesty rules
- If we can't verify an officer's name, we show the role and office number only. We never use a placeholder name.
- We never say a report has been "sent to government". Staff can contact the authority, and the case will record that they did.

## Technical details
- Fill the existing civic_* tables with wards (with shapes), corporations, zones, officers, representatives, category-to-department mappings, and source records (URL and verified_at). Load the data through a migration that adds the actual rows.
- A database function finds the ward from a point, and this runs when a report is submitted. The ward is stored on the issue.
- Ward shapes are taken from published GBA/KGIS or OpenCity datasets, simplified so they load quickly.
- Tests check that a known point falls in the right ward, that the category-to-department mapping works, and that "unverified" entries never show a person's name.

## Open item
Officer-level names change often and aren't published for every ward. The first release will cover the ones that are published, and the rest will show role-level contacts until staff fill them in.
