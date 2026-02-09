import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getAllOrganizations } from "@/server/actions/admin";
import { cn } from "@/lib/utils";
import { OrganizationActions } from "./_components/organization-actions";

const planColors: Record<string, string> = {
  free: "bg-slate-100 text-slate-700 border-slate-300",
  starter: "bg-blue-100 text-blue-700 border-blue-300",
  pro: "bg-purple-100 text-purple-700 border-purple-300",
  enterprise: "bg-amber-100 text-amber-700 border-amber-300",
};

const planLabels: Record<string, string> = {
  free: "무료",
  starter: "스타터",
  pro: "프로",
  enterprise: "엔터프라이즈",
};

export default async function OrganizationsPage() {
  const result = await getAllOrganizations();

  if (!result.success) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">조직 관리</h1>
        <p className="text-red-600">조직 목록 로드 실패: {result.error}</p>
      </div>
    );
  }

  const orgs = result.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">조직 관리</h1>
        <p className="mt-2 text-slate-500">전체 {orgs.length}개 조직</p>
      </div>

      <div className="rounded-lg border bg-white dark:bg-slate-950">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>조직명</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>플랜</TableHead>
              <TableHead className="text-right">사용자</TableHead>
              <TableHead className="text-right">제품</TableHead>
              <TableHead className="text-right">발주</TableHead>
              <TableHead>가입일</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orgs.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-slate-500">
                  등록된 조직이 없습니다
                </TableCell>
              </TableRow>
            )}
            {orgs.map((org) => (
              <TableRow key={org.id}>
                <TableCell className="font-medium">{org.name}</TableCell>
                <TableCell className="font-mono text-sm text-slate-500">{org.slug}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("font-medium", planColors[org.plan] || "")}>
                    {planLabels[org.plan] || org.plan}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{org.userCount}</TableCell>
                <TableCell className="text-right">{org.productCount}</TableCell>
                <TableCell className="text-right">{org.orderCount}</TableCell>
                <TableCell className="text-sm text-slate-500">
                  {new Date(org.createdAt).toLocaleDateString("ko-KR")}
                </TableCell>
                <TableCell>
                  <OrganizationActions orgId={org.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
