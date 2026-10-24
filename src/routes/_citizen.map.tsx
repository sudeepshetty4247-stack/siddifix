import { createFileRoute } from '@tanstack/react-router';
import { CitizenMap } from '@/components/civic/CitizenMap';
export const Route = createFileRoute('/_citizen/map')({
  head: () => ({meta:[
    {title:'Civic Map — CivicFix'},
    {name:'description',content:'Find persisted civic reports by location, category and status, or choose a pin for a new report.'},
    {property:'og:title',content:'Civic Map — CivicFix'},
    {property:'og:description',content:'Explore real infrastructure reports and their public histories.'},
    {property:'og:type',content:'website'},
    {name:'twitter:card',content:'summary'},
  ]}),
  component: CitizenMap,
});
