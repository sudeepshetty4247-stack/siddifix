CREATE OR REPLACE FUNCTION public.nearby_case_summary(_lat double precision, _lng double precision, _radius_m double precision DEFAULT 2000)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
DECLARE result jsonb;
BEGIN
IF _lat IS NULL OR _lng IS NULL OR _radius_m IS NULL OR NOT (_lat BETWEEN -90 AND 90) OR NOT (_lng BETWEEN -180 AND 180) OR NOT (_radius_m BETWEEN 100 AND 10000) THEN RAISE EXCEPTION 'Invalid location or radius'; END IF;
SELECT jsonb_build_object('total',count(*),'active',count(*) FILTER (WHERE status IN ('needs_classification','submitted','under_review','assigned','in_progress','reopened')),'resolved',count(*) FILTER (WHERE status IN ('resolved','closed')),'overdue',count(*) FILTER (WHERE status IN ('needs_classification','submitted','under_review','assigned','in_progress','reopened') AND sla_due_at < now()),'critical',count(*) FILTER (WHERE status IN ('needs_classification','submitted','under_review','assigned','in_progress','reopened') AND severity='critical'),'radius_m',_radius_m)
INTO result FROM public.issues WHERE duplicate_of IS NULL AND
6371000 * 2 * asin(least(1.0,sqrt(power(sin(radians(lat-_lat)/2),2) + cos(radians(_lat))*cos(radians(lat))*power(sin(radians(lng-_lng)/2),2)))) <= _radius_m;
RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.nearby_case_summary(double precision,double precision,double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nearby_case_summary(double precision,double precision,double precision) TO anon, authenticated, service_role;