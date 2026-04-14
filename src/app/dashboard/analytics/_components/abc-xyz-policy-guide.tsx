import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Target, TrendingUp, AlertTriangle, Info } from "lucide-react";

interface PolicyItem {
  grade: string;
  label: string;
  priority: number;
  strategy: string;
  icon: "high" | "medium" | "low";
  color: string;
}

const POLICY_ITEMS: PolicyItem[] = [
  {
    grade: "AX",
    label: "핵심 안정",
    priority: 1,
    strategy: "JIT 공급, 자동 발주, 높은 서비스레벨 유지",
    icon: "high",
    color: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50",
  },
  {
    grade: "AY",
    label: "핵심 변동",
    priority: 2,
    strategy: "정기 발주, 수요예측 정교화, 안전재고 확보",
    icon: "high",
    color: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50",
  },
  {
    grade: "AZ",
    label: "핵심 불안정",
    priority: 3,
    strategy: "수요예측 개선, 공급자 협력, 높은 안전재고",
    icon: "high",
    color: "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/50",
  },
  {
    grade: "BX",
    label: "중요 안정",
    priority: 4,
    strategy: "정기 발주, 적정 재고 유지",
    icon: "medium",
    color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50",
  },
  {
    grade: "BY",
    label: "중요 변동",
    priority: 5,
    strategy: "주기적 검토, 표준 안전재고",
    icon: "medium",
    color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50",
  },
  {
    grade: "BZ",
    label: "중요 불안정",
    priority: 6,
    strategy: "수요패턴 분석, 발주 주기 조정",
    icon: "medium",
    color: "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/50",
  },
  {
    grade: "CX",
    label: "일반 안정",
    priority: 7,
    strategy: "대량 발주, 낮은 발주빈도",
    icon: "low",
    color: "text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50",
  },
  {
    grade: "CY",
    label: "일반 변동",
    priority: 8,
    strategy: "간헐적 검토, 최소 재고 유지",
    icon: "low",
    color: "text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50",
  },
  {
    grade: "CZ",
    label: "일반 불안정",
    priority: 9,
    strategy: "주문생산 검토, 재고 최소화 또는 폐기",
    icon: "low",
    color: "text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50",
  },
];

function PriorityIcon({ type }: { type: "high" | "medium" | "low" }) {
  switch (type) {
    case "high":
      return <Target className="h-4 w-4 text-green-600" />;
    case "medium":
      return <TrendingUp className="h-4 w-4 text-blue-600" />;
    case "low":
      return <AlertTriangle className="h-4 w-4 text-slate-400" />;
  }
}

export function ABCXYZPolicyGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>권장 재고 관리 정책</CardTitle>
        <p className="text-sm text-slate-500">각 ABC-XYZ 조합별 재고 관리 전략 가이드</p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {POLICY_ITEMS.map((item) => (
            <div
              key={item.grade}
              className={`rounded-lg border border-slate-200 dark:border-slate-700 p-4 ${item.color}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">
                    {item.grade}
                  </Badge>
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <PriorityIcon type={item.icon} />
              </div>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">{item.strategy}</p>
              <div className="mt-2 border-t border-slate-200 dark:border-slate-700 pt-2">
                <span className="text-xs text-slate-500">우선순위: {item.priority}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h4 className="mb-2 text-sm font-medium text-blue-900">분류 기준 설명</h4>
          <div className="space-y-2 text-xs text-blue-800">
            <div className="flex items-center gap-1">
              <span className="font-medium">ABC 분석 (매출 기여도):</span>
              <span>매출액 기준 누적 비율 — A: 상위 80%, B: 80-95%, C: 95-100%</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-blue-500 cursor-help shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[240px] text-xs leading-relaxed">
                    <p className="font-semibold mb-1">ABC 분석 (파레토 법칙)</p>
                    <p className="mb-2">전체 매출의 대부분을 소수 제품이 차지한다는 원리.</p>
                    <ul className="space-y-1">
                      <li>· A등급: 누적 매출 상위 80% — 핵심 제품</li>
                      <li>· B등급: 누적 매출 80~95% — 중요 제품</li>
                      <li>· C등급: 누적 매출 95~100% — 일반 제품</li>
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium">XYZ 분석 (수요 안정성):</span>
              <span>수요 변동계수(CV) 기준 — X: CV&lt;0.5 (안정), Y: 0.5≤CV&lt;1.0 (변동), Z: CV≥1.0 (불안정)</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-blue-500 cursor-help shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[240px] text-xs leading-relaxed">
                    <p className="font-semibold mb-1">CV (변동계수)</p>
                    <p className="mb-2">CV = 표준편차 ÷ 평균. 수요가 평균 대비 얼마나 불규칙한지 측정.</p>
                    <ul className="space-y-1">
                      <li>· X: CV &lt; 0.5 — 안정적, 수요예측 용이</li>
                      <li>· Y: 0.5 ≤ CV &lt; 1.0 — 보통 변동</li>
                      <li>· Z: CV ≥ 1.0 — 불규칙, 안전재고 확보 필요</li>
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium">FMR 분석 (출고 빈도):</span>
              <span>월평균 출고 건수 기준 — F: 10회 이상 (고빈도), M: 4~9회 (중빈도), R: 3회 이하 (저빈도)</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-blue-500 cursor-help shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[240px] text-xs leading-relaxed">
                    <p className="font-semibold mb-1">FMR 분석</p>
                    <p className="mb-2">ABC가 &quot;얼마나 많이 팔리는가&quot;(금액)라면, FMR은 &quot;얼마나 자주 출고되는가&quot;(횟수)를 측정.</p>
                    <ul className="space-y-1">
                      <li>· F (Fast): 월 10회 이상 — 자동발주 적합</li>
                      <li>· M (Medium): 월 4~9회 — 정기 검토</li>
                      <li>· R (Rare): 월 3회 이하 — 재고 최소화</li>
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
