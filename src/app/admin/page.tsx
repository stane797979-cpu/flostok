import { Building2, Users, DollarSign, CreditCard, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSystemStats } from "@/server/actions/admin";

function StatCard({
  title,
  value,
  unit,
  description,
  icon: Icon,
}: {
  title: string;
  value: number | string;
  unit?: string;
  description: string;
  icon: React.ElementType;
}) {
  const formatted = typeof value === "number" ? value.toLocaleString("ko-KR") : value;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
        <Icon className="h-4 w-4 text-slate-400" />
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold">{formatted}</span>
          {unit && <span className="text-sm text-slate-500">{unit}</span>}
        </div>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </CardContent>
    </Card>
  );
}

export default async function AdminDashboardPage() {
  const result = await getSystemStats();

  if (!result.success) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">시스템 대시보드</h1>
        <p className="text-red-600">통계 로드 실패: {result.error}</p>
      </div>
    );
  }

  const stats = result.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">시스템 대시보드</h1>
        <p className="mt-2 text-slate-500">Stock & Logis 전체 시스템 현황</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="총 조직 수"
          value={stats.totalOrganizations}
          unit="개"
          description="등록된 테넌트 조직"
          icon={Building2}
        />
        <StatCard
          title="총 사용자 수"
          value={stats.totalUsers}
          unit="명"
          description="전체 활성 사용자"
          icon={Users}
        />
        <StatCard
          title="총 매출"
          value={stats.totalRevenue.toLocaleString("ko-KR")}
          unit="원"
          description="누적 결제 금액"
          icon={DollarSign}
        />
        <StatCard
          title="활성 구독"
          value={stats.activeSubscriptions}
          unit="개"
          description="현재 활성 구독"
          icon={CreditCard}
        />
        <StatCard
          title="신규 가입 (30일)"
          value={stats.recentSignupsCount}
          unit="개"
          description="최근 30일 신규 조직"
          icon={TrendingUp}
        />
      </div>
    </div>
  );
}
