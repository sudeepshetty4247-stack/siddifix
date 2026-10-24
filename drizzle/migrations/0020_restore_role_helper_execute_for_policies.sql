
-- Row-level security policies call these read-only role helpers for every visitor,
-- including anonymous ones. They must stay executable by everyone or policy
-- evaluation itself fails. They reveal nothing beyond a boolean/label and are safe.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_supervisor(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_can_work(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_actor_label(uuid) TO anon, authenticated;
