CREATE OR REPLACE FUNCTION public.emit_case_notifications(_event uuid,_type text,_title text,_detail text,_supervisor_only boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE e public.issue_events; BEGIN
 SELECT * INTO e FROM public.issue_events WHERE id=_event; IF e.id IS NULL THEN RAISE EXCEPTION 'Event required'; END IF;
 INSERT INTO public.issue_notifications(issue_id,audience,channel,status,detail,attempts,recipient_user_id,event_id,event_key,notification_type,title,priority,actor_id) SELECT e.issue_id,'staff','in_app','posted',left(_detail,500),1,p.user_id,e.id,e.id::text||':'||_type,_type,_title,CASE WHEN _type='critical_incident' THEN 'critical' WHEN _type IN ('deadline_breached','escalation','surge_detected') THEN 'high' ELSE 'normal' END,e.actor_id FROM public.staff_profiles p WHERE public.staff_can_work(p.user_id,e.issue_id) AND (NOT _supervisor_only OR public.is_supervisor(p.user_id)) ON CONFLICT(recipient_user_id,event_key) WHERE recipient_user_id IS NOT NULL DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.emit_case_notifications(uuid,text,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.emit_case_notifications(uuid,text,text,text,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.critical_incident_watch() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.issues; alert uuid; key text;
BEGIN
  IF NEW.kind NOT IN ('created','disputed','citizen_reopened') THEN RETURN NEW; END IF;
  SELECT * INTO r FROM public.issues WHERE id=NEW.issue_id;
  IF r.id IS NULL OR r.severity<>'critical' OR r.duplicate_of IS NOT NULL OR r.acknowledged_at IS NOT NULL AND NEW.kind='created' THEN RETURN NEW; END IF;
  key:='critical:'||NEW.id::text;
  IF EXISTS(SELECT 1 FROM public.issue_events WHERE issue_id=r.id AND event_key=key) THEN RETURN NEW; END IF;
  INSERT INTO public.issue_events(issue_id,kind,note,actor_label,visibility,event_key)
  VALUES(r.id,'critical_alert',CASE WHEN NEW.kind='created' THEN 'Critical-severity report: immediate acknowledgement required' ELSE 'Critical case reopened by reporter: fresh acknowledgement required' END,'Siddhi urgency rules','internal',key)
  RETURNING id INTO alert;
  PERFORM public.emit_case_notifications(alert,'critical_incident','Critical incident — acknowledge now',
    r.ref_code||' · '||r.category||' · '||left(r.title,120)||coalesce(' · near '||r.landmark,'')||CASE WHEN r.ack_due_at IS NOT NULL THEN ' · acknowledge by '||to_char(r.ack_due_at AT TIME ZONE 'Asia/Kolkata','DD Mon HH24:MI')||' IST' ELSE '' END,false);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.critical_incident_watch() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS critical_incident_watch ON public.issue_events;
CREATE TRIGGER critical_incident_watch AFTER INSERT ON public.issue_events FOR EACH ROW EXECUTE FUNCTION public.critical_incident_watch();

CREATE OR REPLACE FUNCTION public.report_surge_watch() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t int; alert uuid; key text;
BEGIN
  IF NEW.duplicate_of IS NOT NULL OR NEW.support_count<=OLD.support_count THEN RETURN NEW; END IF;
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
END $$;
REVOKE ALL ON FUNCTION public.report_surge_watch() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS report_surge_watch ON public.issues;
CREATE TRIGGER report_surge_watch AFTER UPDATE OF support_count ON public.issues FOR EACH ROW EXECUTE FUNCTION public.report_surge_watch();

CREATE INDEX IF NOT EXISTS issue_events_issue_event_key ON public.issue_events(issue_id,event_key) WHERE event_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS issues_critical_open ON public.issues(created_at) WHERE severity='critical' AND acknowledged_at IS NULL;