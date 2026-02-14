"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, MoreHorizontal, Edit, Trash2, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteWarehouse } from "@/server/actions/warehouses";
import { toast } from "sonner";
import { WarehouseFormDialog } from "./warehouse-form-dialog";
import { WarehouseTransferDialog } from "./warehouse-transfer-dialog";

interface Warehouse {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  type: string;
  address: string | null;
  isActive: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface WarehousesPageClientProps {
  warehouses: Warehouse[];
}

const WAREHOUSE_TYPE_LABEL: Record<string, string> = {
  MAIN: "본사 창고",
  REGIONAL: "지역 창고",
  VIRTUAL: "가상 창고",
  THIRD_PARTY: "3PL 창고",
};

export function WarehousesPageClient({ warehouses }: WarehousesPageClientProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editWarehouse, setEditWarehouse] = useState<Warehouse | null>(null);
  const [deleteWarehouseId, setDeleteWarehouseId] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const router = useRouter();

  const totalCount = warehouses.length;
  const activeCount = warehouses.filter((w) => w.isActive).length;
  const inactiveCount = warehouses.filter((w) => !w.isActive).length;

  const handleEdit = (warehouse: Warehouse) => {
    setEditWarehouse(warehouse);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteWarehouseId) return;

    const result = await deleteWarehouse(deleteWarehouseId);

    if (result.success) {
      toast.success("창고가 삭제되었습니다");
      router.refresh();
    } else {
      toast.error(result.error || "창고 삭제에 실패했습니다");
    }

    setDeleteWarehouseId(null);
  };

  const handleRefresh = () => {
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* 통계 카드 */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              총 창고
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">
              활성 창고
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeCount}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              비활성 창고
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-600">{inactiveCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* 액션 바 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">창고 목록</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTransferOpen(true)}
          >
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            창고 간 재고 이동
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            신규 창고 추가
          </Button>
        </div>
      </div>

      {/* 창고 목록 테이블 */}
      <div className="rounded-lg border bg-white dark:bg-slate-950">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">코드</TableHead>
              <TableHead>이름</TableHead>
              <TableHead className="w-[120px]">유형</TableHead>
              <TableHead>주소</TableHead>
              <TableHead className="w-[100px] text-center">상태</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {warehouses.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                  창고가 없습니다. 신규 창고를 추가하세요.
                </TableCell>
              </TableRow>
            )}
            {warehouses.map((warehouse) => (
              <TableRow
                key={warehouse.id}
                className={cn(!warehouse.isActive && "opacity-50")}
              >
                <TableCell className="font-mono font-medium">
                  {warehouse.code}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{warehouse.name}</span>
                    {warehouse.isDefault && (
                      <Badge variant="default" className="text-xs">
                        기본
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {WAREHOUSE_TYPE_LABEL[warehouse.type] || warehouse.type}
                </TableCell>
                <TableCell className="text-sm text-slate-500">
                  {warehouse.address || "-"}
                </TableCell>
                <TableCell className="text-center">
                  {warehouse.isActive ? (
                    <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">
                      활성
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
                      비활성
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(warehouse)}>
                        <Edit className="mr-2 h-4 w-4" />
                        수정
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeleteWarehouseId(warehouse.id)}
                        disabled={warehouse.isDefault}
                        className={cn(
                          !warehouse.isDefault && "text-red-600 focus:text-red-600"
                        )}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        삭제
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* 신규 창고 추가 다이얼로그 */}
      <WarehouseFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSuccess={handleRefresh}
      />

      {/* 창고 수정 다이얼로그 */}
      <WarehouseFormDialog
        open={!!editWarehouse}
        onOpenChange={(open) => !open && setEditWarehouse(null)}
        mode="edit"
        warehouse={editWarehouse || undefined}
        onSuccess={handleRefresh}
      />

      {/* 창고 삭제 확인 다이얼로그 */}
      <AlertDialog
        open={!!deleteWarehouseId}
        onOpenChange={(open) => !open && setDeleteWarehouseId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>창고 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 창고를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
              창고와 연결된 재고 데이터가 함께 삭제될 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 창고 간 재고 이동 다이얼로그 */}
      <WarehouseTransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        warehouses={warehouses.filter((w) => w.isActive)}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
