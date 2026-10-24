CREATE TABLE public.service_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  severity public.issue_severity NOT NULL,
  ack_hours integer NOT NULL CHECK (ack_hours BETWEEN 1 AND 2160),
  resolve_hours integer NOT NULL CHECK (resolve_hours BETWEEN 1 AND 8760),
  version integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  effective_from timestamptz NOT NULL DEFAULT now(),
  notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (category, severity)
);
GRANT SELECT ON public.service_targets TO authenticated;
GRANT ALL ON public.service_targets TO service_role;
ALTER TABLE public.service_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read service targets" ON public.service_targets FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS ack_due_at timestamptz;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS target_snapshot jsonb;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS ack_escalated_at timestamptz;

CREATE OR REPLACE FUNCTION public.admin_upsert_service_target(_category text, _severity public.issue_severity, _ack_hours integer, _resolve_hours integer, _active boolean, _notes text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_old jsonb; v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Only administrators can configure service targets'; END IF;
  IF _category NOT IN ('roads','electricity','water','drainage','waste','transport','parks','sanitation','trees','buildings','other') THEN RAISE EXCEPTION 'Unknown category'; END IF;
  IF _ack_hours < 1 OR _resolve_hours < _ack_hours OR _resolve_hours > 8760 THEN RAISE EXCEPTION 'Resolution target must be at least the acknowledgement target'; END IF;
  SELECT to_jsonb(t), t.id INTO v_old, v_id FROM service_targets t WHERE category=_category AND severity=_severity;
  INSERT INTO service_targets(category,severity,ack_hours,resolve_hours,active,notes,updated_by)
  VALUES(_category,_severity,_ack_hours,_resolve_hours,_active,left(coalesce(_notes,''),500),auth.uid())
  ON CONFLICT (category,severity) DO UPDATE SET ack_hours=EXCLUDED.ack_hours,resolve_hours=EXCLUDED.resolve_hours,active=EXCLUDED.active,notes=EXCLUDED.notes,
    version=service_targets.version+1,effective_from=now(),updated_at=now(),updated_by=auth.uid()
  RETURNING id INTO v_id;
  INSERT INTO civic_directory_audit(table_name,record_id,action,old_row,new_row,actor_id)
  SELECT 'service_targets',v_id,CASE WHEN v_old IS NULL THEN 'insert' ELSE 'update' END,v_old,to_jsonb(t),auth.uid() FROM service_targets t WHERE t.id=v_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_upsert_service_target(text,public.issue_severity,integer,integer,boolean,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_upsert_service_target(text,public.issue_severity,integer,integer,boolean,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.escalate_overdue_issues()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_count integer := 0; v_ack integer := 0;
BEGIN
  WITH due AS (
    SELECT id FROM public.issues
    WHERE escalated_at IS NULL AND duplicate_of IS NULL
      AND coalesce(eta_at, sla_due_at) IS NOT NULL AND coalesce(eta_at, sla_due_at) < now()
      AND status::text IN ('needs_classification','submitted','under_review','assigned','accepted','inspection_scheduled','in_progress','awaiting_verification','reopened')
    FOR UPDATE SKIP LOCKED
  ), upd AS (
    UPDATE public.issues i SET escalated_at = now() FROM due WHERE i.id = due.id
    RETURNING i.id, (i.eta_at IS NOT NULL) AS by_eta
  ), ev AS (
    INSERT INTO public.issue_events (issue_id, kind, note, actor_label)
    SELECT id, 'escalated', CASE WHEN by_eta THEN 'Automatically escalated: the promised completion date has passed.' ELSE 'Automatically escalated: the Siddi resolution target for this category and severity has passed.' END || ' Internal Siddi target, not an official government deadline.', 'Siddi escalation' FROM upd RETURNING issue_id
  ), nt AS (
    INSERT INTO public.issue_notifications (issue_id, audience, channel, status, detail, attempts)
    SELECT id, 'supervisor', 'in_app', 'posted', 'Case automatically escalated because its resolution target passed.', 1 FROM upd RETURNING issue_id
  ) SELECT count(*) INTO v_count FROM upd;

  WITH due AS (
    SELECT id FROM public.issues
    WHERE ack_escalated_at IS NULL AND acknowledged_at IS NULL AND duplicate_of IS NULL
      AND ack_due_at IS NOT NULL AND ack_due_at < now()
      AND status::text IN ('needs_classification','submitted','under_review','assigned','reopened')
    FOR UPDATE SKIP LOCKED
  ), upd AS (
    UPDATE public.issues i SET ack_escalated_at = now() FROM due WHERE i.id = due.id RETURNING i.id
  ), ev AS (
    INSERT INTO public.issue_events (issue_id, kind, note, actor_label)
    SELECT id, 'ack_overdue', 'Acknowledgement target passed without a staff response. Supervisor follow-up required. Internal Siddi target.', 'Siddi escalation' FROM upd RETURNING issue_id
  ), nt AS (
    INSERT INTO public.issue_notifications (issue_id, audience, channel, status, detail, attempts)
    SELECT id, 'supervisor', 'in_app', 'posted', 'Acknowledgement target passed.', 1 FROM upd RETURNING issue_id
  ) SELECT count(*) INTO v_ack FROM upd;
  RETURN v_count + v_ack;
END $function$;

INSERT INTO public.service_targets(category,severity,ack_hours,resolve_hours,notes)
SELECT c, s::public.issue_severity,
  CASE s WHEN 'critical' THEN 4 WHEN 'high' THEN 12 WHEN 'medium' THEN 48 ELSE 72 END,
  CASE s WHEN 'critical' THEN 24 WHEN 'high' THEN 72 WHEN 'medium' THEN 168 ELSE 336 END,
  'Initial internal Siddi default; not an official government commitment.'
FROM unnest(ARRAY['roads','electricity','water','drainage','waste','transport','parks','sanitation','trees','buildings','other']) c
CROSS JOIN unnest(ARRAY['low','medium','high','critical']) s
ON CONFLICT DO NOTHING;