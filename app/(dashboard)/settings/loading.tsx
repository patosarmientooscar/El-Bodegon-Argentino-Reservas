import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="flex items-start gap-4 sm:flex-row">
      <Skeleton className="h-64 w-full shrink-0 sm:w-44" />
      <Skeleton className="h-96 w-full flex-1" />
    </div>
  );
}
