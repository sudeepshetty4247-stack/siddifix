CREATE TABLE public.issue_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.issues(id),
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  resolution text NOT NULL CHECK (resolution IN ('complete','partial','not_resolved')),
  response_time text NOT NULL CHECK (response_time IN ('excellent','good','average','poor')),
  comment text CHECK (comment IS NULL OR length(comment) <= 1000),
  survey_version integer NOT NULL DEFAULT 1,
  status_at_submission public.issue_status NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (issue_id, survey_version)
);
GRANT ALL ON public.issue_feedback TO service_role;
ALTER TABLE public.issue_feedback ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.citizen_submit_feedback(_ref text, _token text, _rating int, _resolution text, _response_time text, _comment text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.issues; reopened boolean := false;
BEGIN
  SELECT * INTO r FROM public.issues WHERE ref_code=_ref FOR UPDATE;
  IF r.id IS NULL OR NOT public.verify_reporter_token(_ref,_token) THEN RAISE EXCEPTION 'This tracking link is not valid'; END IF;
  IF r.status NOT IN ('resolved','closed') THEN RAISE EXCEPTION 'Feedback opens once the case is marked resolved'; END IF;
  IF _rating NOT BETWEEN 1 AND 5 OR _resolution NOT IN ('complete','partial','not_resolved') OR _response_time NOT IN ('excellent','good','average','poor') OR length(coalesce(_comment,''))>1000 THEN RAISE EXCEPTION 'Invalid feedback'; END IF;
  IF EXISTS (SELECT 1 FROM public.issue_feedback WHERE issue_id=r.id AND survey_version=1) THEN RAISE EXCEPTION 'Feedback was already submitted for this case'; END IF;
  INSERT INTO public.issue_feedback(issue_id,rating,resolution,response_time,comment,status_at_submission)
  VALUES (r.id,_rating,_resolution,_response_time,nullif(trim(coalesce(_comment,'')),''),r.status);
  IF _resolution='not_resolved' AND r.status='resolved' THEN
    UPDATE public.issues SET status='reopened' WHERE id=r.id;
    INSERT INTO public.issue_events(issue_id,kind,from_status,to_status,actor_label,note)
    VALUES (r.id,'disputed','resolved','reopened','Original reporter','Reporter feedback says the issue is not resolved');
    reopened := true;
  END IF;
  RETURN jsonb_build_object('saved',true,'reopened',reopened);
END $$;
REVOKE ALL ON FUNCTION public.citizen_submit_feedback(text,text,int,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.citizen_submit_feedback(text,text,int,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.citizen_feedback_state(_ref text, _token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.issues; f public.issue_feedback;
BEGIN
  SELECT * INTO r FROM public.issues WHERE ref_code=_ref;
  IF r.id IS NULL OR NOT public.verify_reporter_token(_ref,_token) THEN RETURN jsonb_build_object('allowed',false); END IF;
  SELECT * INTO f FROM public.issue_feedback WHERE issue_id=r.id AND survey_version=1;
  RETURN jsonb_build_object('allowed',r.status IN ('resolved','closed'),'submitted',f.id IS NOT NULL,'submitted_at',f.submitted_at);
END $$;
REVOKE ALL ON FUNCTION public.citizen_feedback_state(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.citizen_feedback_state(text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_feedback_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') AND public.account_active(auth.uid())) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN jsonb_build_object(
    'responses',(SELECT count(*) FROM issue_feedback),
    'eligible',(SELECT count(*) FROM issues WHERE status IN ('resolved','closed') AND duplicate_of IS NULL),
    'avg_rating',(SELECT round(avg(rating)::numeric,2) FROM issue_feedback),
    'ratings',(SELECT coalesce(jsonb_object_agg(rating,n),'{}') FROM (SELECT rating,count(*) n FROM issue_feedback GROUP BY rating) x),
    'resolution',(SELECT coalesce(jsonb_object_agg(resolution,n),'{}') FROM (SELECT resolution,count(*) n FROM issue_feedback GROUP BY resolution) x),
    'response_time',(SELECT coalesce(jsonb_object_agg(response_time,n),'{}') FROM (SELECT response_time,count(*) n FROM issue_feedback GROUP BY response_time) x),
    'by_category',(SELECT coalesce(jsonb_agg(jsonb_build_object('category',category,'n',n,'avg',a)),'[]') FROM (SELECT i.category,count(*) n,round(avg(f.rating)::numeric,2) a FROM issue_feedback f JOIN issues i ON i.id=f.issue_id GROUP BY i.category ORDER BY 2 DESC) x),
    'by_month',(SELECT coalesce(jsonb_agg(jsonb_build_object('month',m,'n',n,'avg',a) ORDER BY m),'[]') FROM (SELECT to_char(date_trunc('month',submitted_at),'YYYY-MM') m,count(*) n,round(avg(rating)::numeric,2) a FROM issue_feedback GROUP BY 1) x),
    'comments',(SELECT coalesce(jsonb_agg(jsonb_build_object('rating',f.rating,'comment',f.comment,'category',i.category,'at',f.submitted_at) ORDER BY f.submitted_at DESC),'[]') FROM (SELECT * FROM issue_feedback WHERE comment IS NOT NULL ORDER BY submitted_at DESC LIMIT 50) f JOIN issues i ON i.id=f.issue_id)
  );
END $$;
REVOKE ALL ON FUNCTION public.admin_feedback_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_feedback_summary() TO authenticated, service_role;