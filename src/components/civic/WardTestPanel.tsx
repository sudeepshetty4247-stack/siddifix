import { useState } from 'react';
import { MapPin, FlaskConical } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getDirectory } from '@/lib/directory.functions';
import { CATEGORIES } from '@/lib/civic';
import { TEST_LOCATIONS, wardPreviewPoint } from '@/lib/bengaluru-map';
import { CivicInfo } from './CivicInfo';
import { Button } from '@/components/ui/button';

export function WardTestPanel({ onLocate }: { onLocate: (point: { lat: number; lng: number }) => void }) {
  const dir = useQuery({ queryKey: ['civic-directory'], queryFn: () => getDirectory(), staleTime: 300000 });
  const [point, setPoint] = useState<{ lat: number; lng: number }>(TEST_LOCATIONS[0]);
  const [category, setCategory] = useState<string>('waste');
  const [scenario, setScenario] = useState('central');
  return <div className="space-y-4">
    <p className="flex items-center gap-2 text-sm font-semibold text-warning-foreground"><FlaskConical className="h-4 w-4" />Test preview · no report is created</p>
    <label className="block text-sm font-medium">Test location<select aria-label="Test location" value={scenario} className="mt-1 block h-10 w-full rounded-lg border bg-card px-2" onChange={e => {
      const test = TEST_LOCATIONS.find(t => t.id === e.target.value);
      if (test) { setPoint(test); setCategory(test.category); setScenario(test.id); onLocate(test); }
    }}><option value="custom" disabled>Selected ward</option>{TEST_LOCATIONS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
    <label className="block text-sm font-medium">Any Bengaluru ward<select aria-label="Test ward" defaultValue="" className="mt-1 block h-10 w-full rounded-lg border bg-card px-2" onChange={e => {
      const ward = dir.data?.wards.find(w => w.identifier === e.target.value);
      const p = ward ? wardPreviewPoint(ward) : null;
      if (p) { setPoint(p); setScenario('custom'); onLocate(p); }
    }}><option value="" disabled>Choose from the live ward directory</option>{dir.data?.wards.map(w => <option key={w.id} value={w.identifier}>{w.corporation.replace('Bengaluru ', '').replace(' City Corporation', '')} · {w.ward_number} · {w.name}</option>)}</select></label>
    <label className="block text-sm font-medium">Issue category<select aria-label="Test category" value={category} onChange={e => setCategory(e.target.value)} className="mt-1 block h-10 w-full rounded-lg border bg-card px-2">{CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
    <div className="flex items-center justify-between gap-2"><p className="font-mono text-xs text-muted-foreground">{point.lat.toFixed(5)}, {point.lng.toFixed(5)}</p><Button size="sm" variant="outline" onClick={() => onLocate(point)}><MapPin className="h-4 w-4" />Show on map</Button></div>
    <CivicInfo lat={point.lat} lng={point.lng} category={category} />
    <div className="space-y-2 border-t pt-3 text-xs text-muted-foreground"><p>Ward boundaries & zones: December 2025 GBA dataset, 369 records.</p><p>Officer and elected-member names: hidden until verified. Department mappings: indicative, manual review required.</p><p>Street-address lookup: hosted service not configured. Photo AI is checked during real photo reporting, not simulated here.</p><p>Gallery photos without GPS are supported. Permission denial leaves manual map-pin selection available.</p></div>
  </div>;
}
