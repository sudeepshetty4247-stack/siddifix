import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import type { Directory } from './directory';

export const getDirectory = createServerFn({ method: 'GET' }).handler(async (): Promise<Directory> => {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) throw new Error('The civic directory is temporarily unavailable.');
  const client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => {
    const headers = new Headers(init?.headers);
    if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
    headers.set('apikey', key);
    return fetch(input, { ...init, headers });
  } } });
  const [coverage, authorities, rules, wards, routes] = await Promise.all([
    client.from('civic_coverage').select('id,name,state,bounds,notice,source_url,verified_at'),
    client.from('civic_authorities').select('id,coverage_id,name,kind,website_url,reporting_url,phone,source_url,verified_at,notes'),
    client.from('civic_service_rules').select('authority_id,category,subcategory,notes,confidence'),
    client.from('civic_wards').select('id,name,identifier,corporation,boundary,source_url,verified_at,source_published_at,source_checked_at,source_sha256,representative,representative_source_url,ward_number,name_kn,official_name,zone,assembly_no,assembly,mla,mla_party,lok_sabha,mp,population,verification_status,representative_status,flags,notes,active').range(0, 999),
    client.from('civic_department_routes').select('id,coverage_id,category,receiving_office,fixing_team,officer_role,contact_label,contact_phone,source_url,verification_status,verified_at,notes,active'),
  ]);
  for (const result of [coverage, authorities, rules, wards, routes]) if (result.error) throw new Error('The civic directory could not be loaded.');
  return { coverage: coverage.data ?? [], authorities: authorities.data ?? [], rules: rules.data ?? [], wards: wards.data ?? [], routes: routes.data ?? [] };
});

const WARD_COLUMNS = 'id,name,identifier,corporation,boundary,source_url,verified_at,source_published_at,source_checked_at,source_sha256,representative,representative_source_url,ward_number,name_kn,official_name,zone,assembly_no,assembly,mla,mla_party,lok_sabha,mp,population,verification_status,representative_status,flags,notes,active';

// Lightweight local lookup: resolves the ward at a point in the database and
// downloads only that ward instead of every boundary (the full set is ~4 MB).
export const getLocalDirectory = createServerFn({ method: 'GET' })
  .inputValidator((input: { lat: number; lng: number }) => input)
  .handler(async ({ data }): Promise<Directory> => {
    const url = process.env['SUPABASE_URL'];
    const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
    if (!url || !key) throw new Error('The civic directory is temporarily unavailable.');
    const client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
      headers.set('apikey', key);
      return fetch(input, { ...init, headers });
    } } });
    const atPoint = await client.rpc('ward_at_point', { _lat: data.lat, _lng: data.lng });
    if (atPoint.error) throw new Error('The civic directory could not be loaded.');
    const hit = atPoint.data?.[0];
    const wardQ = hit
      ? await client.from('civic_wards').select(WARD_COLUMNS).eq('ward_number', hit.ward_number).eq('corporation', hit.corporation).limit(1)
      : { data: [], error: null };
    if (wardQ.error) throw new Error('The civic directory could not be loaded.');
    const [coverage, authorities, rules, routes] = await Promise.all([
      client.from('civic_coverage').select('id,name,state,bounds,notice,source_url,verified_at'),
      client.from('civic_authorities').select('id,coverage_id,name,kind,website_url,reporting_url,phone,source_url,verified_at,notes'),
      client.from('civic_service_rules').select('authority_id,category,subcategory,notes,confidence'),
      client.from('civic_department_routes').select('id,coverage_id,category,receiving_office,fixing_team,officer_role,contact_label,contact_phone,source_url,verification_status,verified_at,notes,active'),
    ]);
    for (const result of [coverage, authorities, rules, routes]) if (result.error) throw new Error('The civic directory could not be loaded.');
    return { coverage: coverage.data ?? [], authorities: authorities.data ?? [], rules: rules.data ?? [], wards: wardQ.data ?? [], routes: routes.data ?? [] };
  });