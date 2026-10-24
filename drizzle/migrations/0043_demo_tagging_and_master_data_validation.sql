-- Demo dataset tagging: synthetic records are always labelled and never counted in public metrics.
ALTER TABLE public.issues ADD COLUMN demo_dataset_id text;
ALTER TABLE public.civic_teams ADD COLUMN demo_dataset_id text;
ALTER TABLE public.staff_profiles ADD COLUMN demo_dataset_id text;
ALTER TABLE public.issue_secrets ADD COLUMN demo_dataset_id text;
CREATE INDEX issues_demo_dataset_idx ON public.issues(demo_dataset_id) WHERE demo_dataset_id IS NOT NULL;
CREATE INDEX civic_teams_demo_dataset_idx ON public.civic_teams(demo_dataset_id) WHERE demo_dataset_id IS NOT NULL;
COMMENT ON COLUMN public.issues.demo_dataset_id IS 'Synthetic demo dataset identifier; NULL for genuine citizen reports. Demo rows are excluded from public metrics.';
COMMENT ON COLUMN public.civic_teams.demo_dataset_id IS 'Synthetic demo dataset identifier; NULL for real operational teams.';
COMMENT ON COLUMN public.staff_profiles.demo_dataset_id IS 'Synthetic demo dataset identifier; NULL for real staff.';

-- Public aggregates must never include synthetic demo records.
CREATE OR REPLACE FUNCTION public.nearby_case_summary(_lat double precision, _lng double precision, _radius_m double precision DEFAULT 2000)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ DECLARE result jsonb; BEGIN IF _lat IS NULL OR _lng IS NULL OR _radius_m IS NULL OR NOT (_lat BETWEEN -90 AND 90) OR NOT (_lng BETWEEN -180 AND 180) OR NOT (_radius_m BETWEEN 100 AND 10000) THEN RAISE EXCEPTION 'Invalid location or radius'; END IF;
SELECT jsonb_build_object('total',count(*),'active',count(*) FILTER(WHERE status::text NOT IN ('resolved','closed','rejected')),'resolved',count(*) FILTER(WHERE status::text IN ('resolved','closed')),'overdue',count(*) FILTER(WHERE status::text NOT IN ('resolved','closed','rejected') AND coalesce(eta_at,sla_due_at)<now()),'critical',count(*) FILTER(WHERE status::text NOT IN ('resolved','closed','rejected') AND severity='critical'),'radius_m',_radius_m) INTO result FROM public.issues WHERE duplicate_of IS NULL AND demo_dataset_id IS NULL AND 6371000*2*asin(least(1.0,sqrt(power(sin(radians(lat-_lat)/2),2)+cos(radians(_lat))*cos(radians(lat))*power(sin(radians(lng-_lng)/2),2))))<=_radius_m; RETURN result; END $function$;

CREATE OR REPLACE FUNCTION public.nearby_issues(_lat double precision, _lng double precision, _radius_m double precision, _category text)
 RETURNS TABLE(id uuid, ref_code text, title text, status issue_status, category text, distance_m double precision, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select * from (
    select i.id, i.ref_code, i.title, i.status, i.category,
      6371000 * 2 * asin(sqrt(power(sin(radians(i.lat-_lat)/2),2) + cos(radians(_lat))*cos(radians(i.lat))*power(sin(radians(i.lng-_lng)/2),2))) as distance_m,
      i.created_at
    from public.issues i
    where i.status not in ('resolved','closed','rejected')
      and i.demo_dataset_id is null
      and (_category is null or i.category = _category)
      and i.lat between _lat - 0.01 and _lat + 0.01
      and i.lng between _lng - 0.01 and _lng + 0.01
  ) s where s.distance_m <= _radius_m order by s.distance_m limit 5
$function$;

CREATE OR REPLACE FUNCTION public.ward_case_counts()
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
    AND demo_dataset_id IS NULL
  GROUP BY 1
$function$;

CREATE OR REPLACE FUNCTION public.public_transparency_metrics(_days integer DEFAULT 0)
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
 WHERE i.duplicate_of IS NULL AND i.demo_dataset_id IS NULL AND (_days=0 OR i.created_at>=now()-make_interval(days=>_days))
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
 WHERE i.demo_dataset_id IS NULL
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

-- Master-data validation: read-only report of configuration problems, admins only.
CREATE OR REPLACE FUNCTION public.admin_validate_master_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE checks jsonb := '[]'::jsonb; n bigint;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator access required'; END IF;

 SELECT count(*) INTO n FROM public.civic_teams t WHERE t.active AND t.demo_dataset_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.staff_profiles s WHERE s.active AND t.id = ANY(s.team_ids));
 checks := checks || jsonb_build_object('check','active_teams_without_staff','severity',CASE WHEN n>0 THEN 'warning' ELSE 'ok' END,'count',n,'detail','Active teams with no active staff member assigned; routed cases will have no handler.');

 SELECT count(*) INTO n FROM public.staff_profiles s WHERE s.active AND s.demo_dataset_id IS NULL AND (array_length(s.categories,1) IS NULL OR s.department IS NULL OR btrim(s.department)='');
 checks := checks || jsonb_build_object('check','staff_without_scope','severity',CASE WHEN n>0 THEN 'error' ELSE 'ok' END,'count',n,'detail','Active staff with no department or no category permissions; they cannot work any queue.');

 SELECT count(*) INTO n FROM public.staff_profiles s WHERE s.active AND s.demo_dataset_id IS NULL AND (s.team_ids IS NULL OR array_length(s.team_ids,1) IS NULL);
 checks := checks || jsonb_build_object('check','staff_without_team','severity',CASE WHEN n>0 THEN 'warning' ELSE 'ok' END,'count',n,'detail','Active staff not assigned to any team.');

 SELECT count(*) INTO n FROM public.civic_department_routes r WHERE r.active AND NOT EXISTS (SELECT 1 FROM public.civic_teams t WHERE t.active AND t.demo_dataset_id IS NULL AND r.category = ANY(t.categories));
 checks := checks || jsonb_build_object('check','routed_categories_without_team','severity',CASE WHEN n>0 THEN 'error' ELSE 'ok' END,'count',n,'detail','Active category routing rules with no active team covering that category; new reports become routing exceptions.');

 SELECT count(*) INTO n FROM public.civic_teams t WHERE t.active AND t.demo_dataset_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.civic_department_routes r WHERE r.active AND r.category = ANY(t.categories));
 checks := checks || jsonb_build_object('check','teams_without_routing_rule','severity',CASE WHEN n>0 THEN 'info' ELSE 'ok' END,'count',n,'detail','Active teams whose categories have no active routing rule; they receive cases only by manual assignment.');

 SELECT count(*) INTO n FROM public.civic_wards w WHERE w.active AND w.verification_status <> 'verified';
 checks := checks || jsonb_build_object('check','wards_not_verified','severity',CASE WHEN n>0 THEN 'warning' ELSE 'ok' END,'count',n,'detail','Active wards whose boundary or details are not marked verified.');

 SELECT count(*) INTO n FROM (SELECT category,severity FROM public.service_targets WHERE active GROUP BY category,severity HAVING count(*)>1) d;
 checks := checks || jsonb_build_object('check','conflicting_service_targets','severity',CASE WHEN n>0 THEN 'error' ELSE 'ok' END,'count',n,'detail','Category+severity pairs with more than one active service target rule.');

 SELECT count(*) INTO n FROM public.service_targets t WHERE t.active AND (t.ack_hours <= 0 OR t.resolve_hours <= 0 OR t.reminder_hours < 0 OR t.reminder_hours > t.ack_hours);
 checks := checks || jsonb_build_object('check','invalid_service_target_values','severity',CASE WHEN n>0 THEN 'error' ELSE 'ok' END,'count',n,'detail','Active targets with non-positive deadlines or a reminder later than the acknowledgement deadline.');

 SELECT count(*) INTO n FROM public.issues i WHERE i.demo_dataset_id IS NULL AND i.team_id IS NOT NULL AND i.status NOT IN ('resolved','closed','rejected') AND NOT EXISTS (SELECT 1 FROM public.civic_teams t WHERE t.id = i.team_id AND t.active);
 checks := checks || jsonb_build_object('check','open_cases_on_inactive_teams','severity',CASE WHEN n>0 THEN 'warning' ELSE 'ok' END,'count',n,'detail','Open genuine cases assigned to a team that is now inactive or removed.');

 SELECT count(*) INTO n FROM public.user_roles ur LEFT JOIN public.staff_profiles s ON s.user_id = ur.user_id WHERE ur.role IN ('staff','supervisor','field_worker') AND s.user_id IS NULL;
 checks := checks || jsonb_build_object('check','operational_roles_without_profile','severity',CASE WHEN n>0 THEN 'error' ELSE 'ok' END,'count',n,'detail','Accounts with an operational role but no staff profile; they cannot be scoped or assigned.');

 SELECT count(*) INTO n FROM public.civic_teams t WHERE t.active AND t.supervisor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.staff_profiles s WHERE s.user_id = t.supervisor_id AND s.active);
 checks := checks || jsonb_build_object('check','teams_with_missing_supervisor','severity',CASE WHEN n>0 THEN 'warning' ELSE 'ok' END,'count',n,'detail','Active teams whose supervisor account is missing or suspended.');

 SELECT count(*) INTO n FROM public.civic_coverage c WHERE c.enabled AND NOT EXISTS (SELECT 1 FROM public.civic_wards w WHERE w.coverage_id = c.id AND w.active);
 checks := checks || jsonb_build_object('check','coverage_without_wards','severity',CASE WHEN n>0 THEN 'error' ELSE 'ok' END,'count',n,'detail','Enabled service areas with no active wards; location validation cannot work there.');

 RETURN jsonb_build_object('generated_at',now(),'checks',checks);
END $function$;

-- Demo purge: removes only rows labelled with the given demo dataset id. Admins only.
CREATE OR REPLACE FUNCTION public.purge_demo_dataset(_dataset text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE n_issues bigint; n_teams bigint; n_profiles bigint; n_secrets bigint;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 IF _dataset IS NULL OR btrim(_dataset) = '' THEN RAISE EXCEPTION 'A demo dataset id is required'; END IF;

 DELETE FROM public.issue_feedback f USING public.issues i WHERE f.issue_id = i.id AND i.demo_dataset_id = _dataset;
 DELETE FROM public.issue_evidence ev USING public.issues i WHERE ev.issue_id = i.id AND i.demo_dataset_id = _dataset;
 DELETE FROM public.issue_notifications nt USING public.issues i WHERE nt.issue_id = i.id AND i.demo_dataset_id = _dataset;
 DELETE FROM public.issue_photos p USING public.issues i WHERE p.issue_id = i.id AND i.demo_dataset_id = _dataset;
 DELETE FROM public.issue_events e USING public.issues i WHERE e.issue_id = i.id AND i.demo_dataset_id = _dataset;
 DELETE FROM public.issue_assignments a USING public.issues i WHERE a.issue_id = i.id AND i.demo_dataset_id = _dataset;
 DELETE FROM public.issue_duplicate_reviews d USING public.issues i WHERE (d.report_id = i.id OR d.candidate_id = i.id) AND i.demo_dataset_id = _dataset;
 DELETE FROM public.issue_ownership_reviews o USING public.issues i WHERE o.issue_id = i.id AND i.demo_dataset_id = _dataset;
 UPDATE public.issues SET duplicate_of = NULL, duplicate_candidate_id = NULL WHERE demo_dataset_id = _dataset;
 DELETE FROM public.issue_secrets s WHERE s.demo_dataset_id = _dataset; GET DIAGNOSTICS n_secrets = ROW_COUNT;
 DELETE FROM public.issues i WHERE i.demo_dataset_id = _dataset; GET DIAGNOSTICS n_issues = ROW_COUNT;
 DELETE FROM public.staff_profiles s WHERE s.demo_dataset_id = _dataset; GET DIAGNOSTICS n_profiles = ROW_COUNT;
 DELETE FROM public.civic_teams t WHERE t.demo_dataset_id = _dataset; GET DIAGNOSTICS n_teams = ROW_COUNT;
 RETURN jsonb_build_object('dataset',_dataset,'issues',n_issues,'teams',n_teams,'profiles',n_profiles,'secrets',n_secrets,'purged_at',now());
END $function$;
