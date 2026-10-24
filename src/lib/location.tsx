import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
export type SelectedLocation = { lat: number; lng: number; label: string; method: 'device' | 'manual'; accuracy?: number };
type LocationContextValue = { location: SelectedLocation | null; select: (l: SelectedLocation) => void; open: boolean; setOpen: (v: boolean) => void; locating: boolean; detect: () => void; notice: string; recent: SelectedLocation[] };
const LocationContext = createContext<LocationContextValue | null>(null);
const KEY = 'civicfix-location-v1';
function valid(v: unknown): v is SelectedLocation {
  const l = v as SelectedLocation | null;
  return !!l && Number.isFinite(l.lat) && Number.isFinite(l.lng) && Math.abs(l.lat) <= 90 && Math.abs(l.lng) <= 180 && typeof l.label === 'string' && (l.method === 'manual' || l.method === 'device');
}
export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<SelectedLocation | null>(null);
  const [recent, setRecent] = useState<SelectedLocation[]>([]);
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState('');
  function select(l: SelectedLocation) {
    if (!valid(l)) return;
    setLocation(l); setOpen(false); setNotice('');
    setRecent(prev => {
      const next = [l, ...prev.filter(p => p.lat !== l.lat || p.lng !== l.lng)].slice(0, 4);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* preferences are optional */ }
      return next;
    });
  }
  function detect() {
    if (!navigator.geolocation) { setNotice('Location is unavailable. Choose a map pin instead.'); setOpen(true); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(p => {
      select({ lat: p.coords.latitude, lng: p.coords.longitude, label: 'Current location', method: 'device', accuracy: p.coords.accuracy }); setLocating(false);
    }, () => { setLocating(false); setNotice('Location permission was not available. You can still choose a location manually.'); setOpen(true); }, { timeout: 10000, maximumAge: 300000, enableHighAccuracy: true });
  }
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
      if (Array.isArray(saved)) { const values = saved.filter(valid); if (values[0]) { setLocation(values[0]); setRecent(values); return; } }
    } catch { /* continue without a preference */ }
    let attempted = false;
    try { attempted = sessionStorage.getItem('civicfix-location-attempted') === 'yes'; sessionStorage.setItem('civicfix-location-attempted', 'yes'); } catch { attempted = true; }
    if (attempted) return;
    // A one-time browser permission request; denial leaves manual selection available.
    detect();
  }, []);
  return <LocationContext.Provider value={{ location, select, open, setOpen, locating, detect, notice, recent }}>{children}</LocationContext.Provider>;
}
export function useLocation() { const value = useContext(LocationContext); if (!value) throw new Error('LocationProvider required'); return value; }