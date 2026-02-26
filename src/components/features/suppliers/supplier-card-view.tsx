"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Star,
  Clock,
} from "lucide-react";
import { type Supplier } from "@/server/db/schema";
import { type SupplierScorecard } from "@/server/services/scm/supplier-scorecard";
import { cn } from "@/lib/utils";

interface SupplierCardViewProps {
  suppliers: Supplier[];
  scorecards?: SupplierScorecard[];
  onEdit?: (supplier: Supplier) => void;
  onDelete?: (supplier: Supplier) => void;
}

/** 등급별 Badge 스타일 */
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

export function SupplierCardView({ suppliers, scorecards, onEdit, onDelete }: SupplierCardViewProps) {
  // 공급자 ID → 스코어카드 맵
  const scorecardMap = useMemo(() => {
    const map = new Map<string, SupplierScorecard>();
    for (const sc of scorecards ?? []) {
      map.set(sc.supplierId, sc);
    }
    return map;
  }, [scorecards]);

  if (suppliers.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border text-slate-500">
        등록된 공급자가 없습니다.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {suppliers.map((supplier) => {
        const ratingOutOf5 = Number(supplier.rating) / 20;
        const fullStars = Math.floor(ratingOutOf5);
        const hasHalfStar = ratingOutOf5 % 1 >= 0.5;
        const sc = scorecardMap.get(supplier.id);

        return (
          <Card key={supplier.id} className="transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
              <div className="space-y-1 min-w-0 flex-1 pr-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-lg leading-tight">{supplier.name}</CardTitle>
                  {/* 성과 등급 Badge */}
                  {sc && <GradeBadge grade={sc.grade} />}
                </div>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "h-3 w-3",
                        i < fullStars
                          ? "fill-yellow-400 text-yellow-400"
                          : i === fullStars && hasHalfStar
                            ? "fill-yellow-200 text-yellow-400"
                            : "fill-none text-slate-300"
                      )}
                    />
                  ))}
                  <span className="ml-1 text-xs text-slate-500">{ratingOutOf5.toFixed(1)}</span>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
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
            </CardHeader>
            <CardContent className="space-y-3">
              {/* 담당자 */}
              {supplier.contactName && (
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 shrink-0">
                    <span className="text-xs font-medium">{supplier.contactName[0]}</span>
                  </div>
                  <span className="font-medium">{supplier.contactName}</span>
                </div>
              )}

              {/* 연락처 */}
              <div className="space-y-2">
                {supplier.contactEmail && (
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span className="truncate">{supplier.contactEmail}</span>
                  </div>
                )}
                {supplier.contactPhone && (
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Phone className="h-4 w-4 shrink-0" />
                    <span>{supplier.contactPhone}</span>
                  </div>
                )}
                {supplier.address && (
                  <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="line-clamp-2">{supplier.address}</span>
                  </div>
                )}
              </div>

              {/* 통계 */}
              <div className="flex flex-wrap gap-2 pt-2">
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {supplier.avgLeadTime}일
                </Badge>
                {/* 성과 점수 */}
                {sc && (
                  <Badge
                    variant="outline"
                    className="flex items-center gap-1 text-slate-700 dark:text-slate-300"
                  >
                    {sc.overallScore.toFixed(0)}점
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
