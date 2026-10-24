CREATE TABLE IF NOT EXISTS public.staff_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  designation text NOT NULL DEFAULT 'CivicFix staff',
  department text NOT NULL DEFAULT '',
  categories text[] NOT NULL DEFAULT '{}',
  wards text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.staff_profiles TO authenticated;
GRANT ALL ON public.staff_profiles TO service_role;
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ select exists (select 1 from public.user_roles where user_id=_user_id and role::text in ('admin','staff','supervisor','field_worker')) $$;

CREATE OR REPLACE FUNCTION public.is_supervisor(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ select exists (select 1 from public.user_roles where user_id=_user_id and role::text in ('admin','supervisor','staff')) $$;

CREATE POLICY "staff read staff profiles" ON public.staff_profiles FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS acknowledged_by uuid;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS ack_message text;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS eta_at timestamptz;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS inspection_at timestamptz;

CREATE TABLE IF NOT EXISTS public.issue_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  audience text NOT NULL,
  channel text NOT NULL,
  status text NOT NULL,
  detail text NOT NULL DEFAULT '',
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT issue_notifications_audience CHECK (audience IN ('citizen','authority','supervisor')),
  CONSTRAINT issue_notifications_status CHECK (status IN ('queued','posted','sent','delivered','acknowledged','failed','not_configured'))
);
GRANT SELECT ON public.issue_notifications TO authenticated;
GRANT ALL ON public.issue_notifications TO service_role;
ALTER TABLE public.issue_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read notifications" ON public.issue_notifications FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.record_issue_notification() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.kind='created' THEN
    INSERT INTO public.issue_notifications(issue_id,audience,channel,status,detail) VALUES (NEW.issue_id,'authority','none','not_configured','No authorized external government channel is configured. Report is saved in the CivicFix staff queue; manual handoff required.');
  ELSIF NEW.kind IN ('acknowledged','eta_changed','status_change') THEN
    INSERT INTO public.issue_notifications(issue_id,audience,channel,status,detail,attempts) VALUES (NEW.issue_id,'citizen','in_app','posted',CASE NEW.kind WHEN 'acknowledged' THEN 'Acknowledgement shown on the tracking page' WHEN 'eta_changed' THEN 'Updated completion estimate shown on the tracking page' ELSE 'Status update shown on the tracking page' END,1);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS issue_events_notify ON public.issue_events;
CREATE TRIGGER issue_events_notify AFTER INSERT ON public.issue_events FOR EACH ROW EXECUTE FUNCTION public.record_issue_notification();

CREATE OR REPLACE FUNCTION public.staff_can_work(_user_id uuid, _issue uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_supervisor(_user_id) OR EXISTS (
    SELECT 1 FROM public.issues i
    JOIN public.user_roles r ON r.user_id=_user_id AND r.role::text='field_worker'
    LEFT JOIN public.staff_profiles p ON p.user_id=_user_id
    WHERE i.id=_issue
      AND (p.user_id IS NULL OR cardinality(p.categories)=0 OR i.category=ANY(p.categories))
      AND (p.user_id IS NULL OR cardinality(p.wards)=0 OR (i.routing_snapshot->'ward'->>'identifier')=ANY(p.wards)))
$$;

CREATE OR REPLACE FUNCTION public.staff_actor_label(_user_id uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce((SELECT nullif(trim(concat_ws(' · ', nullif(display_name,''), nullif(designation,''), nullif(department,''))),'') FROM public.staff_profiles WHERE user_id=_user_id),'CivicFix staff')
$$;

CREATE OR REPLACE FUNCTION public.staff_change_issue(_id uuid, _expected issue_status, _next issue_status, _note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE current_status public.issue_status; allowed text[]; sup boolean;
BEGIN
 IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Staff access required'; END IF;
 IF NOT public.staff_can_work(auth.uid(), _id) THEN RAISE EXCEPTION 'This case is outside your assigned categories or wards'; END IF;
 sup := public.is_supervisor(auth.uid());
 SELECT status INTO current_status FROM public.issues WHERE id=_id FOR UPDATE;
 IF current_status IS NULL THEN RAISE EXCEPTION 'Issue not found'; END IF;
 IF current_status<>_expected THEN RAISE EXCEPTION 'This issue changed. Refresh before continuing.'; END IF;
 allowed := CASE current_status::text
   WHEN 'needs_classification' THEN ARRAY['under_review','rejected']
   WHEN 'submitted' THEN ARRAY['under_review','assigned','accepted','rejected']
   WHEN 'under_review' THEN ARRAY['assigned','accepted','rejected']
   WHEN 'assigned' THEN ARRAY['accepted','inspection_scheduled','in_progress','under_review','rejected']
   WHEN 'accepted' THEN ARRAY['inspection_scheduled','in_progress','assigned']
   WHEN 'inspection_scheduled' THEN ARRAY['in_progress','assigned']
   WHEN 'in_progress' THEN ARRAY['awaiting_verification','resolved','assigned']
   WHEN 'awaiting_verification' THEN ARRAY['resolved','in_progress']
   WHEN 'resolved' THEN ARRAY['closed','reopened']
   WHEN 'rejected' THEN ARRAY['reopened']
   WHEN 'reopened' THEN ARRAY['under_review','assigned','accepted','in_progress']
   WHEN 'closed' THEN ARRAY['reopened']
   ELSE ARRAY[]::text[] END;
 IF NOT (_next::text=ANY(allowed)) THEN RAISE EXCEPTION 'Invalid status transition'; END IF;
 IF NOT sup AND _next::text IN ('assigned','rejected','closed','under_review','reopened') THEN RAISE EXCEPTION 'A supervisor must make this decision'; END IF;
 IF _next::text IN ('resolved','rejected','awaiting_verification') AND length(trim(coalesce(_note,'')))<5 THEN RAISE EXCEPTION 'A reason or work summary of at least 5 characters is required'; END IF;
 IF length(coalesce(_note,''))>1000 THEN RAISE EXCEPTION 'Note is too long'; END IF;
 UPDATE public.issues SET status=_next,
   acknowledged_at=CASE WHEN _next::text='accepted' AND acknowledged_at IS NULL THEN now() ELSE acknowledged_at END,
   acknowledged_by=CASE WHEN _next::text='accepted' AND acknowledged_by IS NULL THEN auth.uid() ELSE acknowledged_by END,
   resolved_at=CASE WHEN _next::text='resolved' THEN now() ELSE resolved_at END
 WHERE id=_id;
 INSERT INTO public.issue_events(issue_id,kind,from_status,to_status,note,actor_id,actor_label) VALUES(_id,'status_change',current_status,_next,nullif(trim(_note),''),auth.uid(),public.staff_actor_label(auth.uid()));
END $$;

CREATE OR REPLACE FUNCTION public.staff_acknowledge_issue(_id uuid, _expected issue_status, _message text, _eta timestamptz, _inspection timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.issues; nxt public.issue_status;
BEGIN
 IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Staff access required'; END IF;
 IF NOT public.staff_can_work(auth.uid(), _id) THEN RAISE EXCEPTION 'This case is outside your assigned categories or wards'; END IF;
 SELECT * INTO r FROM public.issues WHERE id=_id FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Issue not found'; END IF;
 IF r.duplicate_of IS NOT NULL THEN RAISE EXCEPTION 'Acknowledge the canonical issue instead of a merged report'; END IF;
 IF r.status<>_expected THEN RAISE EXCEPTION 'This issue changed. Refresh before continuing.'; END IF;
 IF r.status::text NOT IN ('submitted','under_review','assigned','reopened') THEN RAISE EXCEPTION 'This case cannot be acknowledged in its current status'; END IF;
 IF length(trim(coalesce(_message,'')))<10 OR length(_message)>1000 THEN RAISE EXCEPTION 'Write a response of 10 to 1000 characters'; END IF;
 IF _eta IS NOT NULL AND _eta < now() THEN RAISE EXCEPTION 'Estimated completion must be in the future'; END IF;
 IF _inspection IS NOT NULL AND _inspection < now() - interval '1 hour' THEN RAISE EXCEPTION 'Inspection time must be in the future'; END IF;
 IF _inspection IS NOT NULL AND _eta IS NOT NULL AND _inspection > _eta THEN RAISE EXCEPTION 'Inspection must be before the completion estimate'; END IF;
 nxt := CASE WHEN _inspection IS NOT NULL THEN 'inspection_scheduled'::public.issue_status ELSE 'accepted'::public.issue_status END;
 UPDATE public.issues SET status=nxt, acknowledged_at=now(), acknowledged_by=auth.uid(), ack_message=trim(_message), eta_at=_eta, inspection_at=_inspection WHERE id=_id;
 INSERT INTO public.issue_events(issue_id,kind,from_status,to_status,note,actor_id,actor_label) VALUES(_id,'acknowledged',r.status,nxt,trim(_message),auth.uid(),public.staff_actor_label(auth.uid()));
END $$;

CREATE OR REPLACE FUNCTION public.staff_update_eta(_id uuid, _eta timestamptz, _reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.issues;
BEGIN
 IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Staff access required'; END IF;
 IF NOT public.staff_can_work(auth.uid(), _id) THEN RAISE EXCEPTION 'This case is outside your assigned categories or wards'; END IF;
 SELECT * INTO r FROM public.issues WHERE id=_id FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Issue not found'; END IF;
 IF r.acknowledged_at IS NULL THEN RAISE EXCEPTION 'Acknowledge the case before setting an estimate'; END IF;
 IF r.status::text IN ('resolved','closed','rejected') THEN RAISE EXCEPTION 'This case is no longer open'; END IF;
 IF _eta IS NULL OR _eta < now() THEN RAISE EXCEPTION 'Estimated completion must be in the future'; END IF;
 IF length(trim(coalesce(_reason,'')))<5 OR length(_reason)>500 THEN RAISE EXCEPTION 'Give a reason of at least 5 characters'; END IF;
 UPDATE public.issues SET eta_at=_eta WHERE id=_id;
 INSERT INTO public.issue_events(issue_id,kind,note,actor_id,actor_label) VALUES(_id,'eta_changed',concat('Estimated completion ',CASE WHEN r.eta_at IS NULL THEN 'set' ELSE 'changed' END,' to ',to_char(_eta AT TIME ZONE 'Asia/Kolkata','DD Mon YYYY HH24:MI'),' IST. Reason: ',trim(_reason)),auth.uid(),public.staff_actor_label(auth.uid()));
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_staff_profile(_user uuid, _name text, _designation text, _department text, _categories text[], _wards text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Only administrators can edit staff profiles'; END IF;
 IF length(coalesce(_name,''))>120 OR length(coalesce(_designation,''))>120 OR length(coalesce(_department,''))>160 THEN RAISE EXCEPTION 'Profile text is too long'; END IF;
 INSERT INTO public.staff_profiles(user_id,display_name,designation,department,categories,wards,updated_at)
 VALUES(_user,trim(coalesce(_name,'')),coalesce(nullif(trim(_designation),''),'CivicFix staff'),trim(coalesce(_department,'')),coalesce(_categories,'{}'),coalesce(_wards,'{}'),now())
 ON CONFLICT (user_id) DO UPDATE SET display_name=EXCLUDED.display_name,designation=EXCLUDED.designation,department=EXCLUDED.department,categories=EXCLUDED.categories,wards=EXCLUDED.wards,updated_at=now();
END $$;

CREATE OR REPLACE FUNCTION public.public_case_rows(_ref text DEFAULT NULL::text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT coalesce(jsonb_agg(row),'[]'::jsonb) FROM (SELECT i.id,i.ref_code,i.title,i.summary,i.description,i.category,i.subcategory,i.severity,i.status,i.safety_warning,i.lat,i.lng,i.landmark,i.photo_url,i.department,i.support_count,i.sla_due_at,i.resolved_at,i.created_at,i.updated_at,i.duplicate_of,i.duplicate_candidate_id,i.routing_snapshot,i.acknowledged_at,i.ack_message,i.eta_at,i.inspection_at,
  CASE WHEN i.acknowledged_by IS NULL THEN NULL ELSE public.staff_actor_label(i.acknowledged_by) END AS acknowledged_by_label
  FROM public.issues i WHERE _ref IS NULL OR i.ref_code=_ref ORDER BY i.created_at DESC LIMIT 1000) row $$;

CREATE OR REPLACE FUNCTION public.public_case_events(_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT coalesce(jsonb_agg(row ORDER BY row.created_at),'[]'::jsonb) FROM (SELECT id,issue_id,kind,from_status,to_status,
  CASE WHEN kind='created' THEN 'Report recorded in CivicFix. No government delivery recorded.'
       WHEN kind IN ('acknowledged','eta_changed') THEN note
       WHEN kind='status_change' THEN coalesce(note,'Status updated by CivicFix staff.')
       WHEN kind LIKE 'assignment_%' THEN 'Internal CivicFix assignment updated; not government acknowledgement.'
       WHEN kind LIKE 'duplicate_%' THEN 'Duplicate review recorded; original report retained.'
       WHEN kind='citizen_confirmed' THEN 'Reporter confirmed the fix.'
       WHEN kind='disputed' THEN 'Reporter requested another review.'
       WHEN kind LIKE 'evidence_%' THEN 'Evidence recorded by CivicFix staff.'
       ELSE 'Case updated by CivicFix staff.' END AS note,
  CASE WHEN actor_id IS NOT NULL THEN public.staff_actor_label(actor_id) ELSE actor_label END AS actor_label, created_at
  FROM public.issue_events WHERE issue_id=_id) row $$;

CREATE OR REPLACE FUNCTION public.nearby_case_summary(_lat double precision, _lng double precision, _radius_m double precision DEFAULT 2000) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ DECLARE result jsonb; BEGIN IF _lat IS NULL OR _lng IS NULL OR _radius_m IS NULL OR NOT (_lat BETWEEN -90 AND 90) OR NOT (_lng BETWEEN -180 AND 180) OR NOT (_radius_m BETWEEN 100 AND 10000) THEN RAISE EXCEPTION 'Invalid location or radius'; END IF;
SELECT jsonb_build_object('total',count(*),'active',count(*) FILTER(WHERE status::text NOT IN ('resolved','closed','rejected')),'resolved',count(*) FILTER(WHERE status::text IN ('resolved','closed')),'overdue',count(*) FILTER(WHERE status::text NOT IN ('resolved','closed','rejected') AND coalesce(eta_at,sla_due_at)<now()),'critical',count(*) FILTER(WHERE status::text NOT IN ('resolved','closed','rejected') AND severity='critical'),'radius_m',_radius_m) INTO result FROM public.issues WHERE duplicate_of IS NULL AND 6371000*2*asin(least(1.0,sqrt(power(sin(radians(lat-_lat)/2),2)+cos(radians(_lat))*cos(radians(lat))*power(sin(radians(lng-_lng)/2),2))))<=_radius_m; RETURN result; END $$;

CREATE OR REPLACE FUNCTION public.civic_case_metrics() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE result jsonb;
BEGIN
IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Staff access required'; END IF;
SELECT jsonb_build_object(
 'total_reports',count(*),
 'canonical_issues',count(*) FILTER(WHERE duplicate_of IS NULL),
 'duplicate_rate',CASE WHEN count(*)=0 THEN 0 ELSE round(100.0*count(*) FILTER(WHERE duplicate_of IS NOT NULL)/count(*),2) END,
 'pending',count(*) FILTER(WHERE duplicate_of IS NULL AND status::text NOT IN ('resolved','closed','rejected')),
 'resolved',count(*) FILTER(WHERE duplicate_of IS NULL AND status::text IN ('resolved','closed')),
 'resolution_rate',CASE WHEN count(*) FILTER(WHERE duplicate_of IS NULL)=0 THEN 0 ELSE round(100.0*count(*) FILTER(WHERE duplicate_of IS NULL AND status::text IN ('resolved','closed'))/count(*) FILTER(WHERE duplicate_of IS NULL),2) END,
 'overdue',count(*) FILTER(WHERE duplicate_of IS NULL AND status::text NOT IN ('resolved','closed','rejected') AND sla_due_at<now()),
 'eta_overdue',count(*) FILTER(WHERE duplicate_of IS NULL AND status::text NOT IN ('resolved','closed','rejected') AND eta_at<now()),
 'awaiting_ack',count(*) FILTER(WHERE duplicate_of IS NULL AND acknowledged_at IS NULL AND status::text NOT IN ('resolved','closed','rejected')),
 'average_ack_hours',avg(extract(epoch FROM acknowledged_at-created_at)/3600) FILTER(WHERE duplicate_of IS NULL AND acknowledged_at IS NOT NULL),
 'eta_met',count(*) FILTER(WHERE duplicate_of IS NULL AND eta_at IS NOT NULL AND resolved_at IS NOT NULL AND resolved_at<=eta_at),
 'eta_with_outcome',count(*) FILTER(WHERE duplicate_of IS NULL AND eta_at IS NOT NULL AND (resolved_at IS NOT NULL OR eta_at<now())),
 'reopened',count(*) FILTER(WHERE duplicate_of IS NULL AND status='reopened'),
 'average_resolution_hours',avg(extract(epoch FROM resolved_at-created_at)/3600) FILTER(WHERE duplicate_of IS NULL AND status::text IN ('resolved','closed') AND resolved_at IS NOT NULL)) INTO result FROM public.issues;
RETURN result || jsonb_build_object('status_distribution',(SELECT coalesce(jsonb_object_agg(status,n),'{}'::jsonb) FROM (SELECT status,count(*) n FROM public.issues WHERE duplicate_of IS NULL GROUP BY status) s));
END $$;

REVOKE ALL ON FUNCTION public.staff_acknowledge_issue(uuid, issue_status, text, timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_update_eta(uuid, timestamptz, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_staff_profile(uuid, text, text, text, text[], text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_acknowledge_issue(uuid, issue_status, text, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_update_eta(uuid, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_staff_profile(uuid, text, text, text, text[], text[]) TO authenticated;