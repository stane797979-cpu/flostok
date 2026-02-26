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
import { MoreHorizontal, Edit, Trash2, Star, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type Supplier } from "@/server/db/schema";
import { type SupplierScorecard } from "@/server/services/scm/supplier-scorecard";
import { cn } from "@/lib/utils";

interface SupplierTableProps {
  suppliers: Supplier[];
  scorecards?: SupplierScorecard[];
  onEdit?: (supplier: Supplier) => void;
  onDelete?: (supplier: Supplier) => void;
}

type SortField = "name" | "contactName" | "contactPhone" | "contactEmail" | "avgLeadTime" | "rating" | "score";
type SortDirection = "asc" | "desc" | null;

/** 등급별 Badge 색상 */
function GradeBadge({ grade }: { grade: string }) {
  const styles: Record<string, string> = {
    A: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
    B: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
    C: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
    D: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  };
  return (
    <Badge
      variant="outline"
      className={cn("font-bold text-xs px-2 py-0.5", styles[grade] ?? styles["D"])}
    >
      {grade}등급
    </Badge>
  );
}

/** 점수 + 프로그레스 바 */
function ScoreCell({ score }: { score: number }) {
  const color =
    score >= 90
      ? "bg-emerald-500"
      : score >= 75
        ? "bg-blue-500"
        : score >= 60
          ? "bg-amber-500"
          : "bg-red-500";

  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <span className="text-sm font-medium tabular-nums w-[38px] shrink-0 text-right">
        {score.toFixed(0)}점
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
    </div>
  );
}

export function SupplierTable({ suppliers, scorecards, onEdit, onDelete }: SupplierTableProps) {
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // 공급자 ID → 스코어카드 맵
  const scorecardMap = useMemo(() => {
    const map = new Map<string, SupplierScorecard>();
    for (const sc of scorecards ?? []) {
      map.set(sc.supplierId, sc);
    }
    return map;
  }, [scorecards]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortDirection(null);
        setSortField("name");
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field || sortDirection === null) {
      return <ArrowUpDown className="ml-1 h-3 w-3 text-slate-400" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3 text-primary-600" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 text-primary-600" />
    );
  };

  const sortedSuppliers = useMemo(() => {
    if (sortDirection === null) return suppliers;

    const dir = sortDirection === "asc" ? 1 : -1;

    return [...suppliers].sort((a, b) => {
      let aValue: string | number | null;
      let bValue: string | number | null;

      switch (sortField) {
        case "name":
          aValue = a.name;
          bValue = b.name;
          break;
        case "contactName":
          aValue = a.contactName;
          bValue = b.contactName;
          break;
        case "contactPhone":
          aValue = a.contactPhone;
          bValue = b.contactPhone;
          break;
        case "contactEmail":
          aValue = a.contactEmail;
          bValue = b.contactEmail;
          break;
        case "avgLeadTime":
          aValue = a.avgLeadTime;
          bValue = b.avgLeadTime;
          break;
        case "rating":
          aValue = a.rating;
          bValue = b.rating;
          break;
        case "score":
          aValue = scorecardMap.get(a.id)?.overallScore ?? -1;
          bValue = scorecardMap.get(b.id)?.overallScore ?? -1;
          break;
        default:
          return 0;
      }

      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;

      if (sortField === "avgLeadTime" || sortField === "rating" || sortField === "score") {
        return dir * (Number(aValue) - Number(bValue));
      }

      return dir * String(aValue).localeCompare(String(bValue), "ko");
    });
  }, [suppliers, sortField, sortDirection, scorecardMap]);

  const hasScoreData = (scorecards?.length ?? 0) > 0;

  return (
    <div className="rounded-lg border bg-white dark:bg-slate-950">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 font-medium hover:bg-transparent"
                onClick={() => handleSort("name")}
              >
                공급자명
                <SortIcon field="name" />
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 font-medium hover:bg-transparent"
                onClick={() => handleSort("contactName")}
              >
                담당자
                <SortIcon field="contactName" />
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 font-medium hover:bg-transparent"
                onClick={() => handleSort("contactPhone")}
              >
                연락처
                <SortIcon field="contactPhone" />
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 font-medium hover:bg-transparent"
                onClick={() => handleSort("contactEmail")}
              >
                이메일
                <SortIcon field="contactEmail" />
              </Button>
            </TableHead>
            <TableHead className="text-center">
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 font-medium hover:bg-transparent"
                onClick={() => handleSort("avgLeadTime")}
              >
                리드타임
                <SortIcon field="avgLeadTime" />
              </Button>
            </TableHead>
            <TableHead className="text-center">
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 font-medium hover:bg-transparent"
                onClick={() => handleSort("rating")}
              >
                평점
                <SortIcon field="rating" />
              </Button>
            </TableHead>
            {hasScoreData && (
              <>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 font-medium hover:bg-transparent"
                    onClick={() => handleSort("score")}
                  >
                    성과 점수
                    <SortIcon field="score" />
                  </Button>
                </TableHead>
                <TableHead className="text-center">등급</TableHead>
              </>
            )}
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={hasScoreData ? 9 : 7}
                className="h-24 text-center text-slate-500"
              >
                등록된 공급자가 없습니다.
              </TableCell>
            </TableRow>
          ) : (
            sortedSuppliers.map((supplier) => {
              const sc = scorecardMap.get(supplier.id);
              return (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell>{supplier.contactName || "-"}</TableCell>
                  <TableCell className="font-mono text-sm">{supplier.contactPhone || "-"}</TableCell>
                  <TableCell className="text-slate-500">{supplier.contactEmail || "-"}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{supplier.avgLeadTime}일</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium">
                        {(Number(supplier.rating) / 20).toFixed(1)}
                      </span>
                    </div>
                  </TableCell>
                  {hasScoreData && (
                    <>
                      <TableCell>
                        {sc ? (
                          <ScoreCell score={sc.overallScore} />
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {sc ? (
                          <GradeBadge grade={sc.grade} />
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>
                    </>
                  )}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label={`${supplier.name} 옵션`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit?.(supplier)}>
                          <Edit className="mr-2 h-4 w-4" />
                          수정
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => onDelete?.(supplier)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          삭제
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
