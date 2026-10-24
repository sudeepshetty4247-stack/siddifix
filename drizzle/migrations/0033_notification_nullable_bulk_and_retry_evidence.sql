ALTER FUNCTION public.set_notification_state(uuid,text) RENAME TO set_notification_state_required;
REVOKE ALL ON FUNCTION public.set_notification_state_required(uuid,text) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.set_notification_state(_action text,_id uuid DEFAULT NULL) RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT public.set_notification_state_required(_id,_action) $$;
REVOKE ALL ON FUNCTION public.set_notification_state(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_notification_state(text,uuid) TO authenticated;
ALTER TABLE public.issue_evidence ADD COLUMN request_key uuid;
CREATE UNIQUE INDEX evidence_request_retry ON public.issue_evidence(actor_id,request_key) WHERE request_key IS NOT NULL;