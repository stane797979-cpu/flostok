import { getStockoutData } from "@/server/actions/stockout";
import { StockoutClient } from "./_components/stockout-client";
import { Card, CardContent } from "@/components/ui/card";
import { AlertOctagon } from "lucide-react";

export default async function StockoutPage() {
  let data;
  try {
    data = await getStockoutData();
  } catch {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">결품관리</h1>
          <p className="mt-2 text-slate-500">품절/결품 현황 감지, 원인 분석 및 조치 추적</p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <AlertOctagon className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold text-muted-foreground">데이터를 불러올 수 없습니다</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground/70">
              로그인 후 다시 시도해 주세요.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <StockoutClient data={data} />;
}
