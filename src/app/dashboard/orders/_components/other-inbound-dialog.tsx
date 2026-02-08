"use client";

import { useState, useRef } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Download, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createOtherInbound } from "@/server/actions/inbound";
import { importOtherInboundExcel, getOtherInboundTemplate } from "@/server/actions/inbound-import";
import { ProductCombobox } from "@/components/features/common/product-combobox";

const INBOUND_TYPES = [
  { value: "INBOUND_RETURN", label: "반품 입고" },
  { value: "INBOUND_ADJUSTMENT", label: "조정 입고" },
  { value: "INBOUND_TRANSFER", label: "이동 입고" },
] as const;

interface OtherInboundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function OtherInboundDialog({ open, onOpenChange, onSuccess }: OtherInboundDialogProps) {
  const [productId, setProductId] = useState("");
  const [inboundType, setInboundType] = useState<string>("");
  const [quantity, setQuantity] = useState("");
  const [location, setLocation] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!productId || !inboundType || !quantity) return;

    setIsSubmitting(true);
    try {
      const result = await createOtherInbound({
        productId,
        inboundType: inboundType as "INBOUND_RETURN" | "INBOUND_ADJUSTMENT" | "INBOUND_TRANSFER",
        quantity: Number(quantity),
        location: location || undefined,
        lotNumber: lotNumber || undefined,
        expiryDate: expiryDate || undefined,
        notes: notes || undefined,
      });

      if (result.success) {
        toast({
          title: "입고 처리 완료",
          description: `${INBOUND_TYPES.find((t) => t.value === inboundType)?.label} 처리가 완료되었습니다`,
        });
        handleClose();
        onSuccess();
      } else {
        toast({
          title: "입고 처리 실패",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "오류 발생",
        description: "입고 처리 중 오류가 발생했습니다",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setProductId("");
    setInboundType("");
    setQuantity("");
    setLocation("");
    setLotNumber("");
    setExpiryDate("");
    setNotes("");
    onOpenChange(false);
  };

  // Excel 양식 다운로드
  const handleDownloadTemplate = async () => {
    setIsDownloading(true);
    try {
      const result = await getOtherInboundTemplate();
      if (result.success && result.data) {
        const binaryString = atob(result.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "기타입고_양식.xlsx";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast({ title: "다운로드 완료", description: "기타입고 양식이 다운로드되었습니다" });
      }
    } catch {
      toast({ title: "다운로드 실패", description: "양식 다운로드 중 오류가 발생했습니다", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  // Excel 파일 업로드
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target?.result as string;
        const result = await importOtherInboundExcel({
          fileBase64: base64,
          fileName: file.name,
        });

        if (result.success) {
          toast({
            title: "일괄 입고 완료",
            description: `${result.successCount}건 입고 처리 완료${result.errorCount > 0 ? ` (${result.errorCount}건 오류)` : ""}`,
          });
          handleClose();
          onSuccess();
        } else {
          const errorMsg = result.errors?.length > 0
            ? result.errors.slice(0, 3).map((e) => `${e.row}행: ${e.message}`).join("\n")
            : result.message;
          toast({
            title: "일괄 입고 실패",
            description: errorMsg,
            variant: "destructive",
          });
        }
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast({ title: "업로드 실패", description: "파일 처리 중 오류가 발생했습니다", variant: "destructive" });
      setIsUploading(false);
    }

    // 파일 input 초기화
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>기타 입고</DialogTitle>
          <DialogDescription>
            발주 외 입고(반품, 조정, 이동)를 처리합니다. 재고가 자동으로 증가합니다.
          </DialogDescription>
        </DialogHeader>

        {/* Excel 일괄 입고 영역 */}
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="flex-1 text-xs text-blue-800">
            여러 건을 한번에 처리하려면 양식을 다운로드 후 업로드하세요.
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
            disabled={isDownloading}
            className="shrink-0"
          >
            {isDownloading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Download className="mr-1 h-3 w-3" />}
            양식
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="shrink-0"
          >
            {isUploading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Upload className="mr-1 h-3 w-3" />}
            업로드
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>

        <div className="space-y-4">
          {/* 제품 선택 — Combobox */}
          <div className="space-y-2">
            <Label>제품</Label>
            <ProductCombobox
              value={productId}
              onValueChange={setProductId}
              disabled={isSubmitting}
            />
          </div>

          {/* 입고 유형 */}
          <div className="space-y-2">
            <Label>입고 유형</Label>
            <Select value={inboundType} onValueChange={setInboundType}>
              <SelectTrigger>
                <SelectValue placeholder="입고 유형을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {INBOUND_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 수량 */}
          <div className="space-y-2">
            <Label htmlFor="oi-quantity">수량</Label>
            <Input
              id="oi-quantity"
              type="number"
              min="1"
              placeholder="입고 수량"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          {/* 적치 위치 */}
          <div className="space-y-2">
            <Label htmlFor="oi-location">적치 위치 (선택)</Label>
            <Input
              id="oi-location"
              placeholder="예: A-01-02"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          {/* LOT 번호 */}
          <div className="space-y-2">
            <Label htmlFor="oi-lot">LOT 번호 (선택)</Label>
            <Input
              id="oi-lot"
              placeholder="LOT 번호"
              value={lotNumber}
              onChange={(e) => setLotNumber(e.target.value)}
            />
          </div>

          {/* 유통기한 */}
          <div className="space-y-2">
            <Label htmlFor="oi-expiry">유통기한 (선택)</Label>
            <Input
              id="oi-expiry"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>

          {/* 메모 */}
          <div className="space-y-2">
            <Label htmlFor="oi-notes">메모 (선택)</Label>
            <Textarea
              id="oi-notes"
              placeholder="입고 사유를 입력하세요"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            취소
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !productId || !inboundType || !quantity || Number(quantity) <= 0}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            입고 처리
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
