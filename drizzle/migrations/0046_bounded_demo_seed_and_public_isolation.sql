DO $fix$ DECLARE s text; BEGIN
 s:=pg_get_functiondef('public.public_case_rows(text)'::regprocedure);
 s:=replace(s,'WHERE _ref IS NULL OR i.ref_code=_ref','WHERE (_ref IS NULL AND i.demo_dataset_id IS NULL) OR i.ref_code=_ref'); EXECUTE s;
 s:=pg_get_functiondef('public.staff_can_work(uuid,uuid)'::regprocedure);
 s:=replace(s,'WHERE i.id=_issue AND p.active','WHERE i.id=_issue AND p.demo_dataset_id IS NOT DISTINCT FROM i.demo_dataset_id AND p.active'); EXECUTE s;
 s:=pg_get_functiondef('public.staff_configuration_valid(uuid)'::regprocedure);
 s:=replace(s,'t ON t.active','t ON t.demo_dataset_id IS NOT DISTINCT FROM p.demo_dataset_id AND t.active'); EXECUTE s;
 s:=pg_get_functiondef('public.prepare_case_review()'::regprocedure);
 s:=replace(s,'BEGIN IF TG_OP', 'BEGIN IF NEW.demo_dataset_id IS NOT NULL THEN INSERT INTO public.issue_ownership_reviews(issue_id) VALUES(NEW.id); RETURN NEW; END IF; IF TG_OP'); EXECUTE s;
 s:=pg_get_functiondef('public.record_issue_notification()'::regprocedure);
 s:=replace(s,'BEGIN', 'BEGIN IF current_setting(''siddhi.demo_seed'',true)=''true'' AND EXISTS(SELECT 1 FROM public.issues WHERE id=NEW.issue_id AND demo_dataset_id IS NOT NULL) THEN RETURN NEW; END IF;'); EXECUTE s;
 s:=pg_get_functiondef('public.seed_demo_batch(text,jsonb,jsonb,jsonb,jsonb,jsonb)'::regprocedure);
 s:=replace(s,'BEGIN', 'BEGIN PERFORM set_config(''siddhi.demo_seed'',''true'',true);'); EXECUTE s;
END $fix$;