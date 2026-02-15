"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createProduct, updateProduct, type ProductInput } from "@/server/actions/products";
import { type Product } from "@/server/db/schema";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  categories?: string[];
}

const UNITS = ["EA", "BOX", "SET", "KG", "L", "M", "롤", "켤레"];
const ABC_GRADES = ["A", "B", "C"] as const;
const XYZ_GRADES = ["X", "Y", "Z"] as const;
const FMR_GRADES = ["F", "M", "R"] as const;
const FMR_LABELS: Record<string, string> = {
  F: "F (고빈도)",
  M: "M (중빈도)",
  R: "R (저빈도)",
};

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  categories = [],
}: ProductFormDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const isEditing = !!product;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<ProductInput>({
    sku: product?.sku || "",
    name: product?.name || "",
    category: product?.category || "",
    description: product?.description || "",
    unit: product?.unit || "EA",
    unitPrice: product?.unitPrice || 0,
    costPrice: product?.costPrice || 0,
    abcGrade: product?.abcGrade || undefined,
    xyzGrade: product?.xyzGrade || undefined,
    fmrGrade: product?.fmrGrade || undefined,
    moq: product?.moq || 1,
    leadTime: product?.leadTime || 7,
    safetyStock: product?.safetyStock || 0,
    reorderPoint: product?.reorderPoint || 0,
    targetStock: product?.targetStock || undefined,
    barcode: product?.barcode || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = isEditing
        ? await updateProduct(product.id, formData)
        : await createProduct(formData);

      if (result.success) {
        if (result.isRequest) {
          toast({
            title: isEditing ? "수정 요청 제출됨" : "등록 요청 제출됨",
            description: isEditing
              ? "제품 수정 요청이 제출되었습니다. 슈퍼관리자 승인 후 반영됩니다."
              : "제품 등록 요청이 제출되었습니다. 슈퍼관리자 승인 후 등록됩니다.",
          });
        } else {
          toast({
            title: isEditing ? "제품 수정 완료" : "제품 등록 완료",
            description: isEditing
              ? "제품 정보가 성공적으로 수정되었습니다."
              : "새로운 제품이 성공적으로 등록되었습니다.",
          });
        }
        onOpenChange(false);
        router.refresh();
      } else {
        setError(result.error || "작업에 실패했습니다");
      }
    } catch {
      setError("알 수 없는 오류가 발생했습니다");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: keyof ProductInput, value: string | number | undefined) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "제품 수정" : "제품 등록"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "제품 정보를 수정합니다." : "새로운 제품(SKU)을 등록합니다."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* 기본 정보 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU *</Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => handleChange("sku", e.target.value)}
                  placeholder="SKU-001"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">제품명 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="스테인리스 볼트 M10"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">카테고리</Label>
                <Select
                  value={formData.category || ""}
                  onValueChange={(value) => handleChange("category", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="선택..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                    <SelectItem value="체결류">체결류</SelectItem>
                    <SelectItem value="프레임">프레임</SelectItem>
                    <SelectItem value="동력전달">동력전달</SelectItem>
                    <SelectItem value="유압">유압</SelectItem>
                    <SelectItem value="전기">전기</SelectItem>
                    <SelectItem value="소모품">소모품</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">단위</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(value) => handleChange("unit", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 가격 정보 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unitPrice">판매단가 (원)</Label>
                <Input
                  id="unitPrice"
                  type="number"
                  min={0}
                  value={formData.unitPrice}
                  onChange={(e) => handleChange("unitPrice", parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="costPrice">원가 (원)</Label>
                <Input
                  id="costPrice"
                  type="number"
                  min={0}
                  value={formData.costPrice}
                  onChange={(e) => handleChange("costPrice", parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* 등급 */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>ABC 등급</Label>
                <Select
                  value={formData.abcGrade || ""}
                  onValueChange={(value) =>
                    handleChange("abcGrade", value as "A" | "B" | "C" | undefined)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="미지정" />
                  </SelectTrigger>
                  <SelectContent>
                    {ABC_GRADES.map((grade) => (
                      <SelectItem key={grade} value={grade}>
                        {grade}등급
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>XYZ 등급</Label>
                <Select
                  value={formData.xyzGrade || ""}
                  onValueChange={(value) =>
                    handleChange("xyzGrade", value as "X" | "Y" | "Z" | undefined)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="미지정" />
                  </SelectTrigger>
                  <SelectContent>
                    {XYZ_GRADES.map((grade) => (
                      <SelectItem key={grade} value={grade}>
                        {grade}등급
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>FMR 등급</Label>
                <Select
                  value={formData.fmrGrade || ""}
                  onValueChange={(value) =>
                    handleChange("fmrGrade", value as "F" | "M" | "R" | undefined)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="미지정" />
                  </SelectTrigger>
                  <SelectContent>
                    {FMR_GRADES.map((grade) => (
                      <SelectItem key={grade} value={grade}>
                        {FMR_LABELS[grade]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 발주 관련 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="moq">최소발주수량 (MOQ)</Label>
                <Input
                  id="moq"
                  type="number"
                  min={1}
                  value={formData.moq}
                  onChange={(e) => handleChange("moq", parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="leadTime">리드타임 (일)</Label>
                <Input
                  id="leadTime"
                  type="number"
                  min={0}
                  value={formData.leadTime}
                  onChange={(e) => handleChange("leadTime", parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* 재고 관련 */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="safetyStock">안전재고</Label>
                <Input
                  id="safetyStock"
                  type="number"
                  min={0}
                  value={formData.safetyStock}
                  onChange={(e) => handleChange("safetyStock", parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reorderPoint">발주점</Label>
                <Input
                  id="reorderPoint"
                  type="number"
                  min={0}
                  value={formData.reorderPoint}
                  onChange={(e) => handleChange("reorderPoint", parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetStock">목표재고</Label>
                <Input
                  id="targetStock"
                  type="number"
                  min={0}
                  value={formData.targetStock || ""}
                  onChange={(e) =>
                    handleChange(
                      "targetStock",
                      e.target.value ? parseInt(e.target.value) : undefined
                    )
                  }
                />
              </div>
            </div>

            {/* 바코드 */}
            <div className="space-y-2">
              <Label htmlFor="barcode">바코드</Label>
              <Input
                id="barcode"
                value={formData.barcode}
                onChange={(e) => handleChange("barcode", e.target.value)}
                placeholder="선택 사항"
              />
            </div>

            {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              취소
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "수정" : "등록"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
