import { Skeleton } from "@/components/ui/skeleton";

export default function WarehouseInboundLoading() {
  return (
    <div className="space-y-6">
      {/* 제목 + 새로고침 버튼 */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-28" />
          <Skeleton className="mt-1 h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-24" />
      </div>

      {/* 테이블 카드 */}
      <div className="rounded-lg border bg-card">
        <div className="p-6">
          {/* 테이블 헤더 */}
          <div className="mb-4 grid grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-4" />
            ))}
          </div>
          {/* 테이블 행들 */}
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map((_, j) => (
                  <Skeleton key={j} className="h-10" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
