import { getPSIData } from "@/server/actions/psi";
import { PSIClient } from "./_components/psi-client";
import { Card, CardContent } from "@/components/ui/card";
import { FileSpreadsheet } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PSIPage() {
  let data;
  try {
    data = await getPSIData();
  } catch {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">PSI 계획</h1>
          <p className="mt-2 text-slate-500">수요 · 공급 · 재고 통합 계획표</p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileSpreadsheet className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold text-muted-foreground">데이터를 불러올 수 없습니다</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground/70">
              로그인 후 다시 시도해 주세요.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <PSIClient data={data} />;
}
