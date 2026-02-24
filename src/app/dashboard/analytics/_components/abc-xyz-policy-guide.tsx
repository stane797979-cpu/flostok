import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, AlertTriangle } from "lucide-react";

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
    color: "text-green-600 bg-green-50",
  },
  {
    grade: "AY",
    label: "핵심 변동",
    priority: 2,
    strategy: "정기 발주, 수요예측 정교화, 안전재고 확보",
    icon: "high",
    color: "text-green-600 bg-green-50",
  },
  {
    grade: "AZ",
    label: "핵심 불안정",
    priority: 3,
    strategy: "수요예측 개선, 공급자 협력, 높은 안전재고",
    icon: "high",
    color: "text-yellow-600 bg-yellow-50",
  },
  {
    grade: "BX",
    label: "중요 안정",
    priority: 4,
    strategy: "정기 발주, 적정 재고 유지",
    icon: "medium",
    color: "text-blue-600 bg-blue-50",
  },
  {
    grade: "BY",
    label: "중요 변동",
    priority: 5,
    strategy: "주기적 검토, 표준 안전재고",
    icon: "medium",
    color: "text-blue-600 bg-blue-50",
  },
  {
    grade: "BZ",
    label: "중요 불안정",
    priority: 6,
    strategy: "수요패턴 분석, 발주 주기 조정",
    icon: "medium",
    color: "text-orange-600 bg-orange-50",
  },
  {
    grade: "CX",
    label: "일반 안정",
    priority: 7,
    strategy: "대량 발주, 낮은 발주빈도",
    icon: "low",
    color: "text-slate-600 bg-slate-50 dark:bg-slate-800/50",
  },
  {
    grade: "CY",
    label: "일반 변동",
    priority: 8,
    strategy: "간헐적 검토, 최소 재고 유지",
    icon: "low",
    color: "text-slate-600 bg-slate-50 dark:bg-slate-800/50",
  },
  {
    grade: "CZ",
    label: "일반 불안정",
    priority: 9,
    strategy: "주문생산 검토, 재고 최소화 또는 폐기",
    icon: "low",
    color: "text-slate-600 bg-slate-50 dark:bg-slate-800/50",
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
              className={`rounded-lg border border-slate-200 p-4 ${item.color}`}
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
              <p className="text-xs leading-relaxed text-slate-600">{item.strategy}</p>
              <div className="mt-2 border-t border-slate-200 pt-2">
                <span className="text-xs text-slate-500">우선순위: {item.priority}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h4 className="mb-2 text-sm font-medium text-blue-900">분류 기준 설명</h4>
          <div className="space-y-2 text-xs text-blue-800">
            <div>
              <span className="font-medium">ABC 분석 (매출 기여도):</span> 매출액 기준 누적 비율 — A: 상위 80%, B:
              80-95%, C: 95-100%
            </div>
            <div>
              <span className="font-medium">XYZ 분석 (수요 안정성):</span> 수요 변동계수(CV) 기준 — X: CV&lt;0.5 (안정), Y:
              0.5≤CV&lt;1.0 (변동), Z: CV≥1.0 (불안정)
            </div>
            <div>
              <span className="font-medium">FMR 분석 (출고 빈도):</span> 월평균 출고 건수 기준 — F: 10회 이상 (고빈도), M:
              4~9회 (중빈도), R: 3회 이하 (저빈도). ABC가 &quot;얼마나 많이 팔리는가&quot;(금액)라면, FMR은
              &quot;얼마나 자주 출고되는가&quot;(횟수)를 측정합니다.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
