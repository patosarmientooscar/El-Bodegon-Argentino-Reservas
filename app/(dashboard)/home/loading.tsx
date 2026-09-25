import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-2 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Skeleton className="aspect-square w-full sm:aspect-16/9" />
        <Skeleton className="h-48 w-full" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
