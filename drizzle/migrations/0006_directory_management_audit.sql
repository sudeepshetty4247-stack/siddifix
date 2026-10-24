ALTER TABLE public.civic_wards
  ADD COLUMN IF NOT EXISTS official_name text,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'verification_required',
  ADD COLUMN IF NOT EXISTS representative_status text NOT NULL DEFAULT 'verification_required',
  ADD COLUMN IF NOT EXISTS flags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.civic_wards DROP CONSTRAINT IF EXISTS civic_wards_status_chk;
ALTER TABLE public.civic_wards ADD CONSTRAINT civic_wards_status_chk CHECK (verification_status IN ('verified','verification_required','flagged') AND representative_status IN ('verified','verification_required','flagged'));

CREATE TABLE IF NOT EXISTS public.civic_department_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coverage_id text NOT NULL REFERENCES public.civic_coverage(id),
  category text NOT NULL,
  receiving_office text NOT NULL,
  fixing_team text NOT NULL,
  officer_role text NOT NULL,
  contact_label text,
  contact_phone text,
  source_url text,
  verification_status text NOT NULL DEFAULT 'verification_required' CHECK (verification_status IN ('verified','verification_required','flagged')),
  verified_at date,
  notes text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (coverage_id, category)
);
GRANT SELECT ON public.civic_department_routes TO anon, authenticated;
GRANT INSERT, UPDATE ON public.civic_department_routes TO authenticated;
GRANT ALL ON public.civic_department_routes TO service_role;
ALTER TABLE public.civic_department_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public department routes" ON public.civic_department_routes FOR SELECT TO anon, authenticated USING (active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins insert routes" ON public.civic_department_routes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins update routes" ON public.civic_department_routes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

GRANT SELECT ON public.civic_wards TO anon, authenticated;
GRANT INSERT, UPDATE ON public.civic_wards TO authenticated;
GRANT ALL ON public.civic_wards TO service_role;

CREATE TABLE IF NOT EXISTS public.civic_directory_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL,
  old_row jsonb,
  new_row jsonb,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.civic_directory_audit TO authenticated;
GRANT ALL ON public.civic_directory_audit TO service_role;
ALTER TABLE public.civic_directory_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read directory audit" ON public.civic_directory_audit FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.audit_civic_directory() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN NEW.updated_at := now(); NEW.updated_by := auth.uid(); END IF;
  IF TG_OP = 'INSERT' THEN NEW.updated_by := auth.uid(); END IF;
  INSERT INTO public.civic_directory_audit(table_name, record_id, action, old_row, new_row, actor_id)
  VALUES (TG_TABLE_NAME, NEW.id, TG_OP,
    CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) - 'boundary' ELSE NULL END,
    to_jsonb(NEW) - 'boundary' || CASE WHEN TG_OP='UPDATE' AND OLD.* IS DISTINCT FROM NEW.* AND TG_TABLE_NAME='civic_wards' AND (to_jsonb(OLD)->'boundary') IS DISTINCT FROM (to_jsonb(NEW)->'boundary') THEN '{"boundary_changed":true}'::jsonb ELSE '{}'::jsonb END,
    auth.uid());
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS audit_civic_wards ON public.civic_wards;
CREATE TRIGGER audit_civic_wards BEFORE INSERT OR UPDATE ON public.civic_wards FOR EACH ROW EXECUTE FUNCTION public.audit_civic_directory();
DROP TRIGGER IF EXISTS audit_civic_routes ON public.civic_department_routes;
CREATE TRIGGER audit_civic_routes BEFORE INSERT OR UPDATE ON public.civic_department_routes FOR EACH ROW EXECUTE FUNCTION public.audit_civic_directory();

CREATE OR REPLACE FUNCTION public.ward_case_counts() RETURNS TABLE(ward_identifier text, reports bigint, unique_issues bigint, unresolved bigint, resolved bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT routing_snapshot->'ward'->>'identifier',
    count(*),
    count(*) FILTER (WHERE duplicate_of IS NULL),
    count(*) FILTER (WHERE duplicate_of IS NULL AND status NOT IN ('resolved','closed','rejected')),
    count(*) FILTER (WHERE duplicate_of IS NULL AND status IN ('resolved','closed'))
  FROM public.issues
  WHERE routing_snapshot->'ward'->>'identifier' IS NOT NULL
  GROUP BY 1
$$;
GRANT EXECUTE ON FUNCTION public.ward_case_counts() TO anon, authenticated;