import { Skeleton } from '@jpt/ui';

export default function Loading() {
  return (
    <div className="container-page pb-24 pt-10 md:pt-14" aria-busy="true">
      <Skeleton className="h-11 w-56" />
      <Skeleton className="mt-4 h-5 w-96 max-w-full" />
      <div className="mt-10 grid gap-10 lg:grid-cols-[17rem_1fr]">
        <div className="hidden space-y-4 lg:block">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-5 w-40" />
          ))}
        </div>
        <div>
          <Skeleton className="h-11 w-full" />
          <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="overflow-hidden rounded-[var(--radius-card)] border border-line">
                <Skeleton className="aspect-[400/260] rounded-none" />
                <div className="space-y-3 p-5">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-1.5 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
