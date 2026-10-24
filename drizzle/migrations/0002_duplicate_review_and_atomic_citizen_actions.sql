CREATE TABLE public.issue_duplicate_reviews (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), report_id uuid NOT NULL REFERENCES public.issues(id), candidate_id uuid NOT NULL REFERENCES public.issues(id), decision text NOT NULL, reason text NOT NULL, previous_parent uuid, actor_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.issue_duplicate_reviews TO authenticated;
GRANT ALL ON public.issue_duplicate_reviews TO service_role;
ALTER TABLE public.issue_duplicate_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff reads duplicate decisions" ON public.issue_duplicate_reviews FOR SELECT TO authenticated USING(public.is_staff(auth.uid()));
CREATE OR REPLACE FUNCTION public.review_issue_duplicate(_report uuid,_candidate uuid,_decision text,_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.issues; c public.issues; old_parent uuid;
BEGIN
IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Staff access required'; END IF;
IF _decision NOT IN ('merge','reject','reverse') OR length(trim(_reason))<5 OR length(_reason)>1000 THEN RAISE EXCEPTION 'Choose a valid decision and a reason of 5 to 1000 characters'; END IF;
IF _report=_candidate THEN RAISE EXCEPTION 'An issue cannot merge into itself'; END IF;
PERFORM id FROM public.issues WHERE id IN (_report,_candidate) ORDER BY id FOR UPDATE;
SELECT * INTO r FROM public.issues WHERE id=_report; SELECT * INTO c FROM public.issues WHERE id=_candidate;
IF r.id IS NULL OR c.id IS NULL THEN RAISE EXCEPTION 'Report not found'; END IF;
old_parent:=r.duplicate_of;
IF _decision='merge' THEN
IF r.duplicate_of IS NOT NULL OR c.duplicate_of IS NOT NULL OR EXISTS(SELECT 1 FROM public.issues WHERE duplicate_of=r.id) THEN RAISE EXCEPTION 'Merge only an unlinked report into a canonical issue; linked trees require review'; END IF;
UPDATE public.issues SET duplicate_of=c.id WHERE id=r.id;
UPDATE public.issues SET support_count=(SELECT count(*)+1 FROM public.issues WHERE duplicate_of=c.id) WHERE id=c.id;
ELSIF _decision='reverse' THEN
IF r.duplicate_of IS DISTINCT FROM c.id THEN RAISE EXCEPTION 'This merge is no longer current'; END IF;
UPDATE public.issues SET duplicate_of=NULL WHERE id=r.id;
UPDATE public.issues SET support_count=(SELECT count(*)+1 FROM public.issues WHERE duplicate_of=c.id) WHERE id=c.id;
END IF;
INSERT INTO public.issue_duplicate_reviews(report_id,candidate_id,decision,reason,previous_parent,actor_id) VALUES(r.id,c.id,_decision,trim(_reason),old_parent,auth.uid());
INSERT INTO public.issue_events(issue_id,kind,note,actor_id,actor_label) VALUES(r.id,'duplicate_'||_decision,trim(_reason)||' · related report '||c.ref_code,auth.uid(),'CivicFix staff'),(c.id,'duplicate_'||_decision,trim(_reason)||' · related report '||r.ref_code,auth.uid(),'CivicFix staff');
END $$;
REVOKE ALL ON FUNCTION public.review_issue_duplicate(uuid,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_issue_duplicate(uuid,uuid,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.citizen_change_issue(_ref text,_token text,_action text,_note text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.issues; next_status public.issue_status;
BEGIN
SELECT * INTO r FROM public.issues WHERE ref_code=_ref FOR UPDATE;
IF r.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.issue_secrets WHERE issue_id=r.id AND recovery_token=_token) THEN RAISE EXCEPTION 'This tracking link is not valid'; END IF;
IF r.status<>'resolved' THEN RAISE EXCEPTION 'This action is only available after resolution'; END IF;
IF _action NOT IN ('confirm','reopen') OR length(coalesce(_note,''))>500 THEN RAISE EXCEPTION 'Invalid reporter action'; END IF;
next_status:=CASE WHEN _action='confirm' THEN 'closed'::public.issue_status ELSE 'reopened'::public.issue_status END;
UPDATE public.issues SET status=next_status WHERE id=r.id;
INSERT INTO public.issue_events(issue_id,kind,from_status,to_status,actor_label,note) VALUES(r.id,CASE WHEN _action='confirm' THEN 'citizen_confirmed' ELSE 'disputed' END,'resolved',next_status,'Original reporter',coalesce(nullif(trim(_note),''),CASE WHEN _action='confirm' THEN 'Reporter confirmed the fix' ELSE 'Reporter says the problem is not fixed' END));
RETURN next_status::text;
END $$;
REVOKE ALL ON FUNCTION public.citizen_change_issue(text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.citizen_change_issue(text,text,text,text) TO service_role;