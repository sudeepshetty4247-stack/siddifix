CREATE TABLE public.staff_response_templates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,body text NOT NULL,statuses text[] NOT NULL DEFAULT '{}',active boolean NOT NULL DEFAULT true,updated_at timestamptz NOT NULL DEFAULT now(),updated_by uuid);
GRANT SELECT ON public.staff_response_templates TO authenticated;
GRANT ALL ON public.staff_response_templates TO service_role;
ALTER TABLE public.staff_response_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY template_read ON public.staff_response_templates FOR SELECT TO authenticated USING(public.is_staff(auth.uid()));
CREATE OR REPLACE FUNCTION public.admin_save_response_template(_id uuid,_name text,_body text,_statuses text[],_active boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v uuid; BEGIN
 IF NOT public.has_role(auth.uid(),'admin') OR length(trim(_name)) NOT BETWEEN 2 AND 100 OR length(trim(_body)) NOT BETWEEN 5 AND 1000 THEN RAISE EXCEPTION 'Template change not permitted'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(_statuses) s WHERE s NOT IN ('submitted','under_review','assigned','accepted','inspection_scheduled','in_progress','awaiting_verification','resolved','reopened','closed','rejected','needs_classification')) THEN RAISE EXCEPTION 'Invalid status'; END IF;
 v:=coalesce(_id,gen_random_uuid()); INSERT INTO public.staff_response_templates(id,name,body,statuses,active,updated_by) VALUES(v,trim(_name),trim(_body),_statuses,_active,auth.uid()) ON CONFLICT(id) DO UPDATE SET name=excluded.name,body=excluded.body,statuses=excluded.statuses,active=excluded.active,updated_at=now(),updated_by=auth.uid();
 INSERT INTO public.civic_directory_audit(table_name,record_id,action,actor_id,new_row) VALUES('staff_response_templates',v,'template_saved',auth.uid(),jsonb_build_object('name',_name,'statuses',_statuses,'active',_active)); RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.admin_save_response_template(uuid,text,text,text[],boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_save_response_template(uuid,text,text,text[],boolean) TO authenticated;
ALTER TABLE public.issue_events ADD COLUMN request_key uuid;
CREATE UNIQUE INDEX staff_message_retry_key ON public.issue_events(actor_id,request_key) WHERE request_key IS NOT NULL;
CREATE OR REPLACE FUNCTION public.staff_case_message(_issue uuid,_note text,_visibility text,_request uuid,_template uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r public.issues; v uuid; t public.staff_response_templates; BEGIN
 IF NOT public.staff_can_work(auth.uid(),_issue) OR _visibility NOT IN ('public','internal','instruction') OR length(trim(_note)) NOT BETWEEN 5 AND 1000 OR _request IS NULL THEN RAISE EXCEPTION 'Case message not permitted'; END IF;
 SELECT * INTO r FROM public.issues WHERE id=_issue FOR UPDATE;
 SELECT id INTO v FROM public.issue_events WHERE actor_id=auth.uid() AND request_key=_request AND issue_id=_issue; IF v IS NOT NULL THEN RETURN v; END IF;
 IF _visibility='instruction' AND NOT public.is_supervisor(auth.uid()) THEN RAISE EXCEPTION 'Supervisor required'; END IF;
 IF _template IS NOT NULL THEN SELECT * INTO t FROM public.staff_response_templates WHERE id=_template AND active; IF t.id IS NULL OR (cardinality(t.statuses)>0 AND NOT r.status::text=ANY(t.statuses)) THEN RAISE EXCEPTION 'Template not valid for current status'; END IF; END IF;
 INSERT INTO public.issue_events(issue_id,kind,note,actor_id,actor_label,visibility,request_key) VALUES(_issue,CASE _visibility WHEN 'public' THEN 'public_update' WHEN 'instruction' THEN 'supervisor_instruction' ELSE 'internal_note' END,trim(_note),auth.uid(),public.staff_actor_label(auth.uid()),CASE WHEN _visibility='public' THEN 'public' ELSE 'internal' END,_request) RETURNING id INTO v;
 RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.staff_case_message(uuid,text,text,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_case_message(uuid,text,text,uuid,uuid) TO authenticated;
ALTER TABLE public.service_targets ADD COLUMN reminder_hours integer NOT NULL DEFAULT 0;
CREATE OR REPLACE FUNCTION public.admin_set_reminder_hours(_category text,_severity public.issue_severity,_hours integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE t public.service_targets; BEGIN
 IF NOT public.has_role(auth.uid(),'admin') OR _hours NOT BETWEEN 0 AND 8760 THEN RAISE EXCEPTION 'Reminder configuration not permitted'; END IF;
 SELECT * INTO t FROM public.service_targets WHERE category=_category AND severity=_severity FOR UPDATE; IF t.id IS NULL OR _hours>t.ack_hours THEN RAISE EXCEPTION 'Reminder must fit acknowledgement target'; END IF;
 UPDATE public.service_targets SET reminder_hours=_hours,updated_at=now(),updated_by=auth.uid() WHERE id=t.id;
 INSERT INTO public.civic_directory_audit(table_name,record_id,action,actor_id,new_row) VALUES('service_targets',t.id,'reminder_changed',auth.uid(),jsonb_build_object('hours',_hours));
END $$;
REVOKE ALL ON FUNCTION public.admin_set_reminder_hours(text,public.issue_severity,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_reminder_hours(text,public.issue_severity,integer) TO authenticated;
ALTER TABLE public.issue_events ADD COLUMN event_key text;
CREATE UNIQUE INDEX case_deadline_event_key ON public.issue_events(issue_id,event_key) WHERE event_key IS NOT NULL;
CREATE OR REPLACE FUNCTION public.process_deadline_reminders() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE n integer; BEGIN
 INSERT INTO public.issue_events(issue_id,kind,note,actor_label,event_key)
 SELECT i.id,'deadline_approaching','Configured Siddi '||d.kind||' target is approaching. Not an official government commitment.','Siddi deadline processor',d.kind||':'||d.due::text||':'||coalesce(i.team_id::text,'unassigned')||':'||coalesce(i.assigned_to::text,'team')
 FROM public.issues i JOIN public.service_targets s ON s.category=i.category AND s.severity=i.severity AND s.active AND s.reminder_hours>0
 CROSS JOIN LATERAL(VALUES('acknowledgement',CASE WHEN i.acknowledged_at IS NULL THEN i.ack_due_at END),('resolution',coalesce(i.eta_at,i.sla_due_at))) d(kind,due)
 WHERE i.duplicate_of IS NULL AND i.status::text NOT IN ('resolved','closed','rejected') AND d.due>now() AND d.due<=now()+make_interval(hours=>s.reminder_hours)
 ON CONFLICT(issue_id,event_key) WHERE event_key IS NOT NULL DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.process_deadline_reminders() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_deadline_reminders() TO service_role;
DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='escalate_overdue_issues';
 d:=regexp_replace(d,', nt AS \([\s\S]*?RETURNING issue_id\n  \)', '', 'g'); EXECUTE d;
END $$;
CREATE OR REPLACE FUNCTION public.staff_configuration_valid(_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.staff_profiles p JOIN public.civic_teams t ON t.active AND t.department=p.department AND cardinality(p.categories)>0 AND p.categories<@t.categories AND (cardinality(p.team_ids)=0 OR t.id=ANY(p.team_ids)) WHERE p.user_id=_user AND p.active) $$;
REVOKE ALL ON FUNCTION public.staff_configuration_valid(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_configuration_valid(uuid) TO authenticated,service_role;
DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='staff_can_work';
 d:=replace(d,'WHERE i.id=_issue AND p.active','WHERE i.id=_issue AND p.active AND public.staff_configuration_valid(_user_id) AND (i.team_id IS NULL OR t.active)'); EXECUTE d;
END $$;