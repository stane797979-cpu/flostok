import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Users,
  Package,
  ShoppingCart,
  Archive,
  BarChart3,
  DollarSign,
} from "lucide-react";
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
import {
  getOrganizationDetail,
  getOrganizationProducts,
  getOrganizationInventory,
  getOrganizationSales,
  getOrganizationOrders,
  getOrganizationKpi,
} from "@/server/actions/admin";

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

const orderStatusColors: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-300",
  pending: "bg-yellow-100 text-yellow-700 border-yellow-300",
  approved: "bg-blue-100 text-blue-700 border-blue-300",
  ordered: "bg-indigo-100 text-indigo-700 border-indigo-300",
  confirmed: "bg-cyan-100 text-cyan-700 border-cyan-300",
  shipped: "bg-teal-100 text-teal-700 border-teal-300",
  partially_received: "bg-orange-100 text-orange-700 border-orange-300",
  received: "bg-green-100 text-green-700 border-green-300",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-300",
  cancelled: "bg-red-100 text-red-700 border-red-300",
};

const orderStatusLabels: Record<string, string> = {
  draft: "초안",
  pending: "검토대기",
  approved: "승인됨",
  ordered: "발주완료",
  confirmed: "공급자확인",
  shipped: "출하됨",
  partially_received: "부분입고",
  received: "입고완료",
  completed: "완료",
  cancelled: "취소",
};

const invStatusColors: Record<string, string> = {
  out_of_stock: "bg-black text-white border-black",
  critical: "bg-red-100 text-red-700 border-red-300",
  shortage: "bg-orange-100 text-orange-700 border-orange-300",
  caution: "bg-yellow-100 text-yellow-700 border-yellow-300",
  optimal: "bg-green-100 text-green-700 border-green-300",
  excess: "bg-blue-100 text-blue-700 border-blue-300",
  overstock: "bg-purple-100 text-purple-700 border-purple-300",
};

const invStatusLabels: Record<string, string> = {
  out_of_stock: "품절",
  critical: "위험",
  shortage: "부족",
  caution: "주의",
  optimal: "적정",
  excess: "과다",
  overstock: "과잉",
};

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [detailRes, productsRes, inventoryRes, salesRes, ordersRes, kpiRes] =
    await Promise.allSettled([
      getOrganizationDetail(id),
      getOrganizationProducts(id),
      getOrganizationInventory(id),
      getOrganizationSales(id),
      getOrganizationOrders(id),
      getOrganizationKpi(id),
    ]);

  // Extract results safely
  const detail =
    detailRes.status === "fulfilled" && detailRes.value.success
      ? detailRes.value.data
      : null;
  if (!detail) notFound();
  const { organization, users, subscription, usageStats, recentPayments } =
    detail;

  const productItems =
    productsRes.status === "fulfilled" && productsRes.value.success
      ? productsRes.value.data
      : [];
  const inventoryItems =
    inventoryRes.status === "fulfilled" && inventoryRes.value.success
      ? inventoryRes.value.data
      : [];
  const salesItems =
    salesRes.status === "fulfilled" && salesRes.value.success
      ? salesRes.value.data
      : [];
  const orderItems =
    ordersRes.status === "fulfilled" && ordersRes.value.success
      ? ordersRes.value.data
      : [];
  const kpiItems =
    kpiRes.status === "fulfilled" && kpiRes.value.success
      ? kpiRes.value.data
      : [];

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
              <span className="font-semibold">
                {planLabels[organization.plan] || organization.plan}
              </span>
            </div>
            <div>
              <span className="text-slate-500">가입일: </span>
              <span>
                {new Date(organization.createdAt).toLocaleDateString("ko-KR")}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 사용 통계 */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {[
          { title: "사용자", value: usageStats.userCount, icon: Users },
          { title: "제품", value: usageStats.productCount, icon: Package },
          { title: "발주", value: usageStats.orderCount, icon: ShoppingCart },
          { title: "재고", value: usageStats.inventoryCount, icon: Archive },
          { title: "판매", value: salesItems.length, icon: DollarSign },
          { title: "KPI", value: kpiItems.length, icon: BarChart3 },
        ].map(({ title, value, icon: Icon }) => (
          <Card key={title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">
                {title}
              </CardTitle>
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
        <TabsList className="flex-wrap">
          <TabsTrigger value="users">사용자 ({users.length})</TabsTrigger>
          <TabsTrigger value="products">
            제품 ({productItems.length})
          </TabsTrigger>
          <TabsTrigger value="inventory">
            재고 ({inventoryItems.length})
          </TabsTrigger>
          <TabsTrigger value="sales">판매 ({salesItems.length})</TabsTrigger>
          <TabsTrigger value="orders">발주 ({orderItems.length})</TabsTrigger>
          <TabsTrigger value="kpi">KPI ({kpiItems.length})</TabsTrigger>
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
                    <TableCell
                      colSpan={4}
                      className="h-24 text-center text-slate-500"
                    >
                      사용자가 없습니다
                    </TableCell>
                  </TableRow>
                )}
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>{user.name || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-medium",
                          roleColors[user.role] || ""
                        )}
                      >
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

        {/* 제품 탭 */}
        <TabsContent value="products">
          <div className="rounded-lg border bg-white dark:bg-slate-950">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>제품명</TableHead>
                  <TableHead>카테고리</TableHead>
                  <TableHead>ABC/XYZ</TableHead>
                  <TableHead className="text-right">안전재고</TableHead>
                  <TableHead className="text-right">발주점</TableHead>
                  <TableHead className="text-right">리드타임(일)</TableHead>
                  <TableHead>상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productItems.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-24 text-center text-slate-500"
                    >
                      등록된 제품이 없습니다
                    </TableCell>
                  </TableRow>
                )}
                {productItems.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-mono text-sm">
                      {product.sku}
                    </TableCell>
                    <TableCell className="font-medium">
                      {product.name}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {product.category || "-"}
                    </TableCell>
                    <TableCell>
                      {product.abcClass && product.xyzClass ? (
                        <Badge
                          variant="outline"
                          className="font-medium bg-slate-100 text-slate-700 border-slate-300"
                        >
                          {product.abcClass}-{product.xyzClass}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {product.safetyStock?.toLocaleString("ko-KR") || "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {product.reorderPoint?.toLocaleString("ko-KR") || "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {product.leadTimeDays ?? "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-medium",
                          product.isActive
                            ? "bg-green-100 text-green-700 border-green-300"
                            : "bg-slate-100 text-slate-700 border-slate-300"
                        )}
                      >
                        {product.isActive ? "활성" : "비활성"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* 재고 탭 */}
        <TabsContent value="inventory">
          <div className="rounded-lg border bg-white dark:bg-slate-950">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>제품명</TableHead>
                  <TableHead className="text-right">현재고</TableHead>
                  <TableHead className="text-right">가용재고</TableHead>
                  <TableHead className="text-right">입고예정</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="text-right">재고일수</TableHead>
                  <TableHead>위치</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventoryItems.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-24 text-center text-slate-500"
                    >
                      재고 데이터가 없습니다
                    </TableCell>
                  </TableRow>
                )}
                {inventoryItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">
                      {item.productSku}
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.productName}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.currentStock.toLocaleString("ko-KR")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.availableStock.toLocaleString("ko-KR")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.inboundQty?.toLocaleString("ko-KR") || "0"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-medium",
                          invStatusColors[item.status] || ""
                        )}
                      >
                        {invStatusLabels[item.status] || item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm text-slate-600">
                      {item.daysOfStock !== null &&
                      item.daysOfStock !== undefined
                        ? `${item.daysOfStock}일`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {item.location || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* 판매 탭 */}
        <TabsContent value="sales">
          <div className="rounded-lg border bg-white dark:bg-slate-950">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>판매일</TableHead>
                  <TableHead>제품</TableHead>
                  <TableHead className="text-right">수량</TableHead>
                  <TableHead className="text-right">단가</TableHead>
                  <TableHead className="text-right">금액</TableHead>
                  <TableHead>채널</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesItems.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-slate-500"
                    >
                      판매 기록이 없습니다
                    </TableCell>
                  </TableRow>
                )}
                {salesItems.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="text-sm">
                      {new Date(sale.salesDate).toLocaleDateString("ko-KR")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {sale.productSku && sale.productName
                        ? `${sale.productSku} / ${sale.productName}`
                        : sale.productName || "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {sale.quantity.toLocaleString("ko-KR")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm text-slate-600">
                      {sale.unitPrice?.toLocaleString("ko-KR") || "-"}원
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {sale.totalAmount.toLocaleString("ko-KR")}원
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {sale.channel || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* 발주 탭 */}
        <TabsContent value="orders">
          <div className="rounded-lg border bg-white dark:bg-slate-950">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>발주번호</TableHead>
                  <TableHead>공급자</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>발주일</TableHead>
                  <TableHead>예상입고일</TableHead>
                  <TableHead className="text-right">금액</TableHead>
                  <TableHead>자동발주</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderItems.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-24 text-center text-slate-500"
                    >
                      발주 내역이 없습니다
                    </TableCell>
                  </TableRow>
                )}
                {orderItems.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-sm">
                      {order.orderNumber}
                    </TableCell>
                    <TableCell className="font-medium">
                      {order.supplierName || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-medium",
                          orderStatusColors[order.status] || ""
                        )}
                      >
                        {orderStatusLabels[order.status] || order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(order.orderDate).toLocaleDateString("ko-KR")}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {order.expectedDeliveryDate
                        ? new Date(order.expectedDeliveryDate).toLocaleDateString(
                            "ko-KR"
                          )
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {order.totalAmount?.toLocaleString("ko-KR") || "0"}원
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-medium",
                          order.isAutoGenerated
                            ? "bg-blue-100 text-blue-700 border-blue-300"
                            : "bg-slate-100 text-slate-700 border-slate-300"
                        )}
                      >
                        {order.isAutoGenerated ? "자동" : "수동"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* KPI 탭 */}
        <TabsContent value="kpi">
          <div className="rounded-lg border bg-white dark:bg-slate-950">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>기간</TableHead>
                  <TableHead className="text-right">재고회전율</TableHead>
                  <TableHead className="text-right">결품률</TableHead>
                  <TableHead className="text-right">납기준수율</TableHead>
                  <TableHead className="text-right">발주충족률</TableHead>
                  <TableHead className="text-right">실출고율</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kpiItems.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-slate-500"
                    >
                      KPI 스냅샷이 없습니다
                    </TableCell>
                  </TableRow>
                )}
                {kpiItems.map((kpi) => (
                  <TableRow key={kpi.id}>
                    <TableCell className="font-medium">
                      {kpi.year}년 {kpi.month.toString().padStart(2, "0")}월
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {kpi.turnoverRate !== null &&
                      kpi.turnoverRate !== undefined
                        ? `${kpi.turnoverRate.toFixed(2)}회`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {kpi.stockoutRate !== null &&
                      kpi.stockoutRate !== undefined
                        ? `${(kpi.stockoutRate * 100).toFixed(1)}%`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {kpi.onTimeDeliveryRate !== null &&
                      kpi.onTimeDeliveryRate !== undefined
                        ? `${(kpi.onTimeDeliveryRate * 100).toFixed(1)}%`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {kpi.fulfillmentRate !== null &&
                      kpi.fulfillmentRate !== undefined
                        ? `${(kpi.fulfillmentRate * 100).toFixed(1)}%`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {kpi.actualShipmentRate !== null &&
                      kpi.actualShipmentRate !== undefined
                        ? `${(kpi.actualShipmentRate * 100).toFixed(1)}%`
                        : "-"}
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
                <p className="text-sm text-slate-500">
                  구독 정보가 없습니다 (무료 플랜)
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">플랜</p>
                    <p className="text-lg font-semibold">
                      {planLabels[subscription.plan] || subscription.plan}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">상태</p>
                    <Badge
                      variant="outline"
                      className={cn(
                        "mt-1 font-medium",
                        statusColors[subscription.status] || ""
                      )}
                    >
                      {statusLabels[subscription.status] || subscription.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">결제 주기</p>
                    <p className="font-medium">
                      {subscription.billingCycle === "monthly"
                        ? "월간"
                        : "연간"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">다음 결제일</p>
                    <p className="font-medium">
                      {new Date(subscription.currentPeriodEnd).toLocaleDateString(
                        "ko-KR"
                      )}
                    </p>
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
                    <div
                      key={payment.id}
                      className="flex items-center justify-between border-b pb-3 last:border-0"
                    >
                      <div>
                        <p className="font-medium">
                          {payment.amount.toLocaleString("ko-KR")}원
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(payment.createdAt).toLocaleDateString(
                            "ko-KR"
                          )}{" "}
                          · {payment.method}
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
                        {payment.status === "success"
                          ? "성공"
                          : payment.status === "refunded"
                            ? "환불"
                            : "실패"}
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
