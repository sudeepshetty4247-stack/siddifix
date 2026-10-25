CREATE OR REPLACE FUNCTION public.civic_case_metrics() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE result jsonb; BEGIN
 IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Active portal access required'; END IF;
 WITH scoped AS MATERIALIZED (
   SELECT i.id, i.status, i.category, i.duplicate_of, i.sla_due_at, i.eta_at, i.acknowledged_at, i.resolved_at, i.created_at, i.assigned_to, i.team_id, i.assignment_state, i.duplicate_candidate_id, i.department
   FROM public.issues i WHERE public.staff_can_work(auth.uid(), i.id)
 )
 SELECT jsonb_build_object(
   'total_reports', count(*),
   'canonical_issues', count(*) FILTER (WHERE duplicate_of IS NULL),
   'pending', count(*) FILTER (WHERE duplicate_of IS NULL AND status::text NOT IN ('resolved','closed','rejected')),
   'resolved', count(*) FILTER (WHERE duplicate_of IS NULL AND status::text IN ('resolved','closed')),
   'citizen_confirmed', count(*) FILTER (WHERE duplicate_of IS NULL AND EXISTS (SELECT 1 FROM public.issue_events e WHERE e.issue_id = scoped.id AND e.kind = 'citizen_confirmed')),
   'overdue', count(*) FILTER (WHERE duplicate_of IS NULL AND status::text NOT IN ('resolved','closed','rejected') AND (sla_due_at < now() OR eta_at < now())),
   'awaiting_ack', count(*) FILTER (WHERE duplicate_of IS NULL AND acknowledged_at IS NULL AND status::text NOT IN ('resolved','closed','rejected')),
   'assigned_to_me', count(*) FILTER (WHERE assigned_to = auth.uid() AND status::text NOT IN ('resolved','closed','rejected')),
   'in_progress', count(*) FILTER (WHERE duplicate_of IS NULL AND status = 'in_progress'),
   'awaiting_review', count(*) FILTER (WHERE duplicate_of IS NULL AND status = 'awaiting_verification'),
   'unassigned', count(*) FILTER (WHERE duplicate_of IS NULL AND team_id IS NULL AND status::text NOT IN ('resolved','closed','rejected')),
   'routing_exceptions', count(*) FILTER (WHERE assignment_state = 'routing_exception' AND status::text NOT IN ('resolved','closed','rejected')),
   'duplicate_reviews', count(*) FILTER (WHERE duplicate_candidate_id IS NOT NULL),
   'reopened', count(*) FILTER (WHERE duplicate_of IS NULL AND status = 'reopened'),
   'average_ack_hours', avg(extract(epoch FROM acknowledged_at - created_at) / 3600) FILTER (WHERE acknowledged_at IS NOT NULL),
   'average_resolution_hours', avg(extract(epoch FROM resolved_at - created_at) / 3600) FILTER (WHERE duplicate_of IS NULL AND resolved_at IS NOT NULL),
   'duplicate_rate', CASE WHEN count(*) = 0 THEN 0 ELSE round(100.0 * count(*) FILTER (WHERE duplicate_of IS NOT NULL) / count(*), 2) END,
   'resolution_rate', CASE WHEN count(*) FILTER (WHERE duplicate_of IS NULL) = 0 THEN 0 ELSE round(100.0 * count(*) FILTER (WHERE duplicate_of IS NULL AND status::text IN ('resolved','closed')) / count(*) FILTER (WHERE duplicate_of IS NULL), 2) END
 ) INTO result FROM scoped;
 RETURN result || jsonb_build_object(
   'status_distribution', (SELECT coalesce(jsonb_object_agg(status, n), '{}'::jsonb) FROM (SELECT status, count(*) n FROM public.issues i WHERE i.duplicate_of IS NULL AND i.id IN (SELECT id FROM scoped_ids()) GROUP BY status) s),
   'category_distribution', '{}'::jsonb
 );
END $$;