import { ArrowLeft } from 'lucide-react';
import { useRouter } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

export function BackButton({ fallback = '/' }: { fallback?: '/' | '/staff' }) {
  const router = useRouter();
  return <Button variant="ghost" size="sm" aria-label="Go back" title="Back" onClick={() => {
    if (router.history.canGoBack()) router.history.back();
    else void router.navigate({ to: fallback });
  }}><ArrowLeft className="h-4 w-4"/><span>Back</span></Button>;
}