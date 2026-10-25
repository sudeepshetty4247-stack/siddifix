CREATE OR REPLACE FUNCTION public.civic_case_metrics() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE result jsonb; BEGIN
 IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Active portal access required'; END IF;
 WITH scoped AS MATERIALIZED (
   SELECT i.id, i.status, i.category, i.duplicate_of, i.sla_due_at, i.eta_at, i.acknowledged_at, i.resolved_at, i.created_at, i.assigned_to, i.team_id, i.assignment_state, i.duplicate_candidate_id, i.department
   FROM public.issues i WHERE public.staff_can_work(auth.uid(), i.id)
 )
 SELECT jsonb_build_object(
   'total_reports', (SELECT count(*) FROM scoped),
   'canonical_issues', (SELECT count(*) FROM scoped WHERE duplicate_of IS NULL),
   'pending', (SELECT count(*) FROM scoped WHERE duplicate_of IS NULL AND status::text NOT IN ('resolved','closed','rejected')),
   'resolved', (SELECT count(*) FROM scoped WHERE duplicate_of IS NULL AND status::text IN ('resolved','closed')),
   'citizen_confirmed', (SELECT count(*) FROM scoped s WHERE s.duplicate_of IS NULL AND EXISTS (SELECT 1 FROM public.issue_events e WHERE e.issue_id = s.id AND e.kind = 'citizen_confirmed')),
   'overdue', (SELECT count(*) FROM scoped WHERE duplicate_of IS NULL AND status::text NOT IN ('resolved','closed','rejected') AND (sla_due_at < now() OR eta_at < now())),
   'awaiting_ack', (SELECT count(*) FROM scoped WHERE duplicate_of IS NULL AND acknowledged_at IS NULL AND status::text NOT IN ('resolved','closed','rejected')),
   'assigned_to_me', (SELECT count(*) FROM scoped WHERE assigned_to = auth.uid() AND status::text NOT IN ('resolved','closed','rejected')),
   'in_progress', (SELECT count(*) FROM scoped WHERE duplicate_of IS NULL AND status = 'in_progress'),
   'awaiting_review', (SELECT count(*) FROM scoped WHERE duplicate_of IS NULL AND status = 'awaiting_verification'),
   'unassigned', (SELECT count(*) FROM scoped WHERE duplicate_of IS NULL AND team_id IS NULL AND status::text NOT IN ('resolved','closed','rejected')),
   'routing_exceptions', (SELECT count(*) FROM scoped WHERE assignment_state = 'routing_exception' AND status::text NOT IN ('resolved','closed','rejected')),
   'duplicate_reviews', (SELECT count(*) FROM scoped WHERE duplicate_candidate_id IS NOT NULL),
   'reopened', (SELECT count(*) FROM scoped WHERE duplicate_of IS NULL AND status = 'reopened'),
   'average_ack_hours', (SELECT avg(extract(epoch FROM acknowledged_at - created_at) / 3600) FROM scoped WHERE acknowledged_at IS NOT NULL),
   'average_resolution_hours', (SELECT avg(extract(epoch FROM resolved_at - created_at) / 3600) FROM scoped WHERE duplicate_of IS NULL AND resolved_at IS NOT NULL),
   'duplicate_rate', (SELECT CASE WHEN count(*) = 0 THEN 0 ELSE round(100.0 * count(*) FILTER (WHERE duplicate_of IS NOT NULL) / count(*), 2) END FROM scoped),
   'resolution_rate', (SELECT CASE WHEN count(*) FILTER (WHERE duplicate_of IS NULL) = 0 THEN 0 ELSE round(100.0 * count(*) FILTER (WHERE duplicate_of IS NULL AND status::text IN ('resolved','closed')) / count(*) FILTER (WHERE duplicate_of IS NULL), 2) END FROM scoped),
   'status_distribution', (SELECT coalesce(jsonb_object_agg(status, n), '{}'::jsonb) FROM (SELECT status, count(*) n FROM scoped WHERE duplicate_of IS NULL GROUP BY status) s),
   'category_distribution', (SELECT coalesce(jsonb_object_agg(category, n), '{}'::jsonb) FROM (SELECT category, count(*) n FROM scoped WHERE duplicate_of IS NULL GROUP BY category) s),
   'department_workload', (SELECT coalesce(jsonb_object_agg(department, n), '{}'::jsonb) FROM (SELECT coalesce(t.department, s.department, 'Routing required') AS department, count(*) n FROM scoped s LEFT JOIN public.civic_teams t ON t.id = s.team_id WHERE s.duplicate_of IS NULL AND s.status::text NOT IN ('resolved','closed','rejected') GROUP BY 1) d),
   'notification_failures', (SELECT count(*) FROM public.issue_notifications n WHERE n.status = 'failed' AND n.issue_id IN (SELECT id FROM scoped))
 ) INTO result;
 RETURN result;
END $$;