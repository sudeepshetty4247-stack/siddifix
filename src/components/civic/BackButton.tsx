import { ArrowLeft } from 'lucide-react';
import { useRouter, useRouterState } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import {useI18n} from '@/lib/i18n';

export function BackButton({ fallback = '/', beforeBack }: { fallback?: '/' | '/staff' | '/admin'; beforeBack?: () => void }) {
  const {tx}=useI18n();
  const router = useRouter();
  const pathname = useRouterState({ select: (st) => st.location.pathname });
  if (pathname === '/') return null;
  return <Button variant="ghost" size="sm" aria-label="Go back" title="Back" onClick={() => {
    beforeBack?.();
    const previous = window.location.pathname;
    if (router.history.canGoBack()) {
      router.history.back();
      // Auth redirects or duplicate history entries can return to the same page.
      window.setTimeout(() => {
        if (window.location.pathname === previous) void router.navigate({ to: fallback, replace: true });
      }, 700);
    } else void router.navigate({ to: fallback, replace: true });
  }}><ArrowLeft className="h-4 w-4"/><span>{tx('back')}</span></Button>;
}