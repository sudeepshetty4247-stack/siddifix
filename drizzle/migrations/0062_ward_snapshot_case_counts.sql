CREATE OR REPLACE FUNCTION public.public_ward_snapshot(_identifier text)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH w AS (
    SELECT * FROM public.civic_wards WHERE identifier = _identifier AND active
  ), ward_cases AS (
    SELECT
      count(*) FILTER (WHERE i.status IN ('resolved','closed')) AS resolved,
      count(*) AS total
    FROM public.issues i, w
    WHERE i.routing_snapshot->'ward'->>'identifier' = w.identifier
      AND i.duplicate_of IS NULL
  ), assembly_cases AS (
    SELECT
      count(*) FILTER (WHERE i.status IN ('resolved','closed')) AS resolved,
      count(*) AS total
    FROM public.issues i
    JOIN public.civic_wards cw ON cw.identifier = i.routing_snapshot->'ward'->>'identifier'
    JOIN w ON cw.coverage_id = w.coverage_id AND cw.assembly IS NOT DISTINCT FROM w.assembly
    WHERE w.assembly IS NOT NULL AND i.duplicate_of IS NULL
  ), ls_cases AS (
    SELECT
      count(*) FILTER (WHERE i.status IN ('resolved','closed')) AS resolved,
      count(*) AS total
    FROM public.issues i
    JOIN public.civic_wards cw ON cw.identifier = i.routing_snapshot->'ward'->>'identifier'
    JOIN w ON cw.coverage_id = w.coverage_id AND cw.lok_sabha IS NOT DISTINCT FROM w.lok_sabha
    WHERE w.lok_sabha IS NOT NULL AND i.duplicate_of IS NULL
  )
  SELECT jsonb_build_object(
    'identifier', w.identifier,
    'name', w.name,
    'ward_number', w.ward_number,
    'zone', w.zone,
    'corporation', w.corporation,
    'assembly', w.assembly,
    'mla', w.mla,
    'lok_sabha', w.lok_sabha,
    'mp', w.mp,
    'representative', w.representative,
    'representative_status', w.representative_status,
    'ward_resolved', COALESCE((SELECT resolved FROM ward_cases), 0),
    'ward_total', COALESCE((SELECT total FROM ward_cases), 0),
    'assembly_resolved', COALESCE((SELECT resolved FROM assembly_cases), 0),
    'assembly_total', COALESCE((SELECT total FROM assembly_cases), 0),
    'lok_sabha_resolved', COALESCE((SELECT resolved FROM ls_cases), 0),
    'lok_sabha_total', COALESCE((SELECT total FROM ls_cases), 0)
  )
  FROM w
$function$;