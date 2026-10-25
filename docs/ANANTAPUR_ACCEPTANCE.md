# Siddhi Anantapur extension — verified implementation report

## Status: partial implementation, not a completed operational rollout

Anantapur can now be selected independently of device GPS and interface language. It has its own Home photo, local officials, municipal contact, map center, local report lists and area-filtered aggregate exports. **Anantapur reporting remains deliberately disabled:** no verified municipal ward polygons or authorized active operational teams were available. It must not be demonstrated as a working government delivery channel.

## Architecture discovered
- Existing React/TanStack application already has anonymous reporting, private tracking, report integrity, audited staff lifecycle and recipient notifications.
- Directory entities already support civic coverage IDs, but issues, teams and staff permissions previously assumed Bengaluru.
- Existing LocationProvider tracked a selected point; incident forms already maintained separate report coordinates.
- Existing i18n covered navigation in English/Hindi/Kannada, not every screen. No second translation engine was introduced.

## Implemented and checked
- Configurable coverage metadata: state, district, municipality, scope, map center, language suggestion and boundary readiness.
- Shared browsing area, saved manual preference and independent selected coordinates; explicit language preferences survive area changes.
- Anantapur/Bengaluru selector populated from configured records.
- Home, Explore, Civic Map, city overview, transparency snapshots and export workspace include the selected area in their requests/query keys.
- Existing tracking links remain intentionally cross-area and keep original report coordinates.
- Anantapur local cover: Maheshrig, *Anantapur Clock tower at night*, CC BY-SA 3.0, Wikimedia Commons. Attribution shown. Bengaluru cover preserved.
- Telugu navigation, key Home/local-information content, area selection, status labels, assistant starter text/voice language, and staff/admin navigation. English, Telugu, Kannada and existing Hindi remain selectable.
- Admin → Service areas: metadata, source, viewport, reporting readiness, staff geographic scope and inactive team creation.
- Original report service-area ID persisted by database trigger; existing valid routing snapshots conservatively backfilled. Cross-area team assignment rejected.
- Team auto-routing constrained by area and existing dataset separation. Staff case access constrained by area in addition to existing category, department, team, ward and suspension checks.
- District admin case permissions and directory mutations constrained by area; Super Admin retains explicit cross-area authority.
- Unverified boundaries cannot activate reporting, including direct configuration updates.

## Official Anantapur records
Scope is **Anantapur municipal service area**, not the entire district. Bounds are explicitly viewport-only; no legal jurisdiction polygon was invented.

| Record | Source | Verification |
|---|---|---|
| Daggupati Prasad, MLA | District public-representatives page | Identity source checked; Anantapur Urban AC 153; exact ward linkage pending |
| Ambica G. Lakshminarayana Valmiki, MP | Same official page | Identity source checked; Ananthapuramu constituency; exact ward linkage pending |
| O. Anand, District Collector | District administration page | Published official identity; district scope, not repair assignment |
| C. Vishnu Charan, Joint Collector | District administration page | Published official identity; district scope |
| Municipal Corporation, 08554-230234 | District municipality directory | Published contact; no connected delivery integration |

Sources:
- https://ananthapuramu.ap.gov.in/public-representatives/
- https://ananthapuramu.ap.gov.in/divisions/district-administration/
- https://ananthapuramu.ap.gov.in/public-utility-category/municipality/
- https://anantapur.cdma.ap.gov.in/ulbprofile/anantapur/gis-map
- https://ananthapuramu.ap.gov.in/website-policies/

No official portrait was republished: the district policy requires permission by email, and no permission was available. Names retain initials rather than fabricated photos. No representative login or operational assignment was created.

## Database changes
- `0051_multi_service_area_foundation.sql`: additive coverage/settings/scopes, case guard, area-safe public rows, snapshot filtering, area configuration and scope RPCs.
- `0052_area_directory_and_configuration_guards.sql`: identity provenance separate from exact ward linkage, scoped directory policies, team creation/guards and direct reporting-activation guard.
- `0053_area_scoped_provisioning_and_admin_guards.sql`: scoped route edits, staff/team scope consistency and Super Admin-only unscoped account provisioning during rollout.
- Existing records preserved: readback showed **2,101 Bengaluru reports, including 2,100 labelled showcase reports**. No Anantapur cases or operational accounts were fabricated.

## Tests actually run
- Complete suite: **304 tests passed across 40 files**, with two workers.
- Later focused staff/notification/district suite: **25 passed**.
- Final coverage/authority/district suite: **22 passed**.
- Latest automatic preview validation: **build OK**. No manual production build was run.
- Browser: Anantapur official names displayed, Explore returned zero Anantapur case cards, map visibly centered on Anantapur, English/Telugu selection and Telugu persistence when returning to Bengaluru.
- Mobile viewport 390×844: no horizontal overflow on Home or Map; area selector opens; Anantapur map remains local even with Bengaluru device GPS; transparency shows Anantapur; no page errors observed.
- SQL fixture tests directly exercise assigned staff access, cross-district denial, scoped admin denial, Super Admin access and unknown/unconfigured scope denial.

## Remaining work / blockers
1. **Verified boundary:** supply official current Anantapur municipal/ward Polygon or MultiPolygon data with source URL and verification evidence. Import into civic_wards before reporting activation. The official GIS page did not provide a verified downloadable boundary.
2. **Operational setup:** authorized departments, teams and staff accounts must be configured. There are zero active Anantapur teams. Geographic permissions alone do not supply a department or person.
3. **Full localization is unfinished:** many detailed report, tracking, staff/admin forms, notification templates and export labels remain English; Kannada new-key translations and native Telugu review remain outstanding. This is a foundation, not complete application-wide localization.
4. **Hosted staff/admin positive acceptance unavailable:** requesting user has no matching mintable app account; self-session creation failed. No unrelated account was selected or impersonated. Full Anantapur submission→staff→evidence→citizen lifecycle was not run because reporting is disabled.
5. **Administrative rollout:** some legacy non-area configuration and privileged account-list operations still need a complete district-administrator audit. Unscoped account provisioning is restricted to Super Admin in this rollout. Do not provision district administrators as a claim of full isolation before that audit.
6. **Official portraits:** obtain reproduction permission and verify identity/image rights before hosting district photos.
7. **Government delivery:** authorized email/SMS/API credentials and verified recipient mappings remain absent; contact links do not constitute connected delivery.
8. No publish/deployment action was performed. Physical-phone GPS, speech engines and native-language review remain unverified.

## Main changed modules
`service-area.ts`, `service-area.functions.ts`, `location.tsx`, `directory.ts`, `directory.functions.ts`, `incident-location.functions.ts`, `public-cases.ts`, `issues.functions.ts`, `i18n.tsx`, `locales/te.ts`, citizen Home/Explore/Report/Transparency/layout, CitizenMap, CityOverview, ReportWorkspace, AreaAuthoritySummary, PeopleDirectoryEditor, AssistantChat, assistant context, PortalShell, admin service-area screen, shared status/back controls, fonts and focused tests.