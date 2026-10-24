CREATE OR REPLACE FUNCTION public.admin_set_full_staff_scope(_user uuid,_name text,_designation text,_department text,_categories text[],_wards text[],_teams uuid[],_corporations text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT public.has_role(auth.uid(),'admin') OR _user=auth.uid() OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user AND role='admin') THEN RAISE EXCEPTION 'Operational scope change not permitted'; END IF;
 IF cardinality(_categories)=0 OR EXISTS(SELECT 1 FROM unnest(_categories) c WHERE c NOT IN ('roads','electricity','water','drainage','waste','transport','parks','sanitation','trees','buildings','other')) THEN RAISE EXCEPTION 'Supported categories required'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(_wards) w WHERE NOT EXISTS(SELECT 1 FROM public.civic_wards WHERE identifier=w AND active)) OR EXISTS(SELECT 1 FROM unnest(_corporations) c WHERE NOT EXISTS(SELECT 1 FROM public.civic_wards WHERE corporation=c AND active)) THEN RAISE EXCEPTION 'Select configured jurisdictions'; END IF;
 PERFORM public.admin_set_staff_profile(_user,_name,_designation,_department,_categories,_wards);
 PERFORM public.admin_set_team_scope(_user,_teams,_corporations);
END $$;
REVOKE ALL ON FUNCTION public.admin_set_full_staff_scope(uuid,text,text,text,text[],text[],uuid[],text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_full_staff_scope(uuid,text,text,text,text[],text[],uuid[],text[]) TO authenticated;
CREATE OR REPLACE FUNCTION public.staff_assign_handler(_issue uuid,_handler uuid,_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT public.is_supervisor(auth.uid()) OR NOT public.staff_can_work(auth.uid(),_issue) OR length(trim(_reason))<3 THEN RAISE EXCEPTION 'Handler assignment not permitted'; END IF;
 IF NOT public.staff_can_work(_handler,_issue) OR public.has_role(_handler,'admin') THEN RAISE EXCEPTION 'Handler is not eligible for this case'; END IF;
 PERFORM id FROM public.issues WHERE id=_issue FOR UPDATE;
 UPDATE public.issues SET assigned_to=_handler,updated_at=now() WHERE id=_issue;
 INSERT INTO public.issue_events(issue_id,kind,note,actor_id,actor_label) VALUES(_issue,'assignment','Case handler assigned: '||public.staff_actor_label(_handler)||'. '||_reason,auth.uid(),public.staff_actor_label(auth.uid()));
END $$;
REVOKE ALL ON FUNCTION public.staff_assign_handler(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_assign_handler(uuid,uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.eligible_case_handlers(_issue uuid) RETURNS TABLE(user_id uuid,display_name text,designation text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT public.is_supervisor(auth.uid()) OR NOT public.staff_can_work(auth.uid(),_issue) THEN RAISE EXCEPTION 'Case supervision required'; END IF;
 RETURN QUERY SELECT p.user_id,p.display_name,p.designation FROM public.staff_profiles p WHERE p.active AND public.staff_can_work(p.user_id,_issue) AND NOT public.has_role(p.user_id,'admin');
END $$;
REVOKE ALL ON FUNCTION public.eligible_case_handlers(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.eligible_case_handlers(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.audit_handler_reassignment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF OLD.assigned_to IS NOT NULL AND NEW.assigned_to IS NULL THEN INSERT INTO public.issue_events(issue_id,kind,note,actor_id,actor_label) VALUES(NEW.id,'assignment','Previous case handler released. Team queue retains the case for reassignment.',auth.uid(),'Siddi account management'); END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.audit_handler_reassignment() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER issue_handler_release AFTER UPDATE OF assigned_to ON public.issues FOR EACH ROW EXECUTE FUNCTION public.audit_handler_reassignment();
DO $$ DECLARE d text; BEGIN SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='record_issue_notification';d:=replace(d,'''reopened'') THEN','''reopened'',''disputed'') THEN');EXECUTE d; END $$;