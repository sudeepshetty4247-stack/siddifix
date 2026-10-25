CREATE OR REPLACE FUNCTION public.admin_provision_account(_user uuid,_role text,_profile jsonb,_actor uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE areas text[]; BEGIN
 IF NOT public.account_active(_actor) OR NOT public.has_role(_actor,'admin') OR _role NOT IN ('admin','supervisor','field_worker') OR NOT EXISTS(SELECT 1 FROM admin_permissions WHERE user_id=_actor AND is_super_admin) THEN RAISE EXCEPTION 'Active Super Admin required for provisioning'; END IF;
 IF _role='admin' AND NOT public.can_manage_admins(_actor) THEN RAISE EXCEPTION 'Administrator creation not delegated'; END IF;
 areas:=CASE WHEN _profile ? 'coverageIds' THEN ARRAY(SELECT jsonb_array_elements_text(_profile->'coverageIds')) ELSE ARRAY['bengaluru']::text[] END;
 IF cardinality(areas)=0 OR EXISTS(SELECT 1 FROM unnest(areas) a WHERE NOT EXISTS(SELECT 1 FROM civic_coverage c WHERE c.id=a AND c.enabled)) THEN RAISE EXCEPTION 'Configured service areas required'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(_profile->'teamIds','[]'::jsonb)) a WHERE NOT EXISTS(SELECT 1 FROM civic_teams t WHERE t.id=a::uuid AND t.active AND t.coverage_id=ANY(areas))) THEN RAISE EXCEPTION 'Team outside provisioned service areas'; END IF;
 IF _role<>'admin' AND (coalesce(jsonb_array_length(_profile->'categories'),0)=0 OR NOT EXISTS(SELECT 1 FROM civic_teams t WHERE t.active AND t.coverage_id=ANY(areas) AND t.department=_profile->>'department')) THEN RAISE EXCEPTION 'Configured department and categories required'; END IF;
 INSERT INTO user_roles(user_id,role) VALUES(_user,_role::app_role);
 INSERT INTO staff_profiles(user_id,display_name,designation,department,categories,wards,team_ids,corporations,coverage_ids,created_by,updated_by) VALUES(_user,_profile->>'fullName',_profile->>'designation',_profile->>'department',ARRAY(SELECT jsonb_array_elements_text(_profile->'categories')),ARRAY(SELECT jsonb_array_elements_text(_profile->'wards')),ARRAY(SELECT jsonb_array_elements_text(_profile->'teamIds'))::uuid[],ARRAY(SELECT jsonb_array_elements_text(_profile->'corporations')),areas,_actor,_actor);
 IF _role<>'admin' THEN PERFORM validate_provisioned_staff_scope(_user); END IF;
 IF _role='admin' THEN INSERT INTO admin_permissions(user_id,created_by,coverage_ids) VALUES(_user,_actor,areas); END IF;
 INSERT INTO civic_directory_audit(table_name,record_id,action,actor_id,new_row) VALUES('staff_accounts',_user,'invited',_actor,jsonb_build_object('role',_role,'department',_profile->>'department','coverage_ids',areas));
END $$;
REVOKE ALL ON FUNCTION public.admin_provision_account(uuid,text,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_provision_account(uuid,text,jsonb,uuid) TO service_role;