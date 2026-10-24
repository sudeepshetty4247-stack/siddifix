import { useCallback, useEffect, useRef, useState } from 'react';

export type GpsFix = { lat: number; lng: number; accuracy: number; at: number };
export type GpsState = 'idle' | 'locating' | 'located' | 'denied' | 'unavailable';

/**
 * Live device position while a screen is open (like a maps app).
 * Keeps refining while mounted; never runs in the background.
 */
export function useLiveGps(autoStart = true) {
  const [fix, setFix] = useState<GpsFix | null>(null);
  const [state, setState] = useState<GpsState>('idle');
  const watch = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (watch.current !== null && typeof navigator !== 'undefined') navigator.geolocation?.clearWatch(watch.current);
    watch.current = null;
  }, []);

  const start = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setState('unavailable'); return; }
    stop();
    setState(s => (s === 'located' ? s : 'locating'));
    watch.current = navigator.geolocation.watchPosition(
      p => {
        setFix(prev => {
          const next = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: p.timestamp || Date.now() };
          // Keep a sharper recent fix instead of jumping to a much rougher one.
          if (prev && Date.now() - prev.at < 20000 && next.accuracy > prev.accuracy * 3) return prev;
          return next;
        });
        setState('located');
      },
      err => {
        if (err.code === 1) { setState('denied'); stop(); }
        else setState(s => (s === 'located' ? s : 'unavailable'));
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
  }, [stop]);

  useEffect(() => { if (autoStart) start(); return stop; }, [autoStart, start, stop]);

  return { fix, state, start, stop };
}
