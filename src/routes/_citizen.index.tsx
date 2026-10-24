import { createFileRoute } from '@tanstack/react-router';
import { CitizenMap } from '@/components/civic/CitizenMap';
export const Route = createFileRoute('/_citizen/')({
  head: () => ({ meta: [
    {title:'CivicFix — Nearby problems and photo reporting'},
    {name:'description',content:'Explore real civic reports, confirm a problem location and submit a photo without signing in.'},
    {property:'og:title',content:'CivicFix — Nearby problems'},
    {property:'og:description',content:'Real civic reports on a map, anonymous photo reporting and public action history.'},
    {property:'og:type',content:'website'},
    {name:'twitter:card',content:'summary'},
  ]}),
  component: CitizenMap,
});
