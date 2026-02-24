import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  ShieldCheck,
  AlertTriangle,
  BarChart3,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ABCXYZSummaryProps {
  totalCount: number;
  aCount: number;
  aPercentage: number;
  bCount: number;
  bPercentage: number;
  cCount: number;
  cPercentage: number;
  xCount: number;
  xPercentage: number;
  yCount: number;
  yPercentage: number;
  zCount: number;
  zPercentage: number;
  period: string;
  insights: {
    totalRevenue: number;
    aRevenuePercent: number;
    axCount: number;
    axRevenuePercent: number;
    azCount: number;
    bzCount: number;
    riskCount: number;
    avgCV: number;
  };
}

function formatRevenue(value: number): string {
  if (value >= 100000000) {
    return `${(value / 100000000).toFixed(1)}억원`;
  }
  if (value >= 10000) {
    return `${Math.round(value / 10000).toLocaleString("ko-KR")}만원`;
  }
  return `${value.toLocaleString("ko-KR")}원`;
}

export function ABCXYZSummary({
  totalCount,
  aCount,
  aPercentage,
  bCount,
  bPercentage,
  cCount,
  cPercentage,
  xCount,
  xPercentage,
  yCount,
  yPercentage,
  zCount,
  zPercentage,
  period,
  insights,
}: ABCXYZSummaryProps) {
  return (
    <div className="space-y-4">
      {/* 핵심 인사이트 카드 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">분석 대상</CardTitle>
            <Package className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}개 제품</div>
            <p className="text-xs text-slate-500">
              {period} 기준, 총 매출 {formatRevenue(insights.totalRevenue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">핵심 안정 (AX)</CardTitle>
            <ShieldCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{insights.axCount}개</div>
            <p className="text-xs text-slate-500">
              매출의 {insights.axRevenuePercent}% 차지 — JIT 공급 적합
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">주의 필요 (AZ+BZ)</CardTitle>
            <AlertTriangle className={cn("h-4 w-4", insights.riskCount > 0 ? "text-orange-500" : "text-slate-400")} />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", insights.riskCount > 0 ? "text-orange-500" : "text-slate-600")}>
              {insights.riskCount}개
            </div>
            <p className="text-xs text-slate-500">
              {insights.riskCount > 0
                ? "고매출이나 수요 불안정 — 안전재고 확대 필요"
                : "불안정 고매출 제품 없음"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">평균 변동계수</CardTitle>
            <Activity className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights.avgCV.toFixed(2)}</div>
            <p className="text-xs text-slate-500">
              {insights.avgCV < 0.5 ? "전반적으로 안정적 수요" : insights.avgCV < 1.0 ? "보통 수준의 변동성" : "높은 변동성 — 수요예측 강화 필요"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ABC / XYZ 등급 분포 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* ABC 분포 */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-slate-600" />
              <CardTitle className="text-sm font-medium">ABC 분류 (매출 기여도)</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <GradeBar
              label="A등급"
              sublabel="상위 80%"
              count={aCount}
              total={totalCount}
              percentage={aPercentage}
              revenuePercent={insights.aRevenuePercent}
              color="bg-green-500"
            />
            <GradeBar
              label="B등급"
              sublabel="80~95%"
              count={bCount}
              total={totalCount}
              percentage={bPercentage}
              color="bg-blue-500"
            />
            <GradeBar
              label="C등급"
              sublabel="95~100%"
              count={cCount}
              total={totalCount}
              percentage={cPercentage}
              color="bg-slate-400"
            />
          </CardContent>
        </Card>

        {/* XYZ 분포 */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-slate-600" />
              <CardTitle className="text-sm font-medium">XYZ 분류 (수요 안정성)</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <GradeBar
              label="X등급"
              sublabel="CV < 0.5"
              count={xCount}
              total={totalCount}
              percentage={xPercentage}
              color="bg-emerald-500"
            />
            <GradeBar
              label="Y등급"
              sublabel="0.5 ≤ CV < 1.0"
              count={yCount}
              total={totalCount}
              percentage={yPercentage}
              color="bg-yellow-500"
            />
            <GradeBar
              label="Z등급"
              sublabel="CV ≥ 1.0"
              count={zCount}
              total={totalCount}
              percentage={zPercentage}
              color="bg-orange-500"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function GradeBar({
  label,
  sublabel,
  count,
  total,
  percentage,
  revenuePercent,
  color,
}: {
  label: string;
  sublabel: string;
  count: number;
  total: number;
  percentage: number;
  revenuePercent?: number;
  color: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium">{label}</span>
          <span className="text-xs text-slate-400">{sublabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">{count}개</span>
          <Badge variant="outline" className="text-xs">
            {percentage.toFixed(1)}%
          </Badge>
          {revenuePercent !== undefined && (
            <Badge variant="secondary" className="text-xs">
              매출 {revenuePercent}%
            </Badge>
          )}
        </div>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={cn("h-2 rounded-full transition-all", color)}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}
