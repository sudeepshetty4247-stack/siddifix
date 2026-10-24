ALTER TABLE public.civic_wards
  ADD COLUMN IF NOT EXISTS ward_number integer,
  ADD COLUMN IF NOT EXISTS name_kn text,
  ADD COLUMN IF NOT EXISTS zone text,
  ADD COLUMN IF NOT EXISTS assembly_no integer,
  ADD COLUMN IF NOT EXISTS assembly text,
  ADD COLUMN IF NOT EXISTS mla text,
  ADD COLUMN IF NOT EXISTS mla_party text,
  ADD COLUMN IF NOT EXISTS lok_sabha text,
  ADD COLUMN IF NOT EXISTS mp text,
  ADD COLUMN IF NOT EXISTS population integer;
CREATE UNIQUE INDEX IF NOT EXISTS civic_wards_cov_ident ON public.civic_wards(coverage_id, identifier);