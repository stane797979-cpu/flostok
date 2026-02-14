"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  deleteProduct,
  deleteProducts,
  checkProductDeleteDependencies,
} from "@/server/actions/products";
import {
  Loader2,
  AlertTriangle,
  ShieldAlert,
  Info,
  Package,
  History,
  FileText,
  TrendingDown,
  Truck,
} from "lucide-react";
import type { DependencyCheckResult } from "@/server/services/deletion/dependency-checker";

interface ProductDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productIds: string[];
  productNames?: string[];
}

const DEPENDENCY_ICONS: Record<string, React.ReactNode> = {
  inventory: <Package className="h-4 w-4" />,
  inventory_history: <History className="h-4 w-4" />,
  purchase_order_items: <FileText className="h-4 w-4" />,
  sales_records: <TrendingDown className="h-4 w-4" />,
  inbound_records: <Truck className="h-4 w-4" />,
};

export function ProductDeleteDialog({
  open,
  onOpenChange,
  productIds,
  productNames = [],
}: ProductDeleteDialogProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [reason, setReason] = useState("");
  const [depCheck, setDepCheck] = useState<DependencyCheckResult | null>(null);
  const isBulk = productIds.length > 1;

  // 다이얼로그 열릴 때 의존성 체크 (단건만)
  useEffect(() => {
    if (open && !isBulk && productIds[0]) {
      setIsChecking(true);
      setDepCheck(null);
      setReason("");
      checkProductDeleteDependencies(productIds[0])
        .then(setDepCheck)
        .catch(console.error)
        .finally(() => setIsChecking(false));
    } else if (open && isBulk) {
      setReason("");
      setDepCheck(null);
    }
  }, [open, productIds, isBulk]);

  const handleDelete = async () => {
    if (!reason.trim()) return;
    setIsLoading(true);
    try {
      if (isBulk) {
        await deleteProducts(productIds, reason);
      } else if (productIds[0]) {
        await deleteProduct(productIds[0], reason);
      }
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      console.error("삭제 오류:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const impactColor =
    depCheck?.impactLevel === "high"
      ? "destructive"
      : depCheck?.impactLevel === "medium"
        ? "secondary"
        : "outline";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            {isBulk ? `${productIds.length}개 제품 삭제` : "제품 삭제"}
          </DialogTitle>
          <DialogDescription>
            {isBulk
              ? `선택한 ${productIds.length}개 제품에 대해 삭제를 진행합니다.`
              : `${productNames[0] || "이 제품"}에 대해 삭제를 진행합니다.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 의존성 체크 로딩 */}
          {isChecking && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              영향 범위 분석 중...
            </div>
          )}

          {/* 의존성 경고 (단건) */}
          {depCheck && depCheck.dependencies.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">영향 범위</span>
                <Badge variant={impactColor as "destructive" | "secondary" | "outline"}>
                  {depCheck.impactLevel === "high"
                    ? "높음"
                    : depCheck.impactLevel === "medium"
                      ? "보통"
                      : "낮음"}
                </Badge>
              </div>
              <div className="rounded-md border p-3 space-y-1">
                {depCheck.dependencies.map((dep) => (
                  <div
                    key={dep.entityType}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {DEPENDENCY_ICONS[dep.entityType] || (
                        <Package className="h-4 w-4" />
                      )}
                      {dep.label}
                    </div>
                    <Badge variant="secondary">{dep.count}건</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 에러 (삭제 불가) */}
          {depCheck?.errors.map((error, i) => (
            <Alert key={i} variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ))}

          {/* 경고 */}
          {depCheck?.warnings.map((warning, i) => (
            <Alert key={i}>
              <Info className="h-4 w-4" />
              <AlertDescription>{warning}</AlertDescription>
            </Alert>
          ))}

          {/* 삭제 사유 입력 */}
          <div className="space-y-2">
            <Label htmlFor="delete-reason">삭제 사유 (필수)</Label>
            <Textarea
              id="delete-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="삭제가 필요한 이유를 입력해주세요..."
              rows={3}
            />
          </div>

          {/* 프로세스 안내 */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              삭제된 데이터는 감사 로그에 기록되며, 관리자가 복구할 수 있습니다.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            취소
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={
              !reason.trim() ||
              isLoading ||
              isChecking ||
              (depCheck !== null && !depCheck.canDelete)
            }
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            삭제
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
