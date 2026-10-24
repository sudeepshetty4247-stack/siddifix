import { createFileRoute } from '@tanstack/react-router';
import { PortalLogin } from '@/components/portals/PortalLogin';
export const Route=createFileRoute('/auth')({head:()=>({meta:[{title:'Staff access — Siddhi'},{name:'description',content:'Secure government staff sign-in.'},{property:'og:title',content:'Staff access — Siddhi'},{property:'og:description',content:'Department-scoped government operations.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'},{name:'robots',content:'noindex'}]}),component:()=> <PortalLogin portal="staff"/>});
