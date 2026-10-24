import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, type ComponentProps } from "react";
import { cn } from "@/lib/utils";
import type MapViewType from "./MapView";

const MapView = lazy(() => import("./MapView"));

export function LazyMap({ className, ...props }: ComponentProps<typeof MapViewType>) {
  const fallback = <div className={cn("h-full w-full animate-pulse bg-muted bg-civic-grid", className)} />;
  return (
    <ClientOnly fallback={fallback}>
      <Suspense fallback={fallback}>
        <MapView {...props} className={className} />
      </Suspense>
    </ClientOnly>
  );
}
