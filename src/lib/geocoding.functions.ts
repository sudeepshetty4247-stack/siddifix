import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

// OpenStreetMap Nominatim: a configured hosted instance is preferred; otherwise the public
// endpoint is used within its usage policy (identifying User-Agent, on-demand only, no
// autocomplete, per-person request limits, OSM attribution).
const PUBLIC_ENDPOINT = 'https://nominatim.openstreetmap.org/';
const USER_AGENT = 'CivicFix-Bengaluru/1.0 (civic issue reporting)';
const ATTRIBUTION = 'https://www.openstreetmap.org/copyright';
// Greater Bengaluru search box (lon,lat,lon,lat)
const VIEWBOX = '77.30,13.25,77.90,12.70';

function endpoint(path: string) {
  const configured = process.env['CIVICFIX_NOMINATIM_URL'];
  const base = configured && configured.startsWith('https://') ? configured : PUBLIC_ENDPOINT;
  return new URL(path, base.endsWith('/') ? base : `${base}/`);
}

async function limited(kind: string, limit: number) {
  try { const { consumeRequest } = await import('./civic-security.server'); await consumeRequest(kind, limit); return true; }
  catch { return false; }
}

function shortLabel(address: Record<string, string> | undefined, display: string) {
  if (!address) return display;
  const parts = [address['road'] ?? address['railway'] ?? address['amenity'] ?? address['residential'], address['neighbourhood'] ?? address['suburb'] ?? address['quarter'], address['city_district'] ?? address['city'], address['postcode']].filter(Boolean);
  return parts.length >= 2 ? Array.from(new Set(parts)).join(', ') : display;
}

export const reverseGeocode = createServerFn({ method: 'POST' })
  .inputValidator((input: { lat: number; lng: number }) => z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).parse(input))
  .handler(async ({ data }) => {
    if (!(await limited('reverse-geocode', 60))) return { address: null, area: null, sourceUrl: null, checkedAt: null, notice: 'Too many place lookups. Your confirmed pin remains usable.' };
    const url = endpoint('reverse');
    url.search = new URLSearchParams({ lat: String(data.lat), lon: String(data.lng), format: 'jsonv2', zoom: '18', addressdetails: '1', 'accept-language': 'en' }).toString();
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': USER_AGENT, Referer: 'https://civicfix.lovable.app' } });
      if (!response.ok) return { address: null, area: null, sourceUrl: null, checkedAt: null, notice: `Place lookup unavailable (${response.status}). Your report can still be submitted.` };
      const result = z.object({ display_name: z.string().max(1000).optional(), address: z.record(z.string(), z.string()).optional() }).parse(await response.json());
      const a = result.address;
      const area = a ? (a['suburb'] ?? a['neighbourhood'] ?? a['quarter'] ?? a['city_district'] ?? null) : null;
      return { address: result.display_name ? shortLabel(a, result.display_name) : null, area, sourceUrl: ATTRIBUTION, checkedAt: new Date().toISOString(), notice: result.display_name ? null : 'No street address found. Ward matching still uses the confirmed coordinates.' };
    } catch {
      return { address: null, area: null, sourceUrl: null, checkedAt: null, notice: 'Place lookup is unavailable. Your report can still be submitted.' };
    }
  });

export const searchAddress = createServerFn({ method: 'POST' })
  .inputValidator((input: { query: string }) => z.object({ query: z.string().trim().min(3).max(160) }).parse(input))
  .handler(async ({ data }) => {
    const empty = { results: [] as { lat: number; lng: number; label: string }[], notice: 'No matching Bengaluru place found. Try a nearby landmark or place a pin.' as string | null };
    if (!(await limited('address-search', 30))) return { ...empty, notice: 'Too many searches. Please wait a few minutes or place a pin.' };
    const url = endpoint('search');
    url.search = new URLSearchParams({ q: data.query, format: 'jsonv2', limit: '6', countrycodes: 'in', viewbox: VIEWBOX, bounded: '1', addressdetails: '1', 'accept-language': 'en' }).toString();
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': USER_AGENT, Referer: 'https://civicfix.lovable.app' } });
      if (!r.ok) return { ...empty, notice: 'Address search is unavailable right now. Place a pin instead.' };
      const rows = z.array(z.object({ lat: z.string(), lon: z.string(), display_name: z.string().max(1000), name: z.string().optional(), address: z.record(z.string(), z.string()).optional() })).parse(await r.json());
      const results = rows.map(row => ({ lat: Number(row.lat), lng: Number(row.lon), label: [row.name, shortLabel(row.address, row.display_name)].filter(Boolean).filter((v, i, all) => all.indexOf(v) === i).join(' · ') }))
        .filter(row => Number.isFinite(row.lat) && Number.isFinite(row.lng))
        .filter((row, i, all) => all.findIndex(o => Math.abs(o.lat - row.lat) < 0.0005 && Math.abs(o.lng - row.lng) < 0.0005) === i);
      return { results, notice: results.length ? null : empty.notice };
    } catch { return { ...empty, notice: 'Address search is unavailable right now. Place a pin instead.' }; }
  });
