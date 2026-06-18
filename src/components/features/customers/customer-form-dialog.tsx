"use client";

import { useState, useEffect } from "react";

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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createCustomer, updateCustomer, type CustomerInput } from "@/server/actions/customers";
import { type Customer } from "@/server/db/schema";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const CHANNEL_OPTIONS = ["온라인몰", "오픈마켓", "홈쇼핑", "도매", "직영", "기타"] as const;

interface CustomerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: Customer | null;
}

export function CustomerFormDialog({ open, onOpenChange, customer }: CustomerFormDialogProps) {
  const { toast } = useToast();
  const isEditing = !!customer;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getInitialFormData = (c?: Customer | null): CustomerInput => ({
    name: c?.name || "",
    code: c?.code || "",
    representative: c?.representative || "",
    businessNumber: c?.businessNumber || "",
    contactName: c?.contactName || "",
    contactEmail: c?.contactEmail || "",
    contactPhone: c?.contactPhone || "",
    fax: c?.fax || "",
    address: c?.address || "",
    channel: c?.channel || "",
    paymentTerms: c?.paymentTerms || "",
    notes: c?.notes || "",
  });

  const [formData, setFormData] = useState<CustomerInput>(getInitialFormData(customer));

  useEffect(() => {
    setFormData(getInitialFormData(customer));
    setError(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = isEditing
        ? await updateCustomer(customer.id, formData)
        : await createCustomer(formData);

      if (result.success) {
        toast({
          title: isEditing ? "거래처 수정 완료" : "거래처 추가 완료",
          description: isEditing
            ? "거래처 정보가 성공적으로 수정되었습니다."
            : "새로운 거래처가 성공적으로 등록되었습니다.",
        });
        onOpenChange(false);
      } else {
        setError(result.error || "작업에 실패했습니다");
      }
    } catch {
      setError("알 수 없는 오류가 발생했습니다");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: keyof CustomerInput, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "거래처 수정" : "거래처 등록"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "거래처 정보를 수정합니다." : "새로운 거래처를 등록합니다."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* 기본 정보 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">거래처명 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="쿠팡"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">거래처코드</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => handleChange("code", e.target.value)}
                  placeholder="CUS-001"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="representative">대표자</Label>
                <Input
                  id="representative"
                  value={formData.representative}
                  onChange={(e) => handleChange("representative", e.target.value)}
                  placeholder="홍길동"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessNumber">사업자번호</Label>
                <Input
                  id="businessNumber"
                  value={formData.businessNumber}
                  onChange={(e) => handleChange("businessNumber", e.target.value)}
                  placeholder="123-45-67890"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">주소</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleChange("address", e.target.value)}
                placeholder="서울시 강남구 테헤란로 123"
              />
            </div>

            {/* 연락처 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactPhone">전화번호</Label>
                <Input
                  id="contactPhone"
                  value={formData.contactPhone}
                  onChange={(e) => handleChange("contactPhone", e.target.value)}
                  placeholder="02-1234-5678"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fax">팩스</Label>
                <Input
                  id="fax"
                  value={formData.fax}
                  onChange={(e) => handleChange("fax", e.target.value)}
                  placeholder="02-1234-5679"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactEmail">이메일</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => handleChange("contactEmail", e.target.value)}
                  placeholder="order@customer.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactName">담당자명</Label>
                <Input
                  id="contactName"
                  value={formData.contactName}
                  onChange={(e) => handleChange("contactName", e.target.value)}
                  placeholder="김철수"
                />
              </div>
            </div>

            {/* 채널 및 결제조건 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="channel">채널</Label>
                <Select
                  value={formData.channel || ""}
                  onValueChange={(v) => handleChange("channel", v)}
                >
                  <SelectTrigger id="channel">
                    <SelectValue placeholder="채널 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_OPTIONS.map((ch) => (
                      <SelectItem key={ch} value={ch}>{ch}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentTerms">결제조건</Label>
                <Input
                  id="paymentTerms"
                  value={formData.paymentTerms}
                  onChange={(e) => handleChange("paymentTerms", e.target.value)}
                  placeholder="월말마감 익월말"
                />
              </div>
            </div>

            {/* 메모 */}
            <div className="space-y-2">
              <Label htmlFor="notes">메모</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                placeholder="추가 메모..."
                rows={3}
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
