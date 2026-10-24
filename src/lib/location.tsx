import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { suggestedReportLocation } from './report-location';
import { reverseGeocode } from './geocoding.functions';
export type SelectedLocation = { lat: number; lng: number; label: string; method: 'device' | 'manual'; accuracy?: number };
type LocationContextValue = { location: SelectedLocation | null; select: (l: SelectedLocation) => void; open: boolean; setOpen: (v: boolean) => void; locating: boolean; detect: (quiet?: boolean) => void; notice: string; recent: SelectedLocation[] };
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
  function detect(quiet = false) {
    // Automatic attempts never interrupt with a dialog; only a tap on "use my location" does.
    const ask = () => { if (!quiet) setOpen(true); };
    if (!navigator.geolocation) { setNotice('Location is unavailable. Choose a map pin instead.'); ask(); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(p => {
      const candidate: SelectedLocation = { lat: p.coords.latitude, lng: p.coords.longitude, label: 'Current location', method: 'device', accuracy: p.coords.accuracy };
      setLocating(false);
      if (!suggestedReportLocation(candidate)) { setNotice(`Device location is too approximate (±${Math.round(p.coords.accuracy)} m). Choose your exact point on the map.`); ask(); return; }
      select(candidate);
    }, error => { setLocating(false); setNotice(error.code === 1 ? 'Location permission was denied. Choose a location manually, or allow location access in your browser.' : error.code === 3 ? 'Device location timed out. Try again or choose a map pin.' : 'Device location is unavailable. Choose a map pin instead.'); ask(); }, { timeout: 15000, maximumAge: 0, enableHighAccuracy: true });
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
    detect(true);
  }, []);
  useEffect(()=>{
    if(!location||!suggestedReportLocation(location)||location.label!=='Current location')return;
    let cancelled=false;
    reverseGeocode({data:{lat:location.lat,lng:location.lng}}).then(result=>{
      const address=result.address;
      if(!cancelled&&address)setLocation(previous=>previous&&previous.lat===location.lat&&previous.lng===location.lng?{...previous,label:address.split(',').slice(0,2).join(',').slice(0,120)}:previous);
    }).catch(()=>{/* coordinates remain available */});
    return()=>{cancelled=true;};
  },[location?.lat,location?.lng,location?.label]);
  return <LocationContext.Provider value={{ location, select, open, setOpen, locating, detect, notice, recent }}>{children}</LocationContext.Provider>;
}
export function useLocation() { const value = useContext(LocationContext); if (!value) throw new Error('LocationProvider required'); return value; }