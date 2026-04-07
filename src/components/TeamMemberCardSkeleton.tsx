import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function TeamMemberCardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-5 space-y-2">
        {/* Avatar skeleton */}
        <Skeleton className="h-9 w-9 rounded-full" />

        {/* Name and role skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </CardContent>
    </Card>
  );
}
