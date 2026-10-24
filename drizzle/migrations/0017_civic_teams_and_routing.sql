CREATE TABLE public.civic_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department text not null,
  categories text[] not null default '{}',
  wards text[] not null default '{}',
  supervisor_id uuid,
  contact_label text,
  contact_phone text,
  is_fallback boolean not null default false,
  active boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
GRANT SELECT ON public.civic_teams TO authenticated;
GRANT ALL ON public.civic_teams TO service_role;
ALTER TABLE public.civic_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read teams" ON public.civic_teams FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

ALTER TABLE public.issues ADD COLUMN team_id uuid;
CREATE INDEX issues_team_id_idx ON public.issues(team_id);

CREATE OR REPLACE FUNCTION public.admin_upsert_team(
  _id uuid, _name text, _department text, _categories text[], _wards text[],
  _supervisor uuid, _contact_label text, _contact_phone text, _fallback boolean, _active boolean, _notes text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_old jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only admins can configure teams'; END IF;
  IF _id IS NULL THEN
    INSERT INTO civic_teams(name, department, categories, wards, supervisor_id, contact_label, contact_phone, is_fallback, active, notes, updated_by)
    VALUES (_name, _department, _categories, _wards, _supervisor, _contact_label, _contact_phone, _fallback, _active, _notes, auth.uid())
    RETURNING id INTO v_id;
    INSERT INTO civic_directory_audit(table_name, record_id, action, old_row, new_row, actor_id)
    SELECT 'civic_teams', v_id, 'insert', NULL, to_jsonb(t), auth.uid() FROM civic_teams t WHERE t.id = v_id;
  ELSE
    SELECT to_jsonb(t) INTO v_old FROM civic_teams t WHERE t.id = _id;
    IF v_old IS NULL THEN RAISE EXCEPTION 'Team not found'; END IF;
    UPDATE civic_teams SET name=_name, department=_department, categories=_categories, wards=_wards, supervisor_id=_supervisor,
      contact_label=_contact_label, contact_phone=_contact_phone, is_fallback=_fallback, active=_active, notes=_notes,
      updated_at=now(), updated_by=auth.uid() WHERE id=_id;
    v_id := _id;
    INSERT INTO civic_directory_audit(table_name, record_id, action, old_row, new_row, actor_id)
    SELECT 'civic_teams', v_id, 'update', v_old, to_jsonb(t), auth.uid() FROM civic_teams t WHERE t.id = v_id;
  END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.route_issue_to_team(_issue uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.issues%ROWTYPE; v_ward text; v_team uuid; v_team_name text;
BEGIN
  SELECT * INTO v FROM public.issues WHERE id = _issue;
  IF NOT FOUND THEN RAISE EXCEPTION 'Issue not found'; END IF;
  IF v.team_id IS NOT NULL THEN RETURN 'already_routed'; END IF;
  IF v.status = 'needs_classification' THEN
    UPDATE public.issues SET assignment_state = 'routing_exception', updated_at = now() WHERE id = _issue;
    INSERT INTO public.issue_events(issue_id, kind, note, actor_label) VALUES (_issue, 'routing', 'Category needs staff classification before a team can be chosen; placed in the routing-exception queue.', 'CivicFix routing');
    RETURN 'needs_classification';
  END IF;
  v_ward := v.routing_snapshot->'ward'->>'identifier';
  SELECT id, name INTO v_team, v_team_name FROM public.civic_teams
    WHERE active AND NOT is_fallback AND v.category = ANY(categories) AND (cardinality(wards) = 0 OR v_ward = ANY(wards))
    ORDER BY created_at LIMIT 1;
  IF v_team IS NULL THEN
    SELECT id, name INTO v_team, v_team_name FROM public.civic_teams
      WHERE active AND is_fallback AND (cardinality(categories) = 0 OR v.category = ANY(categories))
      ORDER BY created_at LIMIT 1;
  END IF;
  IF v_team IS NULL THEN
    UPDATE public.issues SET assignment_state = 'routing_exception', updated_at = now() WHERE id = _issue;
    INSERT INTO public.issue_events(issue_id, kind, note, actor_label) VALUES (_issue, 'routing', 'No active team matches this category and ward; placed in the routing-exception queue for supervisor review.', 'CivicFix routing');
    RETURN 'exception';
  END IF;
  UPDATE public.issues SET team_id = v_team, assignment_state = 'assigned', updated_at = now() WHERE id = _issue;
  INSERT INTO public.issue_events(issue_id, kind, note, actor_label) VALUES (_issue, 'routing', 'Routed to team: ' || v_team_name || '.', 'CivicFix routing');
  RETURN 'assigned';
END $$;

CREATE OR REPLACE FUNCTION public.staff_assign_team(_issue uuid, _team uuid, _reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text;
BEGIN
  IF NOT (public.is_supervisor(auth.uid()) OR public.has_role(auth.uid(), 'admin')) THEN RAISE EXCEPTION 'Only supervisors or admins can assign teams'; END IF;
  IF length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'A reason is required for assignment'; END IF;
  SELECT name INTO v_name FROM public.civic_teams WHERE id = _team AND active;
  IF v_name IS NULL THEN RAISE EXCEPTION 'Team not found or inactive'; END IF;
  UPDATE public.issues SET team_id = _team, assignment_state = 'assigned', updated_at = now() WHERE id = _issue;
  IF NOT FOUND THEN RAISE EXCEPTION 'Issue not found'; END IF;
  INSERT INTO public.issue_events(issue_id, kind, note, actor_id, actor_label)
  VALUES (_issue, 'assignment', 'Assigned to team: ' || v_name || '. Reason: ' || _reason, auth.uid(), public.staff_actor_label(auth.uid()));
END $$;