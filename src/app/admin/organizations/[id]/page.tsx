import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, Users, Package, ShoppingCart, Archive } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getOrganizationDetail } from "@/server/actions/admin";

const roleColors: Record<string, string> = {
  admin: "bg-red-100 text-red-700 border-red-300",
  manager: "bg-blue-100 text-blue-700 border-blue-300",
  viewer: "bg-slate-100 text-slate-700 border-slate-300",
};

const roleLabels: Record<string, string> = {
  admin: "관리자",
  manager: "매니저",
  viewer: "뷰어",
};

const planLabels: Record<string, string> = {
  free: "무료",
  starter: "스타터",
  pro: "프로",
  enterprise: "엔터프라이즈",
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700 border-green-300",
  canceled: "bg-red-100 text-red-700 border-red-300",
  expired: "bg-slate-100 text-slate-700 border-slate-300",
  pending: "bg-yellow-100 text-yellow-700 border-yellow-300",
};

const statusLabels: Record<string, string> = {
  active: "활성",
  canceled: "취소됨",
  expired: "만료",
  pending: "대기중",
  failed: "실패",
};

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getOrganizationDetail(id);

  if (!result.success) {
    notFound();
  }

  const { organization, users, subscription, usageStats, recentPayments } = result.data;

  return (
    <div className="space-y-6">
      {/* 뒤로가기 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/organizations">
            <ArrowLeft className="mr-2 h-4 w-4" />
            목록으로
          </Link>
        </Button>
      </div>

      {/* 조직 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {organization.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Slug: </span>
              <span className="font-mono">{organization.slug}</span>
            </div>
            <div>
              <span className="text-slate-500">플랜: </span>
              <span className="font-semibold">{planLabels[organization.plan] || organization.plan}</span>
            </div>
            <div>
              <span className="text-slate-500">가입일: </span>
              <span>{new Date(organization.createdAt).toLocaleDateString("ko-KR")}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 사용 통계 */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { title: "사용자", value: usageStats.userCount, icon: Users },
          { title: "제품", value: usageStats.productCount, icon: Package },
          { title: "발주", value: usageStats.orderCount, icon: ShoppingCart },
          { title: "재고", value: usageStats.inventoryCount, icon: Archive },
        ].map(({ title, value, icon: Icon }) => (
          <Card key={title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
              <Icon className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 탭 */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">사용자 ({users.length})</TabsTrigger>
          <TabsTrigger value="subscription">구독</TabsTrigger>
          <TabsTrigger value="payments">결제 내역</TabsTrigger>
        </TabsList>

        {/* 사용자 탭 */}
        <TabsContent value="users">
          <div className="rounded-lg border bg-white dark:bg-slate-950">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이메일</TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead>역할</TableHead>
                  <TableHead>가입일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-slate-500">
                      사용자가 없습니다
                    </TableCell>
                  </TableRow>
                )}
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>{user.name || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("font-medium", roleColors[user.role] || "")}>
                        {roleLabels[user.role] || user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {new Date(user.createdAt).toLocaleDateString("ko-KR")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* 구독 탭 */}
        <TabsContent value="subscription">
          <Card>
            <CardHeader>
              <CardTitle>구독 정보</CardTitle>
            </CardHeader>
            <CardContent>
              {!subscription ? (
                <p className="text-sm text-slate-500">구독 정보가 없습니다 (무료 플랜)</p>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">플랜</p>
                    <p className="text-lg font-semibold">{planLabels[subscription.plan] || subscription.plan}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">상태</p>
                    <Badge variant="outline" className={cn("mt-1 font-medium", statusColors[subscription.status] || "")}>
                      {statusLabels[subscription.status] || subscription.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">결제 주기</p>
                    <p className="font-medium">{subscription.billingCycle === "monthly" ? "월간" : "연간"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">다음 결제일</p>
                    <p className="font-medium">{new Date(subscription.currentPeriodEnd).toLocaleDateString("ko-KR")}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 결제 내역 탭 */}
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>최근 결제 내역</CardTitle>
            </CardHeader>
            <CardContent>
              {recentPayments.length === 0 ? (
                <p className="text-sm text-slate-500">결제 내역이 없습니다</p>
              ) : (
                <div className="space-y-3">
                  {recentPayments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                      <div>
                        <p className="font-medium">{payment.amount.toLocaleString("ko-KR")}원</p>
                        <p className="text-xs text-slate-500">
                          {new Date(payment.createdAt).toLocaleDateString("ko-KR")} · {payment.method}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-medium",
                          payment.status === "success"
                            ? "bg-green-100 text-green-700 border-green-300"
                            : "bg-red-100 text-red-700 border-red-300"
                        )}
                      >
                        {payment.status === "success" ? "성공" : payment.status === "refunded" ? "환불" : "실패"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
