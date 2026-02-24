"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Loader2 } from "lucide-react";
import { createWarehouse, updateWarehouse } from "@/server/actions/warehouses";
import { useToast } from "@/hooks/use-toast";

interface Warehouse {
  id: string;
  code: string;
  name: string;
  type: string;
  address: string | null;
  isActive: boolean;
}

interface WarehouseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  warehouse?: Warehouse;
  onSuccess: () => void;
}

const WAREHOUSE_TYPES = [
  { value: "MAIN", label: "본사 창고" },
  { value: "REGIONAL", label: "지역 창고" },
  { value: "VIRTUAL", label: "가상 창고" },
  { value: "THIRD_PARTY", label: "3PL 창고" },
];

export function WarehouseFormDialog({
  open,
  onOpenChange,
  mode,
  warehouse,
  onSuccess,
}: WarehouseFormDialogProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("MAIN");
  const [address, setAddress] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  // 수정 모드일 때 기존 데이터 채우기
  useEffect(() => {
    if (open && mode === "edit" && warehouse) {
      setCode(warehouse.code);
      setName(warehouse.name);
      setType(warehouse.type);
      setAddress(warehouse.address || "");
      setIsActive(warehouse.isActive);
    } else if (open && mode === "create") {
      // 생성 모드일 때 초기화
      setCode("");
      setName("");
      setType("MAIN");
      setAddress("");
      setIsActive(true);
    }
  }, [open, mode, warehouse]);

  const handleSubmit = () => {
    // 유효성 검증
    if (!code.trim()) {
      toast({ title: "창고 코드를 입력하세요", variant: "destructive" });
      return;
    }

    if (!/^[A-Z0-9_]+$/.test(code.trim())) {
      toast({ title: "창고 코드는 영문 대문자, 숫자, 밑줄(_)만 사용할 수 있습니다", variant: "destructive" });
      return;
    }

    if (!name.trim()) {
      toast({ title: "창고명을 입력하세요", variant: "destructive" });
      return;
    }

    startTransition(async () => {
      try {
        if (mode === "create") {
          const result = await createWarehouse({
            code: code.trim().toUpperCase(),
            name: name.trim(),
            type,
            address: address.trim() || undefined,
          });

          if (result.success) {
            toast({ title: "창고가 생성되었습니다" });
            onSuccess();
            onOpenChange(false);
          } else {
            toast({ title: result.error || "창고 생성에 실패했습니다", variant: "destructive" });
          }
        } else if (mode === "edit" && warehouse) {
          const result = await updateWarehouse(warehouse.id, {
            code: code.trim().toUpperCase(),
            name: name.trim(),
            type,
            address: address.trim() || undefined,
            isActive,
          });

          if (result.success) {
            toast({ title: "창고가 수정되었습니다" });
            onSuccess();
            onOpenChange(false);
          } else {
            toast({ title: result.error || "창고 수정에 실패했습니다", variant: "destructive" });
          }
        }
      } catch (error) {
        console.error("창고 저장 오류:", error);
        toast({ title: "서버 오류가 발생했습니다", variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "신규 창고 추가" : "창고 수정"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "새로운 창고 정보를 입력하세요"
              : "창고 정보를 수정하세요"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 창고 코드 */}
          <div className="space-y-2">
            <Label htmlFor="code">
              창고 코드 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="code"
              placeholder="예: SEOUL_01, BUSAN_MAIN"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              disabled={isPending}
              maxLength={50}
            />
            <p className="text-xs text-slate-500">
              영문 대문자, 숫자, 밑줄(_)만 사용 가능
            </p>
          </div>

          {/* 창고명 */}
          <div className="space-y-2">
            <Label htmlFor="name">
              창고명 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              placeholder="예: 서울 물류센터"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
              maxLength={100}
            />
          </div>

          {/* 유형 */}
          <div className="space-y-2">
            <Label htmlFor="type">유형</Label>
            <Select value={type} onValueChange={setType} disabled={isPending}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WAREHOUSE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 주소 */}
          <div className="space-y-2">
            <Label htmlFor="address">주소 (선택)</Label>
            <Input
              id="address"
              placeholder="예: 서울특별시 강남구 테헤란로 123"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={isPending}
              maxLength={200}
            />
          </div>

          {/* 활성 상태 (수정 모드에만 표시) */}
          {mode === "edit" && (
            <div className="space-y-2">
              <Label htmlFor="isActive">활성 상태</Label>
              <Select
                value={isActive ? "active" : "inactive"}
                onValueChange={(v) => setIsActive(v === "active")}
                disabled={isPending}
              >
                <SelectTrigger id="isActive">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">활성</SelectItem>
                  <SelectItem value="inactive">비활성</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                처리중...
              </>
            ) : mode === "create" ? (
              "생성"
            ) : (
              "수정"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
