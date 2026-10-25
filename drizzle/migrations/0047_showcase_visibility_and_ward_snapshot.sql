-- Opt-in demonstration visibility for public showcases plus public ward representative lookup.
-- Every function still defaults to genuine reports only; demo rows appear only when the caller explicitly asks.

CREATE OR REPLACE FUNCTION public.public_case_rows(_ref text DEFAULT NULL::text, _include_demo boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT coalesce(jsonb_agg(row),'[]'::jsonb) FROM (SELECT i.id,i.ref_code,i.title,i.summary,i.description,i.category,i.subcategory,i.severity,i.status,i.safety_warning,i.lat,i.lng,i.landmark,i.photo_url,i.department,i.support_count,i.sla_due_at,i.resolved_at,i.created_at,i.updated_at,i.duplicate_of,i.duplicate_candidate_id,i.routing_snapshot,i.acknowledged_at,i.ack_message,i.eta_at,i.inspection_at,
  CASE WHEN i.acknowledged_by IS NULL THEN NULL ELSE public.staff_actor_label(i.acknowledged_by) END AS acknowledged_by_label
  FROM public.issues i WHERE (_ref IS NULL AND (_include_demo OR i.demo_dataset_id IS NULL)) OR i.ref_code=_ref ORDER BY i.created_at DESC LIMIT 1000) row $function$;

CREATE OR REPLACE FUNCTION public.nearby_case_summary(_lat double precision, _lng double precision, _radius_m double precision DEFAULT 2000, _include_demo boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ DECLARE result jsonb; BEGIN IF _lat IS NULL OR _lng IS NULL OR _radius_m IS NULL OR NOT (_lat BETWEEN -90 AND 90) OR NOT (_lng BETWEEN -180 AND 180) OR NOT (_radius_m BETWEEN 100 AND 10000) THEN RAISE EXCEPTION 'Invalid location or radius'; END IF;
SELECT jsonb_build_object('total',count(*),'active',count(*) FILTER(WHERE status::text NOT IN ('resolved','closed','rejected')),'resolved',count(*) FILTER(WHERE status::text IN ('resolved','closed')),'overdue',count(*) FILTER(WHERE status::text NOT IN ('resolved','closed','rejected') AND coalesce(eta_at,sla_due_at)<now()),'critical',count(*) FILTER(WHERE status::text NOT IN ('resolved','closed','rejected') AND severity='critical'),'radius_m',_radius_m) INTO result FROM public.issues WHERE duplicate_of IS NULL AND (_include_demo OR demo_dataset_id IS NULL) AND 6371000*2*asin(least(1.0,sqrt(power(sin(radians(lat-_lat)/2),2)+cos(radians(_lat))*cos(radians(lat))*power(sin(radians(lng-_lng)/2),2))))<=_radius_m; RETURN result; END $function$;

CREATE OR REPLACE FUNCTION public.ward_case_counts(_include_demo boolean DEFAULT false)
 RETURNS TABLE(ward_identifier text, reports bigint, unique_issues bigint, unresolved bigint, resolved bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT routing_snapshot->'ward'->>'identifier',
    count(*),
    count(*) FILTER (WHERE duplicate_of IS NULL),
    count(*) FILTER (WHERE duplicate_of IS NULL AND status NOT IN ('resolved','closed','rejected')),
    count(*) FILTER (WHERE duplicate_of IS NULL AND status IN ('resolved','closed'))
  FROM public.issues
  WHERE routing_snapshot->'ward'->>'identifier' IS NOT NULL
    AND (_include_demo OR demo_dataset_id IS NULL)
  GROUP BY 1
$function$;

CREATE OR REPLACE FUNCTION public.public_transparency_metrics(_days integer DEFAULT 0, _include_demo boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE result jsonb;
BEGIN
 IF _days NOT IN (0,7,30,90,365) THEN RAISE EXCEPTION 'Unsupported reporting period'; END IF;
 WITH cases AS (
 SELECT i.*, w.identifier AS ward_key,w.name AS ward_name,w.corporation AS ward_corporation,w.assembly_no,w.assembly,w.lok_sabha,
 i.status IN ('resolved','closed') AS done,
 i.status NOT IN ('resolved','closed','rejected') AS open,
 i.status NOT IN ('resolved','closed','rejected') AND coalesce(i.eta_at,i.sla_due_at)<now() AS late
 FROM public.issues i LEFT JOIN public.civic_wards w ON w.identifier=i.routing_snapshot->'ward'->>'identifier'
 WHERE i.duplicate_of IS NULL AND (_include_demo OR i.demo_dataset_id IS NULL) AND (_days=0 OR i.created_at>=now()-make_interval(days=>_days))
 ), summary AS (
 SELECT count(*) AS total,count(*) FILTER(WHERE open) AS active,count(*) FILTER(WHERE done) AS resolved,count(*) FILTER(WHERE status='rejected') AS rejected,count(*) FILTER(WHERE late) AS overdue,count(*) FILTER(WHERE escalated_at IS NOT NULL) AS escalated,count(*) FILTER(WHERE acknowledged_at IS NOT NULL) AS acknowledged,count(*) FILTER(WHERE ward_key IS NULL) AS unmapped,
 round(avg(extract(epoch from (resolved_at-created_at))/86400) FILTER(WHERE done AND resolved_at>=created_at),1) AS average_resolution_days FROM cases
 ), groups AS (
 SELECT 'corporation' AS dimension,coalesce(ward_corporation,'Unmapped / review required') AS key,coalesce(ward_corporation,'Unmapped / review required') AS label,count(*) AS total,count(*) FILTER(WHERE open) AS active,count(*) FILTER(WHERE done) AS resolved,count(*) FILTER(WHERE late) AS overdue FROM cases GROUP BY ward_corporation
 UNION ALL SELECT 'category',category,category,count(*),count(*) FILTER(WHERE open),count(*) FILTER(WHERE done),count(*) FILTER(WHERE late) FROM cases GROUP BY category
 UNION ALL SELECT 'ward',coalesce(ward_key,'unmapped'),coalesce(ward_name,'Unmapped / review required'),count(*),count(*) FILTER(WHERE open),count(*) FILTER(WHERE done),count(*) FILTER(WHERE late) FROM cases GROUP BY ward_key,ward_name
 ), rep_directory AS (
 SELECT 'mla' AS kind,w.assembly_no::text AS constituency_key,w.assembly AS constituency,min(p.full_name) AS name,min(p.source_url) AS source_url,max(p.checked_at) AS checked_at
 FROM public.civic_wards w LEFT JOIN public.civic_people p ON p.ward_identifier=w.identifier AND p.kind='mla' AND p.active AND p.verification_status='verified'
 WHERE w.assembly_no IS NOT NULL AND w.assembly IS NOT NULL GROUP BY w.assembly_no,w.assembly
 UNION ALL
 SELECT 'mp',w.lok_sabha,w.lok_sabha,min(p.full_name),min(p.source_url),max(p.checked_at)
 FROM public.civic_wards w LEFT JOIN public.civic_people p ON p.ward_identifier=w.identifier AND p.kind='mp' AND p.active AND p.verification_status='verified'
 WHERE w.lok_sabha IS NOT NULL GROUP BY w.lok_sabha
 ), reps AS (
 SELECT r.*,count(c.id) AS total,count(c.id) FILTER(WHERE c.open) AS active,count(c.id) FILTER(WHERE c.done) AS resolved,count(c.id) FILTER(WHERE c.late) AS overdue
 FROM rep_directory r LEFT JOIN cases c ON (r.kind='mla' AND c.assembly_no::text=r.constituency_key) OR (r.kind='mp' AND c.lok_sabha=r.constituency_key)
 GROUP BY r.kind,r.constituency_key,r.constituency,r.name,r.source_url,r.checked_at
 ), trend AS (
 SELECT to_char(date_trunc('month',created_at),'YYYY-MM') AS period,count(*) AS reports,count(*) FILTER(WHERE done) AS resolved FROM cases GROUP BY date_trunc('month',created_at) ORDER BY date_trunc('month',created_at)
 )
 SELECT jsonb_build_object('generated_at',now(),'days',_days,'summary',(SELECT to_jsonb(s) FROM summary s),'groups',coalesce((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.total DESC,g.label) FROM groups g),'[]'::jsonb),'representatives',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.kind,r.constituency) FROM reps r),'[]'::jsonb),'trend',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM trend t),'[]'::jsonb)) INTO result;
 RETURN result;
END $function$;

CREATE OR REPLACE FUNCTION public.public_report_snapshot(_filters jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE result jsonb; start_at timestamptz; end_at timestamptz; mode text:=coalesce(_filters->>'records','canonical');
BEGIN
 start_at:=nullif(_filters->>'start','')::timestamptz; end_at:=nullif(_filters->>'end','')::timestamptz;
 IF start_at IS NOT NULL AND end_at IS NOT NULL AND start_at>=end_at THEN RAISE EXCEPTION 'Start must precede end'; END IF;
 IF mode NOT IN ('canonical','linked','all') THEN RAISE EXCEPTION 'Invalid record scope'; END IF;
 WITH cases AS (
 SELECT i.*,w.identifier ward_key,w.name ward_name,w.corporation ward_corporation,
 i.status IN ('resolved','closed') done,i.status NOT IN ('resolved','closed','rejected') open,
 i.status NOT IN ('resolved','closed','rejected') AND coalesce(i.eta_at,i.sla_due_at)<now() late
 FROM issues i LEFT JOIN civic_wards w ON w.identifier=i.routing_snapshot->'ward'->>'identifier' AND (w.coverage_id=i.routing_snapshot->'coverage'->>'id' OR i.routing_snapshot->'coverage'->>'id' IS NULL)
 WHERE (coalesce((_filters->>'include_demo')::boolean,false) OR i.demo_dataset_id IS NULL)
 AND (start_at IS NULL OR i.created_at>=start_at) AND (end_at IS NULL OR i.created_at<end_at)
 AND (mode='all' OR (mode='canonical' AND i.duplicate_of IS NULL) OR (mode='linked' AND i.duplicate_of IS NOT NULL))
 AND (coalesce(_filters->>'category','')='' OR i.category=_filters->>'category')
 AND (coalesce(_filters->>'status','')='' OR i.status::text=_filters->>'status')
 AND (coalesce(_filters->>'severity','')='' OR i.severity::text=_filters->>'severity')
 AND (coalesce(_filters->>'corporation','')='' OR w.corporation=_filters->>'corporation')
 AND (coalesce(_filters->>'ward','')='' OR w.identifier=_filters->>'ward')
 AND (coalesce(_filters->>'resolution','')='' OR ((_filters->>'resolution'='resolved')=(i.status IN ('resolved','closed'))))
 ), summary AS (
 SELECT count(DISTINCT id) total,count(*) FILTER(WHERE open) active,count(*) FILTER(WHERE done) resolved,count(*) FILTER(WHERE late) overdue,count(*) FILTER(WHERE status='rejected') rejected,count(*) FILTER(WHERE escalated_at IS NOT NULL) escalated,count(*) FILTER(WHERE acknowledged_at IS NOT NULL) acknowledged,count(*) FILTER(WHERE ward_key IS NULL) unmapped,
 round(avg(extract(epoch from(resolved_at-created_at))/86400) FILTER(WHERE done AND resolved_at>=created_at),1) average_resolution_days,
 count(*) FILTER(WHERE open AND acknowledged_at IS NULL) awaiting_acknowledgement,count(*) FILTER(WHERE status='in_progress') in_progress,count(*) FILTER(WHERE status='awaiting_verification') awaiting_verification,
 count(*) FILTER(WHERE status='closed' AND EXISTS(SELECT 1 FROM issue_events e WHERE e.issue_id=cases.id AND e.kind='citizen_confirmed')) citizen_confirmed,
 count(*) FILTER(WHERE status='reopened') reopened,count(*) FILTER(WHERE team_id IS NULL) unassigned,count(*) FILTER(WHERE assignment_state='exception') routing_exceptions,count(*) FILTER(WHERE duplicate_of IS NOT NULL) linked_duplicates,
 round(avg(extract(epoch from(acknowledged_at-created_at))/3600) FILTER(WHERE acknowledged_at>=created_at),1) average_response_hours,
 count(*) FILTER(WHERE acknowledged_at>=created_at) response_samples,count(*) FILTER(WHERE done AND resolved_at>=created_at) resolution_samples FROM cases
 ), groups AS (
 SELECT d.dimension,d.key,d.label,count(*) total,count(*) FILTER(WHERE c.open) active,count(*) FILTER(WHERE c.done) resolved,count(*) FILTER(WHERE c.late) overdue FROM cases c CROSS JOIN LATERAL (VALUES ('category',c.category,c.category),('status',c.status::text,c.status::text),('severity',c.severity::text,c.severity::text),('ward',coalesce(c.ward_key,'unmapped'),coalesce(c.ward_name,'Unmapped / review required')),('corporation',coalesce(c.ward_corporation,'unmapped'),coalesce(c.ward_corporation,'Unmapped / review required'))) d(dimension,key,label) GROUP BY d.dimension,d.key,d.label
 ), trend AS (SELECT to_char(date_trunc('day',created_at AT TIME ZONE 'Asia/Kolkata'),'YYYY-MM-DD') period,count(*) reports,count(*) FILTER(WHERE done) resolved FROM cases GROUP BY 1 ORDER BY 1), matrix AS (SELECT category,status::text,count(*) count FROM cases GROUP BY category,status)
 SELECT jsonb_build_object('generated_at',now(),'days',0,'filters',_filters,'summary',(SELECT to_jsonb(s) FROM summary s),'groups',coalesce((SELECT jsonb_agg(to_jsonb(g) ORDER BY total DESC,label) FROM groups g),'[]'::jsonb),'trend',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY period) FROM trend t),'[]'::jsonb),'matrix',coalesce((SELECT jsonb_agg(to_jsonb(m)) FROM matrix m),'[]'::jsonb),'representatives','[]'::jsonb,'scope','Siddhi recorded service-area reports; not all Bengaluru civic incidents','recurrence_available',false) INTO result;
 RETURN result;
END $function$;

CREATE OR REPLACE FUNCTION public.public_ward_snapshot(_identifier text)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    'representative_status', w.representative_status
  )
  FROM public.civic_wards w
  WHERE w.identifier = _identifier AND w.active
$function$;
