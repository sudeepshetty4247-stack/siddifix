import { createFileRoute, Link } from '@tanstack/react-router';
import { ClientOnly } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';

const AssistantChat = lazy(() => import('@/components/civic/AssistantChat'));
export const Route = createFileRoute('/_citizen/assistant')({
  head: () => ({ meta: [
    { title: 'Ask Siddhi — Your City. Your Voice.' },
    { name: 'description', content: 'Ask questions in your language about reporting, public case progress and Bengaluru civic information.' },
    { property: 'og:title', content: 'Ask Siddhi — multilingual citizen assistant' },
    { property: 'og:description', content: 'Helpful answers grounded in public Siddhi report totals, with no citizen sign-in required.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: () => <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6"><div className="mb-5 flex items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Ask Siddhi</h1><p className="mt-1 text-sm text-muted-foreground">Your City. Your Voice.</p></div><Link to="/transparency" className="text-sm font-semibold text-primary">Public reports →</Link></div><ClientOnly fallback={<p role="status">Opening assistant…</p>}><Suspense fallback={<p role="status">Opening assistant…</p>}><AssistantChat /></Suspense></ClientOnly></div>,
});