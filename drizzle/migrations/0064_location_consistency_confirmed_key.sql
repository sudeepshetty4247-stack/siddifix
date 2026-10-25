DO $lc$ DECLARE s text; BEGIN
s:=pg_get_functiondef('public.create_civic_report(jsonb,text)'::regprocedure);
s:=replace(s,'(_report->''location_consistency''->>''user_confirmed'')','(_report->''location_consistency''->>''userConfirmed'')');
IF s NOT LIKE '%userConfirmed%' THEN RAISE EXCEPTION 'location consistency key patch failed'; END IF;
EXECUTE s; END $lc$;