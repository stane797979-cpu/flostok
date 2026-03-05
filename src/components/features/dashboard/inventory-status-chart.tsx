import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { INVENTORY_STATUS } from "@/lib/constants/inventory-status";
import { cn } from "@/lib/utils";
import { PeriodBadge } from "./period-badge";

// Tailwind JIT를 위한 정적 색상 매핑
const strokeColorMap: Record<string, string> = {
  red: 'stroke-red-500',
  orange: 'stroke-orange-500',
  yellow: 'stroke-yellow-500',
  green: 'stroke-green-500',
  blue: 'stroke-blue-500',
  purple: 'stroke-purple-500',
  gray: 'stroke-gray-500',
  slate: 'stroke-slate-500',
  zinc: 'stroke-zinc-500',
};

const fillColorMap: Record<string, string> = {
  red: 'fill-red-600',
  orange: 'fill-orange-600',
  yellow: 'fill-yellow-600',
  green: 'fill-green-600',
  blue: 'fill-blue-600',
  purple: 'fill-purple-600',
  gray: 'fill-gray-600',
  slate: 'fill-slate-600',
  zinc: 'fill-zinc-600',
};

const bgColorMap: Record<string, string> = {
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  yellow: 'bg-yellow-500',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  gray: 'bg-gray-500',
  slate: 'bg-slate-500',
  zinc: 'bg-zinc-500',
};

interface InventoryStatusChartProps {
  /** 상태별 분포 (key: status key, value: count) */
  distribution: Record<string, number>;
  /** 전체 SKU 수 */
  totalSku: number;
}

/** statusDistribution Record를 차트용 배열로 변환 */
function toDistributionArray(distribution: Record<string, number>) {
  return Object.entries(distribution).map(([key, count]) => {
    const statusInfo = Object.values(INVENTORY_STATUS).find((s) => s.key === key);
    return {
      key,
      label: statusInfo?.label || key,
      count,
      color: statusInfo?.color || "gray",
    };
  });
}

export const InventoryStatusChart = memo<InventoryStatusChartProps>(function InventoryStatusChart({
  distribution,
  totalSku,
}) {
  const distributionArray = toDistributionArray(distribution);

  // 도넛 차트를 위한 SVG 파라미터
  const size = 300;
  const strokeWidth = 50;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const labelRadius = radius + strokeWidth / 2 + 40; // 라벨 위치 (도넛 바깥)

  // 세그먼트 데이터 사전 계산
  const segments: {
    key: string;
    label: string;
    color: string;
    count: number;
    percentage: number;
    startAngle: number;
    midAngle: number;
    segmentLength: number;
    offset: number;
  }[] = [];

  let offset = 0;
  for (const item of distributionArray) {
    const percentage = totalSku > 0 ? item.count / totalSku : 0;
    const segmentLength = circumference * percentage;
    const startAngle = (offset / circumference) * 360 - 90; // -90: SVG rotate 보정
    const midAngle = startAngle + (percentage * 360) / 2;
    segments.push({
      key: item.key,
      label: item.label,
      color: item.color,
      count: item.count,
      percentage,
      startAngle,
      midAngle,
      segmentLength,
      offset,
    });
    offset += segmentLength;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <CardTitle>재고상태 분포</CardTitle>
        <PeriodBadge
          period="실시간"
          description="현재 재고 수량 기준 7단계 분류"
          formula="품절→위험→부족→주의→적정→과다→과잉"
        />
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4">
          {totalSku === 0 ? (
            <div className="flex h-48 items-center justify-center text-slate-400">
              재고 데이터가 없습니다
            </div>
          ) : (
            <>
              {/* 도넛 차트 + 라벨 */}
              <div className="relative" style={{ width: size + 180, height: size + 180 }}>
                <svg
                  width={size + 180}
                  height={size + 180}
                  viewBox={`${-90} ${-90} ${size + 180} ${size + 180}`}
                >
                  {/* 배경 원 */}
                  <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth={strokeWidth}
                    className="dark:stroke-slate-800"
                  />
                  {/* 각 상태별 세그먼트 */}
                  {segments.map((seg) => (
                    <circle
                      key={seg.key}
                      cx={center}
                      cy={center}
                      r={radius}
                      fill="none"
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${seg.segmentLength} ${circumference}`}
                      strokeDashoffset={-seg.offset}
                      transform={`rotate(-90 ${center} ${center})`}
                      className={cn(strokeColorMap[seg.color] || 'stroke-gray-500')}
                    />
                  ))}
                  {/* 세그먼트 라벨 (도넛 바깥, 충돌 해소) */}
                  {(() => {
                    // 1단계: 원래 위치 계산
                    const rawLabels = segments
                      .filter((seg) => Math.round(seg.percentage * 100) > 0)
                      .map((seg) => {
                        const angle = (seg.midAngle * Math.PI) / 180;
                        return {
                          ...seg,
                          pct: Math.round(seg.percentage * 100),
                          angle,
                          x: center + labelRadius * Math.cos(angle),
                          y: center + labelRadius * Math.sin(angle),
                        };
                      });

                    // 2단계: y 기준 정렬 후 겹침 해소 (최소 간격 40px)
                    const MIN_GAP = 40;
                    const sorted = [...rawLabels].sort((a, b) => a.y - b.y);
                    for (let i = 1; i < sorted.length; i++) {
                      const prev = sorted[i - 1];
                      const curr = sorted[i];
                      const gap = curr.y - prev.y;
                      if (gap < MIN_GAP) {
                        const shift = (MIN_GAP - gap) / 2;
                        sorted[i - 1] = { ...prev, y: prev.y - shift };
                        sorted[i] = { ...curr, y: curr.y + shift };
                        // 연쇄 보정: 이전 것도 다시 체크
                        for (let j = i - 1; j > 0; j--) {
                          const g = sorted[j].y - sorted[j - 1].y;
                          if (g < MIN_GAP) {
                            sorted[j - 1] = { ...sorted[j - 1], y: sorted[j - 1].y - (MIN_GAP - g) };
                          }
                        }
                      }
                    }

                    return sorted.map((lbl) => (
                      <g key={`label-${lbl.key}`}>
                        <text
                          x={lbl.x}
                          y={lbl.y - 10}
                          textAnchor={lbl.x < center ? "end" : "start"}
                          className={cn("text-[20px] font-bold", fillColorMap[lbl.color] || 'fill-gray-600')}
                        >
                          {lbl.label}
                        </text>
                        <text
                          x={lbl.x}
                          y={lbl.y + 12}
                          textAnchor={lbl.x < center ? "end" : "start"}
                          className="fill-slate-500 text-[16px] font-semibold dark:fill-slate-400"
                        >
                          {lbl.pct}% ({lbl.count})
                        </text>
                      </g>
                    ));
                  })()}
                </svg>
                {/* 중앙 텍스트 */}
                <div
                  className="absolute flex flex-col items-center justify-center"
                  style={{
                    top: 90 + center - 30,
                    left: 90 + center - 40,
                    width: 80,
                    height: 60,
                  }}
                >
                  <div className="text-3xl font-bold">{totalSku}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">총 SKU</div>
                </div>
              </div>


            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
});
