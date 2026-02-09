"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface TurnoverItem {
  sku: string;
  productName: string;
  turnoverRate: number;
  daysOfInventory: number;
}

interface TurnoverTop5CardProps {
  fastest: TurnoverItem[];
  slowest: TurnoverItem[];
}

export function TurnoverTop5Card({ fastest, slowest }: TurnoverTop5CardProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* 빠른 회전 TOP5 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-green-500" />
            빠른 회전 TOP5
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {fastest.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">데이터 없음</p>
            ) : (
              fastest.map((item, i) => (
                <div
                  key={item.sku}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-green-600 w-5">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">{item.sku}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="ml-2 shrink-0 text-green-600 border-green-200">
                    {item.turnoverRate.toFixed(1)}회
                  </Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* 느린 회전 TOP5 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingDown className="h-4 w-4 text-red-500" />
            느린 회전 TOP5
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {slowest.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">데이터 없음</p>
            ) : (
              slowest.map((item, i) => (
                <div
                  key={item.sku}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-red-600 w-5">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">{item.sku}</p>
                    </div>
                  </div>
                  <div className="ml-2 shrink-0 flex items-center gap-1">
                    <Badge variant="outline" className={cn(
                      "text-xs",
                      item.daysOfInventory >= 180 ? "text-red-600 border-red-200" : "text-yellow-600 border-yellow-200"
                    )}>
                      {item.daysOfInventory}일
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
