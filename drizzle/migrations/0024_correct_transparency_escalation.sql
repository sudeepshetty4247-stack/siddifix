CREATE OR REPLACE FUNCTION public.public_transparency_metrics(_days integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF _days NOT IN (0,7,30,90,365) THEN RAISE EXCEPTION 'Unsupported reporting period'; END IF;
 WITH cases AS (
 SELECT i.*, w.identifier AS ward_key,w.name AS ward_name,w.corporation AS ward_corporation,w.assembly_no,w.assembly,w.lok_sabha,
 i.status IN ('resolved','closed') AS done,
 i.status NOT IN ('resolved','closed','rejected') AS open,
 i.status NOT IN ('resolved','closed','rejected') AND coalesce(i.eta_at,i.sla_due_at)<now() AS late
 FROM public.issues i LEFT JOIN public.civic_wards w ON w.identifier=i.routing_snapshot->'ward'->>'identifier'
 WHERE i.duplicate_of IS NULL AND (_days=0 OR i.created_at>=now()-make_interval(days=>_days))
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
END $$;
REVOKE ALL ON FUNCTION public.public_transparency_metrics(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_transparency_metrics(integer) TO anon,authenticated,service_role;
COMMENT ON FUNCTION public.public_transparency_metrics(integer) IS 'Aggregate-only Siddi canonical cases, mapped through submission-time wards. Not government performance statistics. No reporter identifiers or private evidence.';