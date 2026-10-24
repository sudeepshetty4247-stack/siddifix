CREATE OR REPLACE FUNCTION public.staff_record_evidence_retry(_id uuid,_kind text,_path text,_note text,_request uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v uuid; BEGIN
 IF NOT public.staff_can_work(auth.uid(),_id) OR _request IS NULL THEN RAISE EXCEPTION 'Evidence authorization required'; END IF;
 PERFORM id FROM public.issues WHERE id=_id FOR UPDATE;
 SELECT id INTO v FROM public.issue_evidence WHERE issue_id=_id AND actor_id=auth.uid() AND request_key=_request; IF v IS NOT NULL THEN RETURN v; END IF;
 v:=public.staff_record_evidence(_id,_kind,_path,_note); UPDATE public.issue_evidence SET request_key=_request WHERE id=v; RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.staff_record_evidence_retry(uuid,text,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_record_evidence_retry(uuid,text,text,text,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.route_issue_to_team(_issue uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v public.issues; w text; ids uuid[]; chosen public.civic_teams; BEGIN
 SELECT * INTO v FROM public.issues WHERE id=_issue FOR UPDATE; IF v.id IS NULL THEN RAISE EXCEPTION 'Issue not found'; END IF; IF v.team_id IS NOT NULL THEN RETURN 'already_routed'; END IF;
 w:=v.routing_snapshot->'ward'->>'identifier';
 IF v.status<>'needs_classification' THEN
 SELECT array_agg(id) INTO ids FROM public.civic_teams WHERE active AND NOT is_fallback AND v.category=ANY(categories) AND (cardinality(wards)=0 OR w=ANY(wards)) AND (v.department IS NULL OR department=v.department);
 IF coalesce(cardinality(ids),0)=0 THEN SELECT array_agg(id) INTO ids FROM public.civic_teams WHERE active AND is_fallback AND v.category=ANY(categories) AND (cardinality(wards)=0 OR w=ANY(wards)) AND (v.department IS NULL OR department=v.department); END IF;
 END IF;
 IF cardinality(ids)=1 THEN SELECT * INTO chosen FROM public.civic_teams WHERE id=ids[1]; UPDATE public.issues SET team_id=chosen.id,department=chosen.department,assignment_state='assigned',updated_at=now() WHERE id=_issue; INSERT INTO public.issue_events(issue_id,kind,note,actor_label) VALUES(_issue,'routing','Routed to configured eligible team: '||chosen.name,'Siddi routing'); RETURN 'assigned'; END IF;
 UPDATE public.issues SET assignment_state='routing_exception',updated_at=now() WHERE id=_issue;
 INSERT INTO public.issue_events(issue_id,kind,note,actor_label) VALUES(_issue,'routing','No single eligible active team matches category, department and ward. Administrator routing review required.','Siddi routing'); RETURN 'exception';
END $$;
DO $$ DECLARE d text; BEGIN SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='require_completion_evidence';
 d:=replace(d,'kind=''completion''','kind=''completion'' AND EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id=''issue-photos'' AND o.name=issue_evidence.storage_path)'); EXECUTE d;
END $$;