DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='create_civic_report';
 d:=replace(d,'INSERT INTO public.issue_events(issue_id,kind,to_status', 'UPDATE public.issues SET ack_due_at=nullif(_report->>''ack_due_at'','''')::timestamptz,target_snapshot=_report->''target_snapshot'' WHERE id=new_id; PERFORM public.route_issue_to_team(new_id); INSERT INTO public.issue_events(issue_id,kind,to_status'); EXECUTE d;
 SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='staff_change_issue';
 d:=replace(d,' sup := public.is_supervisor(auth.uid());',' IF _next=''closed'' THEN RAISE EXCEPTION ''Only the original reporter can confirm and close a resolved case''; END IF; sup := public.is_supervisor(auth.uid());'); EXECUTE d;
END $$;