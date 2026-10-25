ALTER TABLE public.issue_notifications DROP CONSTRAINT issue_notifications_audience;
ALTER TABLE public.issue_notifications ADD CONSTRAINT issue_notifications_audience CHECK(audience IN ('citizen','authority','supervisor','staff'));

-- Preserve existing functions while adding dataset isolation to all notification/routing paths.
DO $guard$
DECLARE s text;
BEGIN
 s:=pg_get_functiondef('public.emit_case_notifications(uuid,text,text,text,boolean)'::regprocedure);
 s:=replace(s,'WHERE public.staff_can_work(p.user_id,e.issue_id)','WHERE p.demo_dataset_id IS NOT DISTINCT FROM (SELECT demo_dataset_id FROM public.issues WHERE id=e.issue_id) AND public.staff_can_work(p.user_id,e.issue_id)');
 EXECUTE s;
 s:=pg_get_functiondef('public.route_issue_to_team(uuid)'::regprocedure);
 s:=replace(s,'WHERE active AND','WHERE demo_dataset_id IS NOT DISTINCT FROM v.demo_dataset_id AND active AND');
 EXECUTE s;
 s:=pg_get_functiondef('public.prepare_case_review()'::regprocedure);
 s:=replace(s,'WHERE i.id<>NEW.id','WHERE i.demo_dataset_id IS NOT DISTINCT FROM NEW.demo_dataset_id AND i.id<>NEW.id');
 EXECUTE s;
 s:=pg_get_functiondef('public.escalate_overdue_issues()'::regprocedure);
 s:=replace(s,'WHERE escalated_at','WHERE demo_dataset_id IS NULL AND escalated_at');
 s:=replace(s,'WHERE ack_escalated_at','WHERE demo_dataset_id IS NULL AND ack_escalated_at');
 EXECUTE s;
 s:=pg_get_functiondef('public.process_deadline_reminders()'::regprocedure);
 s:=replace(s,'WHERE i.duplicate_of IS NULL','WHERE i.demo_dataset_id IS NULL AND i.duplicate_of IS NULL');
 EXECUTE s;
 s:=pg_get_functiondef('public.public_case_rows(text)'::regprocedure);
 s:=replace(s,'WHERE _ref IS NULL OR ref_code=_ref','WHERE (_ref IS NULL AND demo_dataset_id IS NULL) OR ref_code=_ref');
 EXECUTE s;
 s:=pg_get_functiondef('public.purge_demo_dataset(text)'::regprocedure);
 s:=replace(s,'DELETE FROM public.issue_feedback', 'LOCK TABLE public.issues IN SHARE ROW EXCLUSIVE MODE; IF EXISTS (SELECT 1 FROM public.issues g WHERE g.demo_dataset_id IS DISTINCT FROM _dataset AND (g.duplicate_of IN (SELECT id FROM public.issues WHERE demo_dataset_id=_dataset) OR g.duplicate_candidate_id IN (SELECT id FROM public.issues WHERE demo_dataset_id=_dataset) OR g.team_id IN (SELECT id FROM public.civic_teams WHERE demo_dataset_id=_dataset) OR g.assigned_to IN (SELECT user_id FROM public.staff_profiles WHERE demo_dataset_id=_dataset))) THEN RAISE EXCEPTION ''Cleanup blocked by records outside this dataset''; END IF; DELETE FROM public.issue_feedback');
 EXECUTE s;
END $guard$;

-- Prevent genuine and synthetic operational relationships being mixed on any write.
CREATE OR REPLACE FUNCTION public.guard_case_dataset() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.team_id IS NOT NULL AND EXISTS(SELECT 1 FROM civic_teams t WHERE t.id=NEW.team_id AND t.demo_dataset_id IS DISTINCT FROM NEW.demo_dataset_id) THEN RAISE EXCEPTION 'Team dataset mismatch'; END IF;
 IF NEW.assigned_to IS NOT NULL AND EXISTS(SELECT 1 FROM staff_profiles p WHERE p.user_id=NEW.assigned_to AND p.demo_dataset_id IS DISTINCT FROM NEW.demo_dataset_id) THEN RAISE EXCEPTION 'Handler dataset mismatch'; END IF;
 IF NEW.duplicate_of IS NOT NULL AND EXISTS(SELECT 1 FROM issues i WHERE i.id=NEW.duplicate_of AND i.demo_dataset_id IS DISTINCT FROM NEW.demo_dataset_id) THEN RAISE EXCEPTION 'Duplicate dataset mismatch'; END IF;
 IF NEW.duplicate_candidate_id IS NOT NULL AND EXISTS(SELECT 1 FROM issues i WHERE i.id=NEW.duplicate_candidate_id AND i.demo_dataset_id IS DISTINCT FROM NEW.demo_dataset_id) THEN RAISE EXCEPTION 'Candidate dataset mismatch'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_case_dataset BEFORE INSERT OR UPDATE ON public.issues FOR EACH ROW EXECUTE FUNCTION public.guard_case_dataset();
REVOKE ALL ON FUNCTION public.guard_case_dataset() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.seed_demo_batch(_dataset text,_issues jsonb,_events jsonb,_notifications jsonb,_feedback jsonb,_secrets jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r jsonb; n int:=0; skipped int:=0; iid uuid;
BEGIN
 IF _dataset !~ '^[a-z0-9-]{3,40}$' OR jsonb_array_length(_issues)>500 THEN RAISE EXCEPTION 'Invalid demo batch'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(_issues) LOOP
  IF r->>'demo_dataset_id' IS DISTINCT FROM _dataset OR r->>'ref_code' NOT LIKE 'DEMO-%' THEN RAISE EXCEPTION 'Synthetic label required'; END IF;
  IF EXISTS(SELECT 1 FROM issues WHERE ref_code=r->>'ref_code' AND demo_dataset_id IS DISTINCT FROM _dataset) THEN RAISE EXCEPTION 'Existing reference belongs to another dataset'; END IF;
  IF EXISTS(SELECT 1 FROM issues WHERE ref_code=r->>'ref_code') THEN skipped:=skipped+1; CONTINUE; END IF;
  iid:=(r->>'id')::uuid;
  INSERT INTO issues(id,ref_code,idempotency_key,title,summary,description,photo_url,category,subcategory,severity,status,lat,lng,landmark,department,assigned_to,team_id,duplicate_of,support_count,sla_due_at,ack_due_at,acknowledged_at,acknowledged_by,resolved_at,escalated_at,created_at,updated_at,routing_snapshot,assignment_state,demo_dataset_id)
  SELECT x.id,x.ref_code,x.idempotency_key,x.title,x.summary,x.description,x.photo_url,x.category,x.subcategory,x.severity,x.status,x.lat,x.lng,x.landmark,x.department,x.assigned_to,x.team_id,x.duplicate_of,x.support_count,x.sla_due_at,x.ack_due_at,x.acknowledged_at,x.acknowledged_by,x.resolved_at,x.escalated_at,x.created_at,x.updated_at,x.routing_snapshot,x.assignment_state,x.demo_dataset_id FROM jsonb_populate_record(NULL::issues,r) x;
  INSERT INTO issue_events(issue_id,kind,from_status,to_status,note,actor_label,created_at,visibility)
  SELECT x.issue_id,x.kind,x.from_status,x.to_status,x.note,x.actor_label,x.created_at,x.visibility FROM jsonb_populate_recordset(NULL::issue_events,_events) x WHERE x.issue_id=iid;
  INSERT INTO issue_notifications(issue_id,recipient_user_id,audience,channel,status,notification_type,title,detail,priority,created_at)
  SELECT x.issue_id,x.recipient_user_id,'staff','in_app','posted',x.notification_type,x.title,x.detail,x.priority,x.created_at FROM jsonb_populate_recordset(NULL::issue_notifications,_notifications) x JOIN staff_profiles p ON p.user_id=x.recipient_user_id AND p.demo_dataset_id=_dataset WHERE x.issue_id=iid;
  INSERT INTO issue_feedback(issue_id,rating,resolution,response_time,comment,status_at_submission,submitted_at)
  SELECT x.issue_id,x.rating,x.resolution,x.response_time,x.comment,x.status_at_submission,x.submitted_at FROM jsonb_populate_recordset(NULL::issue_feedback,_feedback) x WHERE x.issue_id=iid;
  INSERT INTO issue_secrets(issue_id,recovery_token,token_hash,demo_dataset_id)
  SELECT x.issue_id,x.recovery_token,encode(sha256(convert_to(x.recovery_token,'UTF8')),'hex'),_dataset FROM jsonb_populate_recordset(NULL::issue_secrets,_secrets) x WHERE x.issue_id=iid;
  n:=n+1;
 END LOOP;
 RETURN jsonb_build_object('inserted',n,'skipped',skipped);
END $$;
REVOKE ALL ON FUNCTION public.seed_demo_batch(text,jsonb,jsonb,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.seed_demo_batch(text,jsonb,jsonb,jsonb,jsonb,jsonb) TO service_role;
