create type public.app_role as enum ('admin','staff');
create type public.issue_status as enum ('needs_classification','submitted','under_review','assigned','in_progress','resolved','rejected','reopened','closed');
create type public.issue_severity as enum ('low','medium','high','critical');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id=_user_id and role=_role) $$;

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id=_user_id and role in ('admin','staff')) $$;

create policy "own roles readable" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- first account becomes admin
create or replace function public.handle_first_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role='admin') then
    insert into public.user_roles(user_id, role) values (new.id,'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created_first_admin after insert on auth.users
  for each row execute function public.handle_first_admin();

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  ref_code text not null unique,
  idempotency_key text unique,
  title text not null,
  summary text,
  description text,
  category text not null default 'other',
  subcategory text,
  severity issue_severity not null default 'medium',
  status issue_status not null default 'submitted',
  ai_confidence real,
  safety_warning text,
  lat double precision not null,
  lng double precision not null,
  landmark text,
  photo_url text,
  department text,
  assigned_to uuid,
  duplicate_of uuid references public.issues(id) on delete set null,
  support_count integer not null default 0,
  sla_due_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index issues_status_idx on public.issues(status);
create index issues_geo_idx on public.issues(lat, lng);
grant select on public.issues to anon, authenticated;
grant update on public.issues to authenticated;
grant all on public.issues to service_role;
alter table public.issues enable row level security;
create policy "issues public read" on public.issues for select to anon, authenticated using (true);
create policy "staff update issues" on public.issues for update to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create table public.issue_secrets (
  issue_id uuid primary key references public.issues(id) on delete cascade,
  recovery_token text not null unique,
  created_at timestamptz not null default now()
);
grant all on public.issue_secrets to service_role;
alter table public.issue_secrets enable row level security;

create table public.issue_events (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  kind text not null,
  from_status issue_status,
  to_status issue_status,
  note text,
  actor_id uuid,
  actor_label text,
  created_at timestamptz not null default now()
);
create index issue_events_issue_idx on public.issue_events(issue_id, created_at);
grant select on public.issue_events to anon, authenticated;
grant insert on public.issue_events to authenticated;
grant all on public.issue_events to service_role;
alter table public.issue_events enable row level security;
create policy "events public read" on public.issue_events for select to anon, authenticated using (true);
create policy "staff insert events" on public.issue_events for insert to authenticated
  with check (public.is_staff(auth.uid()) and actor_id = auth.uid());

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now();
  if new.status in ('resolved','closed') and old.status not in ('resolved','closed') then new.resolved_at = now(); end if;
  if new.status in ('reopened') then new.resolved_at = null; end if;
  return new; end $$;
create trigger issues_touch before update on public.issues for each row execute function public.touch_updated_at();

create or replace function public.nearby_issues(_lat double precision, _lng double precision, _radius_m double precision, _category text)
returns table(id uuid, ref_code text, title text, status issue_status, category text, distance_m double precision, created_at timestamptz)
language sql stable set search_path = public as $$
  select * from (
    select i.id, i.ref_code, i.title, i.status, i.category,
      6371000 * 2 * asin(sqrt(power(sin(radians(i.lat-_lat)/2),2) + cos(radians(_lat))*cos(radians(i.lat))*power(sin(radians(i.lng-_lng)/2),2))) as distance_m,
      i.created_at
    from public.issues i
    where i.status not in ('resolved','closed','rejected')
      and (_category is null or i.category = _category)
      and i.lat between _lat - 0.01 and _lat + 0.01
      and i.lng between _lng - 0.01 and _lng + 0.01
  ) s where s.distance_m <= _radius_m order by s.distance_m limit 5
$$;
grant execute on function public.nearby_issues(double precision,double precision,double precision,text) to anon, authenticated;

alter publication supabase_realtime add table public.issues;
alter publication supabase_realtime add table public.issue_events;