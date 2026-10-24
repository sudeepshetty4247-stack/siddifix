CREATE OR REPLACE FUNCTION public.route_issue_to_team(_issue uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v public.issues; w text; ids uuid[]; chosen public.civic_teams; BEGIN
 SELECT * INTO v FROM public.issues WHERE id=_issue FOR UPDATE; IF v.id IS NULL THEN RAISE EXCEPTION 'Issue not found'; END IF; IF v.team_id IS NOT NULL THEN RETURN 'already_routed'; END IF;
 w:=v.routing_snapshot->'ward'->>'identifier';
 IF v.status<>'needs_classification' THEN
 SELECT array_agg(id) INTO ids FROM public.civic_teams WHERE active AND NOT is_fallback AND v.category=ANY(categories) AND (cardinality(wards)=0 OR w=ANY(wards)) AND (v.department IS NULL OR v.department='Ownership review pending' OR department=v.department);
 IF coalesce(cardinality(ids),0)=0 THEN SELECT array_agg(id) INTO ids FROM public.civic_teams WHERE active AND is_fallback AND v.category=ANY(categories) AND (cardinality(wards)=0 OR w=ANY(wards)) AND (v.department IS NULL OR v.department='Ownership review pending' OR department=v.department); END IF;
 END IF;
 IF cardinality(ids)=1 THEN SELECT * INTO chosen FROM public.civic_teams WHERE id=ids[1]; UPDATE public.issues SET team_id=chosen.id,department=chosen.department,assignment_state='assigned',updated_at=now() WHERE id=_issue; INSERT INTO public.issue_events(issue_id,kind,note,actor_label) VALUES(_issue,'routing','Routed to configured eligible team: '||chosen.name,'Siddi routing'); RETURN 'assigned'; END IF;
 UPDATE public.issues SET assignment_state='routing_exception',updated_at=now() WHERE id=_issue;
 INSERT INTO public.issue_events(issue_id,kind,note,actor_label) VALUES(_issue,'routing','No single eligible active team matches category, department and ward. Administrator routing review required.','Siddi routing'); RETURN 'exception';
END $$;
REVOKE ALL ON FUNCTION public.route_issue_to_team(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.route_issue_to_team(uuid) TO service_role;