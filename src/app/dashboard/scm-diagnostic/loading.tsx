import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export default function ScmDiagnosticLoading() {
  return (
    <div className="container max-w-4xl py-8">
      {/* 헤더 */}
      <div className="mb-8 flex flex-col items-center gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-72" />
      </div>

      {/* 스텝 인디케이터 */}
      <div className="mb-6 flex justify-center gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            {i < 3 && <Skeleton className="h-0.5 w-8" />}
          </div>
        ))}
      </div>

      {/* 메인 카드 */}
      <Card className="mx-auto max-w-2xl">
        <CardContent className="space-y-6 p-6">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-48" />

          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
