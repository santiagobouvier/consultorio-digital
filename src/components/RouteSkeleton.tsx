import { Skeleton } from "@/components/ui/skeleton";

/**
 * Liviano fallback para Suspense de rutas lazy.
 * Se renderiza instantáneamente mientras carga el chunk de la página,
 * evitando el flash en blanco que producía `fallback={null}`.
 */
export function RouteSkeleton() {
  return (
    <div className="min-h-screen w-full bg-background p-4 md:p-8">
      <div className="mx-auto max-w-[1200px] space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-8 w-48 bg-white/[0.04]" />
          <Skeleton className="h-4 w-72 bg-white/[0.03]" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl bg-white/[0.03]" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-xl bg-white/[0.03]" />
      </div>
    </div>
  );
}
