
-- 1. Staff notes go through a guarded, team-scoped function instead of direct browser inserts.
CREATE OR REPLACE FUNCTION public.staff_add_note(_issue uuid, _note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.staff_can_work(auth.uid(), _issue) THEN
    RAISE EXCEPTION 'You do not have access to this case.';
  END IF;
  IF char_length(trim(_note)) < 2 OR char_length(_note) > 1000 THEN
    RAISE EXCEPTION 'Note must be between 2 and 1000 characters.';
  END IF;
  INSERT INTO public.issue_events (issue_id, kind, note, actor_id, actor_label)
  VALUES (_issue, 'note', trim(_note), auth.uid(), public.staff_actor_label(auth.uid()));
END;
$$;
REVOKE ALL ON FUNCTION public.staff_add_note(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_add_note(uuid, text) TO authenticated;

-- 2. Cases: staff may read, but all writes must go through the guarded functions
-- (expected-status concurrency checks, completion-evidence requirement, team scope).
-- Direct UPDATE/DELETE would bypass every one of those protections.
REVOKE INSERT, UPDATE, DELETE ON public.issues FROM anon;
REVOKE UPDATE, DELETE ON public.issues FROM authenticated;
DROP POLICY IF EXISTS "staff update issues" ON public.issues;

-- 3. History and evidence records are written only by guarded functions and triggers.
REVOKE INSERT, UPDATE, DELETE ON public.issue_events FROM anon, authenticated;
DROP POLICY IF EXISTS "staff insert events" ON public.issue_events;
REVOKE INSERT, UPDATE, DELETE ON public.issue_photos FROM anon, authenticated;

-- 4. Administrative and internal functions must not be callable by anonymous visitors.
REVOKE EXECUTE ON FUNCTION public.admin_upsert_team(uuid, text, text, text[], text[], uuid, text, text, boolean, boolean, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.route_issue_to_team(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.staff_assign_team(uuid, uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_supervisor(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.staff_can_work(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.staff_actor_label(uuid) FROM anon, PUBLIC;

-- 5. Trigger functions are fired by the database, never called directly.
REVOKE EXECUTE ON FUNCTION public.attach_report_photo() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.audit_civic_directory() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finish_ownership_review() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_first_admin() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prepare_case_review() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_issue_notification() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.require_completion_evidence() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_evidence_object() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.hash_reporter_token() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated, PUBLIC;
