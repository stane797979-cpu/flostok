"use client";

import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PeriodBadgeProps {
  /** 표시할 기간 텍스트 (예: "실시간", "최근 12개월") */
  period: string;
  /** 툴팁에 표시할 상세 설명 */
  description: string;
  /** 계산 방식 설명 (선택) */
  formula?: string;
}

export function PeriodBadge({ period, description, formula }: PeriodBadgeProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className="cursor-help gap-1 text-xs font-normal bg-slate-700 text-white hover:bg-slate-600"
          >
            {period}
            <Info className="h-3 w-3" />
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{description}</p>
            {formula && (
              <p className="text-xs text-muted-foreground">{formula}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
