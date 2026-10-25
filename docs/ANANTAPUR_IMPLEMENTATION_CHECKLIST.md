# Anantapur implementation checklist

## Preserve
- Existing anonymous reporting, private tracking, integrity controls, evidence and audited lifecycle.
- Existing protected staff/admin portals, roles, notifications and all Bengaluru records.
- Existing Leaflet maps, Photon search and on-demand reverse geocoding.

## Inspect and reuse
- `civic_coverage`, `civic_wards`, `civic_department_routes`, `civic_people`, `civic_teams`.
- LocationProvider and existing translation context; keep incident drafts independent.
- Database authorization predicates and atomic routing/status functions.

## Required adaptations
- Configurable service-area metadata and shared browsing preference.
- Explicit report/operational scope with conservative historical backfill.
- District-isolated retrieval and permissions, including direct API paths.
- Extend translation resources for Telugu without replacing dynamic report text.
- Source-backed Anantapur identities; municipal boundary activation only with evidence.

## Risks and dependencies
- Existing citywide aggregates/map defaults may mix cities unless consistently scoped.
- Legacy empty staff scopes must not become all-district access.
- Political-directory records are not operational staff or delivery endpoints.
- Official boundary evidence, native language review and authorized operational accounts may require external setup.
- Preview and published app share the database: no destructive migration or genuine-case test mutation.