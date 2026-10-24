CREATE OR REPLACE FUNCTION public.review_directory_fetch(_id uuid,_approve boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j civic_directory_jobs%ROWTYPE;
BEGIN
 IF NOT has_role(auth.uid(),'admin') OR NOT account_active(auth.uid()) THEN RAISE EXCEPTION 'Active administrator access required'; END IF;
 SELECT * INTO j FROM civic_directory_jobs WHERE id=_id FOR UPDATE;
 IF NOT FOUND OR j.status<>'review' THEN RAISE EXCEPTION 'Candidate is not ready for review'; END IF;
 IF _approve THEN
  IF j.kind='portrait' THEN
   IF j.storage_path IS NULL OR j.sha256 IS NULL OR j.credit IS NULL OR j.license_url IS NULL THEN RAISE EXCEPTION 'Missing portrait evidence'; END IF;
   UPDATE civic_people SET photo_url='/api/public/officer-portrait/'||j.storage_path,photo_source_url=j.source_url,photo_verified=true,photo_verified_at=current_date,photo_source_type='reviewed licensed source',photo_credit=j.credit,photo_license_url=j.license_url,photo_usage_notes=j.identity_evidence,updated_by=auth.uid(),updated_at=now() WHERE id=j.person_id;
  ELSE
   IF j.contact_phone IS NULL AND j.contact_email IS NULL THEN RAISE EXCEPTION 'No verified public-duty contact candidate'; END IF;
   UPDATE civic_people SET contact_phone=coalesce(j.contact_phone,contact_phone),contact_email=coalesce(j.contact_email,contact_email),source_url=j.source_url,checked_at=now(),updated_by=auth.uid(),updated_at=now() WHERE id=j.person_id;
  END IF;
 END IF;
 UPDATE civic_directory_jobs SET status=CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,reviewed_by=auth.uid(),updated_at=now() WHERE id=_id;
END $$;
REVOKE ALL ON FUNCTION public.review_directory_fetch(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_directory_fetch(uuid,boolean) TO authenticated,service_role;