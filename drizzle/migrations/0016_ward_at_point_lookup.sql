create or replace function public.ward_at_point(_lat double precision, _lng double precision)
returns table(name text, ward_number integer, zone text, corporation text)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select w.name, w.ward_number, w.zone, w.corporation
  from public.civic_wards w
  where w.active
    and extensions.ST_Contains(
      extensions.ST_GeomFromGeoJSON(w.boundary::text),
      extensions.ST_SetSRID(extensions.ST_MakePoint(_lng, _lat), 4326)
    )
  order by w.ward_number
  limit 4;
$$;

grant execute on function public.ward_at_point(double precision, double precision) to anon, authenticated, service_role;