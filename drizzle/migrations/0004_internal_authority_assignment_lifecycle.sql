ALTER TABLE public.issues ADD COLUMN authority_id uuid REFERENCES public.civic_authorities(id), ADD COLUMN assignment_state text NOT NULL DEFAULT 'unassigned', ADD COLUMN escalated_at timestamptz;
CREATE TABLE public.issue_assignments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),issue_id uuid NOT NULL REFERENCES public.issues(id),authority_id uuid REFERENCES public.civic_authorities(id),action text NOT NULL,reason text NOT NULL,actor_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.issue_assignments TO anon,authenticated;
GRANT ALL ON public.issue_assignments TO service_role;
ALTER TABLE public.issue_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public assignment history" ON public.issue_assignments FOR SELECT TO anon,authenticated USING(true);
CREATE OR REPLACE FUNCTION public.assign_civic_issue(_id uuid,_authority uuid,_action text,_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.issues; a public.civic_authorities;
BEGIN
IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Staff access required'; END IF;
IF _action NOT IN ('assign','accept','reject','escalate') OR length(trim(_reason))<5 OR length(_reason)>1000 THEN RAISE EXCEPTION 'A valid action and reason of 5 to 1000 characters is required'; END IF;
SELECT * INTO r FROM public.issues WHERE id=_id FOR UPDATE;
IF r.id IS NULL OR r.duplicate_of IS NOT NULL OR r.status IN ('resolved','closed','rejected') THEN RAISE EXCEPTION 'Assignment requires an active canonical issue'; END IF;
IF _action='assign' THEN
SELECT * INTO a FROM public.civic_authorities WHERE id=_authority AND active;
IF a.id IS NULL THEN RAISE EXCEPTION 'Select a verified directory authority'; END IF;
UPDATE public.issues SET authority_id=a.id,department=a.name,assigned_to=auth.uid(),assignment_state='pending',status='assigned' WHERE id=r.id;
ELSIF _action IN ('accept','reject') THEN
IF r.assignment_state<>'pending' OR r.authority_id IS NULL OR r.authority_id IS DISTINCT FROM _authority THEN RAISE EXCEPTION 'Assignment changed. Refresh the case'; END IF;
UPDATE public.issues SET assignment_state=CASE WHEN _action='accept' THEN 'accepted' ELSE 'rejected' END WHERE id=r.id;
ELSE
UPDATE public.issues SET escalated_at=now() WHERE id=r.id;
END IF;
INSERT INTO public.issue_assignments(issue_id,authority_id,action,reason,actor_id) VALUES(r.id,CASE WHEN _action='assign' THEN a.id ELSE r.authority_id END,_action,trim(_reason),auth.uid());
INSERT INTO public.issue_events(issue_id,kind,from_status,to_status,note,actor_id,actor_label) VALUES(r.id,'assignment_'||_action,r.status,CASE WHEN _action='assign' THEN 'assigned'::public.issue_status ELSE r.status END,trim(_reason)||' · Internal CivicFix decision, not government acceptance',auth.uid(),'CivicFix staff');
END $$;
REVOKE ALL ON FUNCTION public.assign_civic_issue(uuid,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.assign_civic_issue(uuid,uuid,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.staff_edit_classification(_id uuid,_category text,_severity public.issue_severity,_note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Staff access required'; END IF;
IF _category NOT IN ('roads','electricity','water','drainage','waste','transport','parks','sanitation','trees','buildings','other') OR length(trim(_note))<2 OR length(_note)>1000 THEN RAISE EXCEPTION 'Invalid classification'; END IF;
UPDATE public.issues SET category=_category,severity=_severity WHERE id=_id;
IF NOT FOUND THEN RAISE EXCEPTION 'Issue not found'; END IF;
INSERT INTO public.issue_events(issue_id,kind,note,actor_id,actor_label) VALUES(_id,'classification',trim(_note),auth.uid(),'CivicFix staff');
END $$;
REVOKE ALL ON FUNCTION public.staff_edit_classification(uuid,text,public.issue_severity,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_edit_classification(uuid,text,public.issue_severity,text) TO authenticated;
REVOKE UPDATE ON public.issues FROM authenticated;
REVOKE UPDATE(category,severity,department,assigned_to,summary,subcategory,sla_due_at) ON public.issues FROM authenticated;