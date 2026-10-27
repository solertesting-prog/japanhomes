import { Skeleton } from '@jpt/ui';

export default function Loading() {
  return (
    <div className="container-page pb-24 pt-8" aria-busy="true">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-6 h-6 w-40" />
      <Skeleton className="mt-4 h-10 w-2/3" />
      <Skeleton className="mt-3 h-5 w-1/3" />
      <div className="mt-8 grid gap-10 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <Skeleton className="aspect-[400/260] w-full rounded-[var(--radius-card)]" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-5/6" />
          <Skeleton className="h-40 w-full" />
        </div>
        <div className="hidden lg:col-span-4 lg:block">
          <Skeleton className="h-80 w-full rounded-[var(--radius-card)]" />
        </div>
      </div>
    </div>
  );
}
