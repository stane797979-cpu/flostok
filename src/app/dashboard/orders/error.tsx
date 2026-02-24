"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <AlertTriangle className="h-12 w-12 text-orange-500" />
      <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">
        문제가 발생했습니다
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md text-center">
        {error.message || "발주 관리 페이지를 불러오는 중 오류가 발생했습니다."}
      </p>
      <div className="flex gap-2">
        <Button onClick={reset} variant="default">
          다시 시도
        </Button>
        <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>
          대시보드로 이동
        </Button>
      </div>
    </div>
  );
}
