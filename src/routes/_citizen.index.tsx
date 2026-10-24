import { createFileRoute } from '@tanstack/react-router';
import { CitizenMap } from '@/components/civic/CitizenMap';
export const Route = createFileRoute('/_citizen/')({
  head: () => ({ meta: [
    {title:'CivicFix Bengaluru — Local reports and photo reporting'},
    {name:'description',content:'Discover nearby Bengaluru civic cases, report a problem with a photo and track recorded progress without citizen sign-in.'},
    {property:'og:title',content:'CivicFix Bengaluru — Your neighbourhood'},
    {property:'og:description',content:'A live Bengaluru ward map, nearby case totals and anonymous photo reporting.'},
    {property:'og:type',content:'website'},
    {name:'twitter:card',content:'summary'},
  ]}),
  component: CitizenMap,
});
