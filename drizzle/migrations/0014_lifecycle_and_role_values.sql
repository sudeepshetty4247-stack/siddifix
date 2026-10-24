ALTER TYPE public.issue_status ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE public.issue_status ADD VALUE IF NOT EXISTS 'inspection_scheduled';
ALTER TYPE public.issue_status ADD VALUE IF NOT EXISTS 'awaiting_verification';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supervisor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'field_worker';