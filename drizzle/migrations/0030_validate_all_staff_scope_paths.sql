DO $$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='admin_set_staff_profile';
 d:=replace(d,' UPDATE public.staff_profiles', E' IF EXISTS(SELECT 1 FROM unnest(_wards) w WHERE NOT EXISTS(SELECT 1 FROM public.civic_wards WHERE identifier=w AND active)) OR EXISTS(SELECT 1 FROM unnest(_categories) c WHERE c NOT IN (''roads'',''electricity'',''water'',''drainage'',''waste'',''transport'',''parks'',''sanitation'',''trees'',''buildings'',''other'')) THEN RAISE EXCEPTION ''Select configured categories and wards''; END IF;\n UPDATE public.staff_profiles'); EXECUTE d;
 SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='admin_set_team_scope';
 d:=replace(d,' UPDATE public.staff_profiles', E' IF EXISTS(SELECT 1 FROM unnest(_corporations) c WHERE NOT EXISTS(SELECT 1 FROM public.civic_wards WHERE corporation=c AND active)) THEN RAISE EXCEPTION ''Select configured corporations''; END IF;\n UPDATE public.staff_profiles'); EXECUTE d;
 SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='admin_provision_account';
 d:=replace(d,' IF _role=''admin'' THEN INSERT', E' IF _role<>''admin'' THEN PERFORM public.validate_provisioned_staff_scope(_user); END IF;\n IF _role=''admin'' THEN INSERT');
 EXECUTE d;
END $$;
CREATE OR REPLACE FUNCTION public.validate_provisioned_staff_scope(_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE p public.staff_profiles; BEGIN
 SELECT * INTO p FROM public.staff_profiles WHERE user_id=_user;
 IF EXISTS(SELECT 1 FROM unnest(p.wards) w WHERE NOT EXISTS(SELECT 1 FROM public.civic_wards WHERE identifier=w AND active)) OR EXISTS(SELECT 1 FROM unnest(p.corporations) c WHERE NOT EXISTS(SELECT 1 FROM public.civic_wards WHERE corporation=c AND active)) THEN RAISE EXCEPTION 'Configured jurisdictions required'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(p.categories) c WHERE c NOT IN ('roads','electricity','water','drainage','waste','transport','parks','sanitation','trees','buildings','other')) OR NOT EXISTS(SELECT 1 FROM public.civic_teams t WHERE t.active AND t.department=p.department AND p.categories<@t.categories) OR EXISTS(SELECT 1 FROM unnest(p.team_ids) a WHERE NOT EXISTS(SELECT 1 FROM public.civic_teams t WHERE t.id=a AND t.active AND t.department=p.department AND p.categories<@t.categories)) THEN RAISE EXCEPTION 'Configured teams and categories required'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.validate_provisioned_staff_scope(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.validate_provisioned_staff_scope(uuid) TO service_role;