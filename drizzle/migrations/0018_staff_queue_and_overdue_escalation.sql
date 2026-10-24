
-- Backend-enforced, team-scoped staff issue queue.
-- Field workers only receive cases inside their staff_profiles category/ward scope;
-- supervisors, staff and admins receive everything. All filtering happens in the database.
CREATE OR REPLACE FUNCTION public.staff_queue_issues(
  _category text DEFAULT NULL,
  _status text DEFAULT NULL,
  _severity text DEFAULT NULL,
  _ward text DEFAULT NULL,
  _team uuid DEFAULT NULL,
  _ack text DEFAULT NULL,
  _overdue boolean DEFAULT NULL,
  _search text DEFAULT NULL,
  _limit integer DEFAULT 500
)
RETURNS TABLE(
  id uuid, ref_code text, title text, category text, severity issue_severity,
  status issue_status, sla_due_at timestamptz, eta_at timestamptz,
  acknowledged_at timestamptz, escalated_at timestamptz, created_at timestamptz,
  landmark text, department text, support_count integer, photo_url text,
  authority_id uuid, assignment_state text, duplicate_of uuid,
  duplicate_candidate_id uuid, team_id uuid, team_name text, ward_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.ref_code, i.title, i.category, i.severity, i.status,
         i.sla_due_at, i.eta_at, i.acknowledged_at, i.escalated_at, i.created_at,
         i.landmark, i.department, i.support_count, i.photo_url,
         i.authority_id, i.assignment_state, i.duplicate_of,
         i.duplicate_candidate_id, i.team_id, t.name, i.routing_snapshot->'ward'->>'name'
  FROM public.issues i
  LEFT JOIN public.civic_teams t ON t.id = i.team_id
  LEFT JOIN public.staff_profiles p ON p.user_id = auth.uid()
  WHERE public.is_staff(auth.uid())
    AND (
      public.is_supervisor(auth.uid())
      OR (
        (p.user_id IS NULL OR cardinality(p.categories) = 0 OR i.category = ANY(p.categories))
        AND (p.user_id IS NULL OR cardinality(p.wards) = 0 OR (i.routing_snapshot->'ward'->>'identifier') = ANY(p.wards))
      )
    )
    AND (_category IS NULL OR i.category = _category)
    AND (_status IS NULL OR i.status::text = _status)
    AND (_severity IS NULL OR i.severity::text = _severity)
    AND (_ward IS NULL OR (i.routing_snapshot->'ward'->>'identifier') = _ward)
    AND (_team IS NULL OR i.team_id = _team)
    AND (_ack IS NULL OR (_ack = 'acknowledged' AND i.acknowledged_at IS NOT NULL) OR (_ack = 'unacknowledged' AND i.acknowledged_at IS NULL))
    AND (_overdue IS NULL OR (_overdue AND i.sla_due_at IS NOT NULL AND i.sla_due_at < now() AND i.status::text IN ('needs_classification','submitted','under_review','assigned','accepted','inspection_scheduled','in_progress','awaiting_verification','reopened')))
    AND (_search IS NULL OR (i.title || ' ' || i.ref_code || ' ' || coalesce(i.landmark,'')) ILIKE '%' || _search || '%')
  ORDER BY i.created_at DESC
  LIMIT LEAST(GREATEST(_limit, 1), 1000);
$$;

REVOKE ALL ON FUNCTION public.staff_queue_issues(text, text, text, text, uuid, text, boolean, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_queue_issues(text, text, text, text, uuid, text, boolean, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_queue_issues(text, text, text, text, uuid, text, boolean, text, integer) TO service_role;

-- Automatic overdue escalation, safe to run repeatedly: a case is escalated exactly once
-- (guarded by escalated_at IS NULL), and each run records an audited event plus an
-- in-app notification for supervisors. CivicFix follow-up targets only — never
-- represented as official government deadlines.
CREATE OR REPLACE FUNCTION public.escalate_overdue_issues()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer := 0;
BEGIN
  WITH due AS (
    SELECT id, ref_code
    FROM public.issues
    WHERE escalated_at IS NULL
      AND eta_at IS NOT NULL
      AND eta_at < now()
      AND status::text IN ('needs_classification','submitted','under_review','assigned','accepted','inspection_scheduled','in_progress','awaiting_verification','reopened')
  ), upd AS (
    UPDATE public.issues i
    SET escalated_at = now(), updated_at = now()
    FROM due WHERE i.id = due.id
    RETURNING i.id, i.ref_code
  ), ev AS (
    INSERT INTO public.issue_events (issue_id, kind, note, actor_label)
    SELECT id, 'escalated', 'Automatically escalated: the promised completion date has passed. This is a CivicFix follow-up target, not an official government deadline.', 'CivicFix escalation'
    FROM upd
    RETURNING issue_id
  ), nt AS (
    INSERT INTO public.issue_notifications (issue_id, audience, channel, status, detail, attempts)
    SELECT id, 'supervisor', 'in_app', 'posted', 'Case automatically escalated because its promised completion date passed.', 1
    FROM upd
    RETURNING issue_id
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.escalate_overdue_issues() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.escalate_overdue_issues() TO service_role;
