import { useEffect, useState } from 'react';
import logo from '@/assets/siddi-opening-logo.png.asset.json';

export function BrandOpening() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 1800);
    return () => window.clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return <div role="status" aria-label="Siddhi — Your City. Your Voice." className="fixed inset-0 z-[5000] grid place-items-center bg-brand-opening p-8">
    <img src={logo.url} alt="Siddhi — Your City. Your Voice." width={1312} height={1199} fetchPriority="high" className="max-h-[65vh] w-80 max-w-full object-contain" />
  </div>;
}