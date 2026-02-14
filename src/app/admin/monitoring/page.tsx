import Link from "next/link";
import {
  Building2,
  Package,
  AlertTriangle,
  TrendingUp,
  ShoppingCart,
  DollarSign,
  Users,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getOrganizationsMonitoring,
  type OrgMonitoringData,
} from "@/server/actions/admin";

function formatCurrency(value: number): string {
  if (value >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(1)}억`;
  }
  if (value >= 10_000) {
    return `${Math.round(value / 10_000).toLocaleString("ko-KR")}만`;
  }
  return value.toLocaleString("ko-KR");
}

function InventoryStatusBar({ data }: { data: OrgMonitoringData }) {
  const total =
    data.stockoutCount +
    data.criticalCount +
    data.lowCount +
    data.normalCount +
    data.excessCount;
  if (total === 0) return <p className="text-xs text-slate-400">데이터 없음</p>;

  const segments = [
    { count: data.stockoutCount, color: "bg-black", label: "품절" },
    { count: data.criticalCount, color: "bg-red-500", label: "위험" },
    { count: data.lowCount, color: "bg-amber-400", label: "부족/주의" },
    { count: data.normalCount, color: "bg-green-500", label: "적정" },
    { count: data.excessCount, color: "bg-blue-500", label: "과다/과잉" },
  ].filter((s) => s.count > 0);

  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={`${seg.color} transition-all`}
            style={{ width: `${(seg.count / total) * 100}%` }}
            title={`${seg.label}: ${seg.count}개`}
          />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
        {segments.map((seg) => (
          <span key={seg.label} className="flex items-center gap-1 text-[10px] text-slate-500">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${seg.color}`} />
            {seg.label} {seg.count}
          </span>
        ))}
      </div>
    </div>
  );
}

function AlertBadge({ data }: { data: OrgMonitoringData }) {
  const alertCount = data.stockoutCount + data.criticalCount;
  if (alertCount === 0) return null;

  return (
    <Badge variant="destructive" className="text-[10px]">
      <AlertTriangle className="mr-0.5 h-3 w-3" />
      {alertCount}
    </Badge>
  );
}

function OrgCard({ org }: { org: OrgMonitoringData }) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-start justify-between pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
            <Building2 className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">{org.name}</CardTitle>
            <div className="mt-0.5 flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {org.plan}
              </Badge>
              <span className="text-[10px] text-slate-400">
                <Users className="mr-0.5 inline h-3 w-3" />
                {org.userCount}명
              </span>
              <span className="text-[10px] text-slate-400">
                <Package className="mr-0.5 inline h-3 w-3" />
                {org.productCount}개
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AlertBadge data={org} />
          <Link
            href={`/admin/organizations/${org.id}`}
            className="text-slate-400 transition-colors hover:text-slate-600"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 재고 현황 바 */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-500">재고 현황</p>
          <InventoryStatusBar data={org} />
        </div>

        {/* KPI 지표 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-2.5">
            <p className="text-[10px] text-slate-400">재고가치</p>
            <p className="text-sm font-bold text-slate-900">
              {formatCurrency(org.totalInventoryValue)}
              <span className="text-[10px] font-normal text-slate-400">원</span>
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2.5">
            <p className="text-[10px] text-slate-400">월 매출 (30일)</p>
            <p className="text-sm font-bold text-slate-900">
              {formatCurrency(org.monthlySalesAmount)}
              <span className="text-[10px] font-normal text-slate-400">원</span>
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2.5">
            <p className="text-[10px] text-slate-400">회전율</p>
            <p className="text-sm font-bold text-slate-900">
              {org.turnoverRate !== null ? `${org.turnoverRate}회` : "-"}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2.5">
            <p className="text-[10px] text-slate-400">품절률</p>
            <p className="text-sm font-bold text-slate-900">
              {org.stockoutRate !== null ? `${org.stockoutRate}%` : "-"}
            </p>
          </div>
        </div>

        {/* 발주 현황 */}
        {(org.monthlyOrderCount > 0 || org.pendingOrderCount > 0) && (
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <ShoppingCart className="h-3.5 w-3.5" />
              발주 {org.monthlyOrderCount}건 (30일)
            </span>
            {org.pendingOrderCount > 0 && (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                대기 {org.pendingOrderCount}건
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default async function MonitoringPage() {
  const result = await getOrganizationsMonitoring();

  if (!result.success) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">고객 모니터링</h1>
        <p className="text-red-600">데이터 로드 실패: {result.error}</p>
      </div>
    );
  }

  const orgs = result.data;
  const totalAlerts = orgs.reduce(
    (sum, o) => sum + o.stockoutCount + o.criticalCount,
    0
  );
  const totalInventoryValue = orgs.reduce(
    (sum, o) => sum + o.totalInventoryValue,
    0
  );
  const totalMonthlySales = orgs.reduce(
    (sum, o) => sum + o.monthlySalesAmount,
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">고객 모니터링</h1>
        <p className="mt-2 text-slate-500">
          전체 고객사의 SCM 핵심 지표를 한눈에 모니터링합니다
        </p>
      </div>

      {/* 전체 요약 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">관리 고객</p>
              <p className="text-2xl font-bold">{orgs.length}개사</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">긴급 알림</p>
              <p className="text-2xl font-bold text-red-600">{totalAlerts}건</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">총 재고가치</p>
              <p className="text-2xl font-bold">
                {formatCurrency(totalInventoryValue)}
                <span className="text-sm font-normal text-slate-400">원</span>
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">월 매출 합계</p>
              <p className="text-2xl font-bold">
                {formatCurrency(totalMonthlySales)}
                <span className="text-sm font-normal text-slate-400">원</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 고객사별 카드 */}
      {orgs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-4 text-lg font-medium text-slate-500">
              등록된 고객사가 없습니다
            </p>
            <p className="mt-1 text-sm text-slate-400">
              조직 관리에서 고객사를 추가해 주세요
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {orgs.map((org) => (
            <OrgCard key={org.id} org={org} />
          ))}
        </div>
      )}
    </div>
  );
}
