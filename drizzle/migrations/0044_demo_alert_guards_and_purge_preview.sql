-- Demo-labelled cases must never trigger alerts to genuine staff.
CREATE OR REPLACE FUNCTION public.critical_incident_watch()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.issues; alert uuid; key text;
BEGIN
  IF NEW.kind NOT IN ('created','disputed','citizen_reopened') THEN RETURN NEW; END IF;
  SELECT * INTO r FROM public.issues WHERE id=NEW.issue_id;
  IF r.id IS NULL OR r.severity<>'critical' OR r.duplicate_of IS NOT NULL OR r.demo_dataset_id IS NOT NULL OR r.acknowledged_at IS NOT NULL AND NEW.kind='created' THEN RETURN NEW; END IF;
  key:='critical:'||NEW.id::text;
  IF EXISTS(SELECT 1 FROM public.issue_events WHERE issue_id=r.id AND event_key=key) THEN RETURN NEW; END IF;
  INSERT INTO public.issue_events(issue_id,kind,note,actor_label,visibility,event_key)
  VALUES(r.id,'critical_alert',CASE WHEN NEW.kind='created' THEN 'Critical-severity report: immediate acknowledgement required' ELSE 'Critical case reopened by reporter: fresh acknowledgement required' END,'Siddhi urgency rules','internal',key)
  RETURNING id INTO alert;
  PERFORM public.emit_case_notifications(alert,'critical_incident','Critical incident — acknowledge now',
    r.ref_code||' · '||r.category||' · '||left(r.title,120)||coalesce(' · near '||r.landmark,'')||CASE WHEN r.ack_due_at IS NOT NULL THEN ' · acknowledge by '||to_char(r.ack_due_at AT TIME ZONE 'Asia/Kolkata','DD Mon HH24:MI')||' IST' ELSE '' END,false);
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.report_surge_watch()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE t int; alert uuid; key text;
BEGIN
  IF NEW.duplicate_of IS NOT NULL OR NEW.demo_dataset_id IS NOT NULL OR NEW.support_count<=OLD.support_count THEN RETURN NEW; END IF;
  FOREACH t IN ARRAY ARRAY[3,5,10,25] LOOP
    IF OLD.support_count < t AND NEW.support_count >= t THEN
      key:='surge:'||NEW.id::text||':'||t;
      IF NOT EXISTS(SELECT 1 FROM public.issue_events WHERE issue_id=NEW.id AND event_key=key) THEN
        INSERT INTO public.issue_events(issue_id,kind,note,actor_label,visibility,event_key)
        VALUES(NEW.id,'surge_detected',t||' additional citizen reports are now linked to this case','Siddhi urgency rules','internal',key) RETURNING id INTO alert;
        PERFORM public.emit_case_notifications(alert,'surge_detected','More citizens reporting this case',NEW.ref_code||' now has '||(NEW.support_count+1)||' linked reports. Review priority; report volume alone does not change severity.',false);
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END $function$;

-- Dry-run preview for demo cleanup: counts every dependent record and verifies labelling.
CREATE OR REPLACE FUNCTION public.preview_demo_purge(_dataset text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE n_issues bigint; n_events bigint; n_notifications bigint; n_feedback bigint; n_evidence bigint; n_photos bigint; n_assignments bigint; n_reviews bigint; n_ownership bigint; n_secrets bigint; n_teams bigint; n_profiles bigint; unlabelled bigint;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 IF _dataset IS NULL OR btrim(_dataset) = '' THEN RAISE EXCEPTION 'A demo dataset id is required'; END IF;
 SELECT count(*) INTO n_issues FROM public.issues WHERE demo_dataset_id = _dataset;
 SELECT count(*) INTO n_events FROM public.issue_events e JOIN public.issues i ON i.id=e.issue_id WHERE i.demo_dataset_id = _dataset;
 SELECT count(*) INTO n_notifications FROM public.issue_notifications n JOIN public.issues i ON i.id=n.issue_id WHERE i.demo_dataset_id = _dataset;
 SELECT count(*) INTO n_feedback FROM public.issue_feedback f JOIN public.issues i ON i.id=f.issue_id WHERE i.demo_dataset_id = _dataset;
 SELECT count(*) INTO n_evidence FROM public.issue_evidence ev JOIN public.issues i ON i.id=ev.issue_id WHERE i.demo_dataset_id = _dataset;
 SELECT count(*) INTO n_photos FROM public.issue_photos p JOIN public.issues i ON i.id=p.issue_id WHERE i.demo_dataset_id = _dataset;
 SELECT count(*) INTO n_assignments FROM public.issue_assignments a JOIN public.issues i ON i.id=a.issue_id WHERE i.demo_dataset_id = _dataset;
 SELECT count(*) INTO n_reviews FROM public.issue_duplicate_reviews d JOIN public.issues i ON i.id=d.report_id OR i.id=d.candidate_id WHERE i.demo_dataset_id = _dataset;
 SELECT count(*) INTO n_ownership FROM public.issue_ownership_reviews o JOIN public.issues i ON i.id=o.issue_id WHERE i.demo_dataset_id = _dataset;
 SELECT count(*) INTO n_secrets FROM public.issue_secrets WHERE demo_dataset_id = _dataset;
 SELECT count(*) INTO n_teams FROM public.civic_teams WHERE demo_dataset_id = _dataset;
 SELECT count(*) INTO n_profiles FROM public.staff_profiles WHERE demo_dataset_id = _dataset;
 -- Safety: genuine records that reference demo rows (e.g. a genuine report marked as a duplicate of a demo case) block the purge.
 SELECT count(*) INTO unlabelled FROM public.issues g WHERE g.demo_dataset_id IS NULL AND (g.duplicate_of IN (SELECT id FROM public.issues WHERE demo_dataset_id = _dataset) OR g.duplicate_candidate_id IN (SELECT id FROM public.issues WHERE demo_dataset_id = _dataset));
 RETURN jsonb_build_object('dataset',_dataset,'issues',n_issues,'events',n_events,'notifications',n_notifications,'feedback',n_feedback,'evidence',n_evidence,'photos',n_photos,'assignments',n_assignments,'duplicate_reviews',n_reviews,'ownership_reviews',n_ownership,'secrets',n_secrets,'teams',n_teams,'staff_profiles',n_profiles,'genuine_records_blocked',unlabelled,'safe_to_purge',unlabelled=0);
END $function$;
