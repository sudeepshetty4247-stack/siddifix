CREATE OR REPLACE FUNCTION public.review_issue_duplicate(_report uuid, _candidate uuid, _decision text, _reason text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r public.issues; c public.issues; old_parent uuid;
BEGIN
IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Staff access required'; END IF;
IF _decision NOT IN ('merge','reject','reverse','related') OR length(trim(coalesce(_reason,'')))<5 OR length(_reason)>1000 THEN RAISE EXCEPTION 'Choose a valid decision and a reason of 5 to 1000 characters'; END IF;
IF _report=_candidate THEN RAISE EXCEPTION 'An issue cannot merge into itself'; END IF;
PERFORM id FROM public.issues WHERE id IN (_report,_candidate) ORDER BY id FOR UPDATE;
SELECT * INTO r FROM public.issues WHERE id=_report; SELECT * INTO c FROM public.issues WHERE id=_candidate;
IF r.id IS NULL OR c.id IS NULL THEN RAISE EXCEPTION 'Report not found'; END IF;
old_parent:=r.duplicate_of;
IF _decision='merge' THEN
  IF r.duplicate_of IS NOT NULL OR c.duplicate_of IS NOT NULL OR EXISTS(SELECT 1 FROM public.issues WHERE duplicate_of=r.id) THEN RAISE EXCEPTION 'Merge only an unlinked report into a canonical issue'; END IF;
  UPDATE public.issues SET duplicate_of=c.id,duplicate_candidate_id=NULL WHERE id=r.id;
ELSIF _decision='reverse' THEN
  IF r.duplicate_of IS DISTINCT FROM c.id THEN RAISE EXCEPTION 'This merge is no longer current'; END IF;
  UPDATE public.issues SET duplicate_of=NULL,duplicate_candidate_id=NULL WHERE id=r.id;
ELSE
  -- reject and related: both keep reports as separate issues; related only records the association
  UPDATE public.issues SET duplicate_candidate_id=NULL WHERE id=r.id AND duplicate_candidate_id=c.id;
END IF;
UPDATE public.issues SET support_count=(SELECT count(*) FROM public.issues WHERE duplicate_of=c.id) WHERE id=c.id;
INSERT INTO public.issue_duplicate_reviews(report_id,candidate_id,decision,reason,previous_parent,actor_id) VALUES(r.id,c.id,_decision,trim(_reason),old_parent,auth.uid());
INSERT INTO public.issue_events(issue_id,kind,note,actor_id,actor_label) VALUES(r.id,'duplicate_'||_decision,trim(_reason)||' · related report '||c.ref_code,auth.uid(),'Siddi staff'),(c.id,'duplicate_'||_decision,trim(_reason)||' · related report '||r.ref_code,auth.uid(),'Siddi staff');
END $function$;