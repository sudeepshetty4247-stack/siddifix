DO $fix$ DECLARE s text;BEGIN
s:=pg_get_functiondef('public.consume_report_limits(text,text,uuid,text,uuid)'::regprocedure);s:=replace(s,'_user uuid, _phase text','_user uuid DEFAULT NULL::uuid, _phase text DEFAULT ''submit''::text');EXECUTE s;
s:=pg_get_functiondef('public.create_civic_report(jsonb,text)'::regprocedure);s:=replace(s,'IF NOT EXISTS(SELECT 1 FROM public.ward_at_point((_report->>''lat'')::float8,(_report->>''lng'')::float8)) THEN','IF (SELECT count(*) FROM public.ward_at_point((_report->>''lat'')::float8,(_report->>''lng'')::float8))<>1 THEN');EXECUTE s;
END $fix$;