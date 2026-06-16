"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { deleteProduct, deleteProducts } from "@/server/actions/products";
import { Loader2 } from "lucide-react";

interface ProductDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productIds: string[];
  productNames?: string[];
}

export function ProductDeleteDialog({
  open,
  onOpenChange,
  productIds,
  productNames = [],
}: ProductDeleteDialogProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const isBulk = productIds.length > 1;

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      if (isBulk) {
        await deleteProducts(productIds);
      } else if (productIds[0]) {
        await deleteProduct(productIds[0]);
      }
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      console.error("삭제 오류:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isBulk ? `${productIds.length}개 제품 삭제` : "제품 삭제"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isBulk ? (
              <>
                선택한 <strong>{productIds.length}개</strong> 제품을 삭제하시겠습니까?
                <br />이 작업은 되돌릴 수 없습니다.
              </>
            ) : (
              <>
                <strong>{productNames[0] || "이 제품"}</strong>을(를) 삭제하시겠습니까?
                <br />
                관련된 재고 및 발주 기록도 함께 삭제됩니다.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>취소</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            삭제
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
