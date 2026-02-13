import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export default function ForecastGuideLoading() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <Skeleton className="mx-auto h-9 w-64" />
        <Skeleton className="mx-auto mt-2 h-5 w-96" />
      </div>

      <div className="mx-auto max-w-2xl space-y-6">
        {/* 단계 표시기 스켈레톤 */}
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center">
              <Skeleton className="h-8 w-8 rounded-full" />
              {i < 4 && <Skeleton className="mx-1 h-0.5 w-8" />}
            </div>
          ))}
        </div>

        {/* 메인 카드 스켈레톤 */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="mx-auto h-6 w-48" />
            <Skeleton className="mx-auto h-4 w-64" />
            <div className="space-y-3 pt-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
