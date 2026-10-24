CREATE OR REPLACE FUNCTION public.public_report_snapshot(_filters jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
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
 WHERE (start_at IS NULL OR i.created_at>=start_at) AND (end_at IS NULL OR i.created_at<end_at)
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
 SELECT jsonb_build_object('generated_at',now(),'days',0,'filters',_filters,'summary',(SELECT to_jsonb(s) FROM summary s),'groups',coalesce((SELECT jsonb_agg(to_jsonb(g) ORDER BY total DESC,label) FROM groups g),'[]'::jsonb),'trend',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY period) FROM trend t),'[]'::jsonb),'matrix',coalesce((SELECT jsonb_agg(to_jsonb(m)) FROM matrix m),'[]'::jsonb),'representatives','[]'::jsonb,'scope','Siddi recorded service-area reports; not all Bengaluru civic incidents','recurrence_available',false) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.public_report_snapshot(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_report_snapshot(jsonb) TO anon,authenticated,service_role;
COMMENT ON FUNCTION public.public_report_snapshot(jsonb) IS 'Aggregate-only filtered snapshot; no case identifiers, coordinates, notes, tokens or staff contacts. Daily cohort trends in IST. No row limit.';