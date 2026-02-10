"use client";

import { useState, useMemo } from "react";
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
import { Input } from "@/components/ui/input";
import { ArrowUpDown, ArrowUp, ArrowDown, Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateInboundRecordDate } from "@/server/actions/inbound";
import { updatePurchaseOrderExpectedDate } from "@/server/actions/purchase-orders";
import { useToast } from "@/hooks/use-toast";

export interface InboundRecord {
  id: string;
  purchaseOrderId: string | null;
  orderNumber: string | null;
  productId: string;
  productName: string;
  productSku: string;
  date: string;
  scheduledDate: string | null;
  expectedQuantity: number | null;
  receivedQuantity: number;
  acceptedQuantity: number | null;
  rejectedQuantity: number | null;
  qualityResult: string | null;
  location: string | null;
  lotNumber: string | null;
  expiryDate: string | null;
  notes: string | null;
  createdAt: Date;
}

/**
 * 유통기한 임박 여부 확인 (7일 이내)
 */
function isExpiringSoon(expiryDate: string | null): boolean {
  if (!expiryDate) return false;
  const expiry = new Date(expiryDate);
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 7;
}

function isExpired(expiryDate: string | null): boolean {
  if (!expiryDate) return false;
  return new Date(expiryDate) < new Date();
}

interface InboundRecordsTableProps {
  records: InboundRecord[];
  className?: string;
}

type SortField =
  | "date"
  | "scheduledDate"
  | "orderNumber"
  | "productSku"
  | "productName"
  | "receivedQuantity"
  | "acceptedQuantity"
  | "qualityResult"
  | "expiryDate";
type SortDirection = "asc" | "desc" | null;

function SortIcon({
  field,
  sortField,
  sortDirection,
}: {
  field: SortField;
  sortField: SortField;
  sortDirection: SortDirection;
}) {
  if (sortField !== field) {
    return <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />;
  }
  if (sortDirection === "asc") {
    return <ArrowUp className="h-3.5 w-3.5 text-slate-900" />;
  }
  if (sortDirection === "desc") {
    return <ArrowDown className="h-3.5 w-3.5 text-slate-900" />;
  }
  return <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />;
}

const qualityBadge = (result: string | null) => {
  switch (result) {
    case "pass":
      return <Badge className="bg-green-600">합격</Badge>;
    case "fail":
      return <Badge variant="destructive">불합격</Badge>;
    case "partial":
      return (
        <Badge variant="destructive" className="bg-orange-600">
          부분합격
        </Badge>
      );
    case "pending":
      return <Badge variant="secondary">검수대기</Badge>;
    default:
      return <Badge variant="outline">-</Badge>;
  }
};

export function InboundRecordsTable({ records, className }: InboundRecordsTableProps) {
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  // 입고예정일(스케줄) 편집
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [editScheduleDate, setEditScheduleDate] = useState("");
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const { toast } = useToast();

  const handleEditDate = (recordId: string, currentDate: string) => {
    setEditingRecordId(recordId);
    setEditDate(currentDate);
  };

  const handleCancelEdit = () => {
    setEditingRecordId(null);
    setEditDate("");
  };

  const handleSaveDate = async () => {
    if (!editingRecordId || !editDate) return;
    setIsSaving(true);
    try {
      const result = await updateInboundRecordDate(editingRecordId, editDate);
      if (result.success) {
        toast({ title: "입고일이 변경되었습니다" });
        setEditingRecordId(null);
        setEditDate("");
      } else {
        toast({ title: "변경 실패", description: result.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "오류 발생", description: "입고일 변경에 실패했습니다", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditSchedule = (recordId: string, currentDate: string) => {
    setEditingScheduleId(recordId);
    setEditScheduleDate(currentDate);
  };

  const handleCancelSchedule = () => {
    setEditingScheduleId(null);
    setEditScheduleDate("");
  };

  const handleSaveSchedule = async (orderId: string) => {
    if (!editingScheduleId || !editScheduleDate || !orderId) return;
    setIsSavingSchedule(true);
    try {
      const result = await updatePurchaseOrderExpectedDate(orderId, editScheduleDate);
      if (result.success) {
        toast({ title: "입고예정일이 변경되었습니다" });
        setEditingScheduleId(null);
        setEditScheduleDate("");
      } else {
        toast({ title: "변경 실패", description: result.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "오류 발생", description: "입고예정일 변경에 실패했습니다", variant: "destructive" });
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortDirection(null);
      } else {
        setSortDirection("asc");
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedRecords = useMemo(() => {
    if (!sortDirection) return records;

    return [...records].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      // null 처리: null은 맨 뒤로
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // 문자열 비교
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal, "ko")
          : bVal.localeCompare(aVal, "ko");
      }

      // 숫자 비교
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
    });
  }, [records, sortField, sortDirection]);

  if (records.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-slate-400">
        해당 기간의 입고 기록이 없습니다
      </div>
    );
  }

  return (
    <div className={cn("rounded-md border", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">
              <button
                onClick={() => handleSort("date")}
                className="flex items-center gap-1 hover:text-slate-900"
              >
                입고일
                <SortIcon field="date" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </TableHead>
            <TableHead className="whitespace-nowrap">
              <button
                onClick={() => handleSort("scheduledDate")}
                className="flex items-center gap-1 hover:text-slate-900"
              >
                입고예정일
                <SortIcon field="scheduledDate" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </TableHead>
            <TableHead className="whitespace-nowrap">
              <button
                onClick={() => handleSort("orderNumber")}
                className="flex items-center gap-1 hover:text-slate-900"
              >
                발주번호
                <SortIcon field="orderNumber" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </TableHead>
            <TableHead className="whitespace-nowrap">
              <button
                onClick={() => handleSort("productSku")}
                className="flex items-center gap-1 hover:text-slate-900"
              >
                SKU
                <SortIcon field="productSku" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </TableHead>
            <TableHead className="whitespace-nowrap">
              <button
                onClick={() => handleSort("productName")}
                className="flex items-center gap-1 hover:text-slate-900"
              >
                제품명
                <SortIcon field="productName" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </TableHead>
            <TableHead className="whitespace-nowrap text-right">
              <button
                onClick={() => handleSort("receivedQuantity")}
                className="ml-auto flex items-center gap-1 hover:text-slate-900"
              >
                입고수량
                <SortIcon field="receivedQuantity" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </TableHead>
            <TableHead className="whitespace-nowrap text-right">
              <button
                onClick={() => handleSort("acceptedQuantity")}
                className="ml-auto flex items-center gap-1 hover:text-slate-900"
              >
                합격수량
                <SortIcon field="acceptedQuantity" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </TableHead>
            <TableHead className="whitespace-nowrap">
              <button
                onClick={() => handleSort("qualityResult")}
                className="flex items-center gap-1 hover:text-slate-900"
              >
                품질결과
                <SortIcon field="qualityResult" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </TableHead>
            <TableHead className="whitespace-nowrap">적치위치</TableHead>
            <TableHead className="whitespace-nowrap">LOT번호</TableHead>
            <TableHead className="whitespace-nowrap">
              <button
                onClick={() => handleSort("expiryDate")}
                className="flex items-center gap-1 hover:text-slate-900"
              >
                유통기한
                <SortIcon field="expiryDate" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRecords.map((record) => (
            <TableRow key={record.id}>
              <TableCell className="whitespace-nowrap text-sm">
                {editingRecordId === record.id ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="h-7 w-36 text-sm"
                      disabled={isSaving}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleSaveDate}
                      disabled={isSaving}
                    >
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                    >
                      <X className="h-3.5 w-3.5 text-slate-400" />
                    </Button>
                  </div>
                ) : (
                  <div className="group flex items-center gap-1">
                    <span>{record.date}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleEditDate(record.id, record.date)}
                    >
                      <Pencil className="h-3 w-3 text-slate-400" />
                    </Button>
                  </div>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm">
                {record.scheduledDate ? (
                  editingScheduleId === record.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="date"
                        value={editScheduleDate}
                        onChange={(e) => setEditScheduleDate(e.target.value)}
                        className="h-7 w-36 text-sm"
                        disabled={isSavingSchedule}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => record.purchaseOrderId && handleSaveSchedule(record.purchaseOrderId)}
                        disabled={isSavingSchedule}
                      >
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={handleCancelSchedule}
                        disabled={isSavingSchedule}
                      >
                        <X className="h-3.5 w-3.5 text-slate-400" />
                      </Button>
                    </div>
                  ) : (
                    <div className="group flex items-center gap-1">
                      <span className="text-blue-600">{record.scheduledDate}</span>
                      {record.purchaseOrderId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleEditSchedule(record.id, record.scheduledDate!)}
                        >
                          <Pencil className="h-3 w-3 text-slate-400" />
                        </Button>
                      )}
                    </div>
                  )
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap font-mono text-xs">
                {record.orderNumber || "-"}
              </TableCell>
              <TableCell className="whitespace-nowrap font-mono text-xs">{record.productSku}</TableCell>
              <TableCell className="whitespace-nowrap font-medium">{record.productName}</TableCell>
              <TableCell className="whitespace-nowrap text-right font-semibold">
                {record.receivedQuantity}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right">
                {record.acceptedQuantity ?? "-"}
              </TableCell>
              <TableCell className="whitespace-nowrap">{qualityBadge(record.qualityResult)}</TableCell>
              <TableCell className="whitespace-nowrap text-sm text-slate-600">
                {record.location || "-"}
              </TableCell>
              <TableCell className="whitespace-nowrap font-mono text-xs text-slate-500">
                {record.lotNumber || "-"}
              </TableCell>
              <TableCell
                className={cn(
                  "text-sm",
                  isExpired(record.expiryDate) && "font-semibold text-red-600",
                  isExpiringSoon(record.expiryDate) && "font-semibold text-orange-600"
                )}
              >
                {record.expiryDate || "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
