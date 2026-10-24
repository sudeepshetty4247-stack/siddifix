import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { MapPin, ChevronDown, LocateFixed, Loader2, Search } from 'lucide-react';
import { useLocation } from '@/lib/location';
import { BENGALURU, isInIndia } from '@/lib/civic';
import { searchAddress } from '@/lib/geocoding.functions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { LazyMap } from './LazyMap';
import { AddressEntry } from './AddressEntry';

export function LocationSelector() {
  const { location, select, open, setOpen, locating, detect, notice, recent, coverage } = useLocation();
  const findAddress = useServerFn(searchAddress);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ lat: number; lng: number; label: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [label, setLabel] = useState('');
  const [coordinates, setCoordinates] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  function applyCoordinates() {
    const [lat, lng] = coordinates.split(',').map(Number);
    if (lat === undefined || lng === undefined || !Number.isFinite(lat) || !Number.isFinite(lng) || !isInIndia(lat, lng)) { setError('Enter a location as latitude, longitude.'); return; }
    setPin({ lat, lng }); setError('');
  }
  async function confirmPin() {
    if (!pin) return;
    setChecking(true); setError('');
    try {
      // Outside places are accepted; the coverage screen then explains service isn't available there yet.
      select({ ...pin, label: label.trim() || `${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}`, method: 'manual' });
    } finally {
      setChecking(false);
    }
  }
  return <>
    {<Button variant="ghost" onClick={() => setOpen(true)} className="h-auto min-w-0 justify-start gap-2 px-2 py-2 text-left" aria-label="Change location">
      <MapPin className="h-5 w-5 shrink-0 text-primary" />
      <span className="min-w-0"><span className="flex items-center gap-1"><span className="max-w-[180px] truncate text-sm font-semibold">{location?.label === 'Current location' ? 'Selected location' : location?.label || 'Choose your location'}</span><ChevronDown className="h-3 w-3 shrink-0" /></span><span className="block text-[11px] font-normal text-muted-foreground">{location ? coverage === 'outside' ? 'Outside service area · Tap to change' : location.method === 'device' ? `GPS estimate ±${Math.round(location.accuracy??0)} m · Tap to change` : 'Chosen by you · Tap to change' : 'Issues and services around you'}</span></span>
    </Button>}
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto">
        <DialogTitle>Choose your location</DialogTitle>
        <DialogDescription>Siddi currently serves Bengaluru. Pick the place you want to report in — it stays on this device.</DialogDescription>
        {notice && <p role="status" className="text-sm text-warning-foreground">{notice}</p>}
        <Button variant="outline" onClick={() => detect()} disabled={locating}>{locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}Use current location</Button>
        <AddressEntry onDraft={()=>setPin(null)} onSelect={r=>{setPin({lat:r.lat,lng:r.lng});setLabel(r.originalAddress||r.label);}} />
        <label className="space-y-1 text-sm font-medium">Name this place (optional)<input aria-label="Locality or landmark" value={label} onChange={e => setLabel(e.target.value)} maxLength={120} placeholder="e.g. Kudlu Gate" className="h-10 w-full rounded-lg border bg-card px-3 font-normal" /></label>
        <div className="h-52 overflow-hidden rounded-lg border"><LazyMap center={pin ?? location ?? BENGALURU} picked={pin ?? location} onPick={(lat, lng) => { setPin({ lat, lng }); setError(''); }} recenter={pin} zoom={13} /></div>
        <div className="flex gap-2"><input aria-label="Latitude, longitude" value={coordinates} onChange={e => setCoordinates(e.target.value)} placeholder="12.9716, 77.5946" className="h-10 min-w-0 flex-1 rounded-lg border bg-card px-3 text-sm" /><Button variant="outline" onClick={applyCoordinates}>Set pin</Button></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {pin && <p className="text-xs text-muted-foreground">Report area: {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)} · manually selected</p>}
        <Button disabled={!pin || !isInIndia(pin.lat, pin.lng) || checking} onClick={confirmPin}>{checking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Confirm location</Button>
        {recent.length > 0 && <div className="border-t pt-3"><p className="mb-2 text-xs font-semibold text-muted-foreground">RECENT LOCATIONS</p>{recent.map(l => <Button key={`${l.lat}-${l.lng}`} variant="ghost" className="w-full justify-start truncate" onClick={() => select(l)}><MapPin className="h-4 w-4" />{l.label}</Button>)}</div>}
      </DialogContent>
    </Dialog>
  </>;
}