ALTER TABLE public.issues ADD COLUMN duplicate_candidate_id uuid REFERENCES public.issues(id);
CREATE TABLE public.issue_evidence (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), issue_id uuid NOT NULL REFERENCES public.issues(id), kind text NOT NULL CHECK (kind IN ('inspection','completion','external_action')), storage_path text NOT NULL, note text NOT NULL, actor_id uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.issue_evidence TO authenticated;
GRANT ALL ON public.issue_evidence TO service_role;
ALTER TABLE public.issue_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff reads evidence" ON public.issue_evidence FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE OR REPLACE FUNCTION public.staff_record_evidence(_id uuid,_kind text,_path text,_note text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE evidence_id uuid;
BEGIN
IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Staff access required'; END IF;
IF _kind NOT IN ('inspection','completion','external_action') OR length(trim(coalesce(_note,'')))<5 OR length(_note)>1000 OR _path NOT LIKE 'staff-evidence/%' THEN RAISE EXCEPTION 'A valid evidence photo and description are required'; END IF;
PERFORM id FROM public.issues WHERE id=_id FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Issue not found'; END IF;
INSERT INTO public.issue_evidence(issue_id,kind,storage_path,note,actor_id) VALUES(_id,_kind,_path,trim(_note),auth.uid()) RETURNING id INTO evidence_id;
INSERT INTO public.issue_events(issue_id,kind,note,actor_id,actor_label) VALUES(_id,'evidence_'||_kind,trim(_note),auth.uid(),'CivicFix staff');
RETURN evidence_id;
END $$;
REVOKE ALL ON FUNCTION public.staff_record_evidence(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_record_evidence(uuid,text,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.require_completion_evidence() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
IF NEW.status='resolved' AND OLD.status<>'resolved' AND NOT EXISTS(SELECT 1 FROM public.issue_evidence WHERE issue_id=NEW.id AND kind='completion') THEN RAISE EXCEPTION 'Record completion photo evidence before resolving this issue'; END IF;
IF NEW.duplicate_of IS NOT NULL AND NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'Update the canonical issue instead of a merged report'; END IF;
RETURN NEW;
END $$;
CREATE TRIGGER issues_require_completion BEFORE UPDATE ON public.issues FOR EACH ROW EXECUTE FUNCTION public.require_completion_evidence();
CREATE OR REPLACE FUNCTION public.create_civic_report(_report jsonb, _token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE new_id uuid; existing_ref text; candidate_id uuid;
BEGIN
PERFORM pg_advisory_xact_lock(hashtextextended(_report->>'idempotency_key',0));
SELECT ref_code INTO existing_ref FROM public.issues WHERE idempotency_key=_report->>'idempotency_key';
IF existing_ref IS NOT NULL THEN RETURN jsonb_build_object('ref',existing_ref,'duplicate',true); END IF;
candidate_id:=nullif(_report->>'duplicate_of','')::uuid;
IF candidate_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.nearby_issues((_report->>'lat')::float8,(_report->>'lng')::float8,120,_report->>'category') WHERE id=candidate_id) THEN RAISE EXCEPTION 'Duplicate candidate is no longer eligible'; END IF;
INSERT INTO public.issues(ref_code,idempotency_key,title,summary,description,category,subcategory,severity,status,ai_confidence,safety_warning,lat,lng,landmark,photo_url,department,duplicate_candidate_id,sla_due_at,routing_snapshot) VALUES(_report->>'ref_code',_report->>'idempotency_key',_report->>'title',_report->>'summary',_report->>'description',_report->>'category',_report->>'subcategory',(_report->>'severity')::public.issue_severity,(_report->>'status')::public.issue_status,(_report->>'ai_confidence')::real,_report->>'safety_warning',(_report->>'lat')::float8,(_report->>'lng')::float8,_report->>'landmark',_report->>'photo_url',_report->>'department',candidate_id,(_report->>'sla_due_at')::timestamptz,_report->'routing_snapshot') RETURNING id INTO new_id;
INSERT INTO public.issue_secrets(issue_id,recovery_token) VALUES(new_id,_token);
INSERT INTO public.issue_events(issue_id,kind,to_status,actor_label,note) VALUES(new_id,'created',(_report->>'status')::public.issue_status,'Citizen','Report recorded in CivicFix. No government delivery recorded.');
IF candidate_id IS NOT NULL THEN INSERT INTO public.issue_events(issue_id,kind,actor_label,note) VALUES(new_id,'duplicate_candidate','Citizen','Possible matching report flagged for staff review; not merged.'); END IF;
RETURN jsonb_build_object('ref',_report->>'ref_code','duplicate',false);
END $$;
REVOKE ALL ON FUNCTION public.create_civic_report(jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_civic_report(jsonb,text) TO service_role;
CREATE OR REPLACE FUNCTION public.review_issue_duplicate(_report uuid,_candidate uuid,_decision text,_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.issues; c public.issues; old_parent uuid;
BEGIN
IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Staff access required'; END IF;
IF _decision NOT IN ('merge','reject','reverse') OR length(trim(coalesce(_reason,'')))<5 OR length(_reason)>1000 THEN RAISE EXCEPTION 'Choose a valid decision and a reason of 5 to 1000 characters'; END IF;
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
UPDATE public.issues SET duplicate_candidate_id=NULL WHERE id=r.id AND duplicate_candidate_id=c.id;
END IF;
UPDATE public.issues SET support_count=(SELECT count(*) FROM public.issues WHERE duplicate_of=c.id) WHERE id=c.id;
INSERT INTO public.issue_duplicate_reviews(report_id,candidate_id,decision,reason,previous_parent,actor_id) VALUES(r.id,c.id,_decision,trim(_reason),old_parent,auth.uid());
INSERT INTO public.issue_events(issue_id,kind,note,actor_id,actor_label) VALUES(r.id,'duplicate_'||_decision,trim(_reason)||' · related report '||c.ref_code,auth.uid(),'CivicFix staff'),(c.id,'duplicate_'||_decision,trim(_reason)||' · related report '||r.ref_code,auth.uid(),'CivicFix staff');
END $$;
REVOKE ALL ON FUNCTION public.review_issue_duplicate(uuid,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_issue_duplicate(uuid,uuid,text,text) TO authenticated;