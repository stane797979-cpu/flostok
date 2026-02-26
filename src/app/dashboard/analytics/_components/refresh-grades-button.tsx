"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { refreshGrades } from "@/server/actions/analytics";
import { useRouter } from "next/navigation";

export function RefreshGradesButton() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const result = await refreshGrades();
      if (result.success) {
        toast({
          title: "등급 갱신 완료",
          description: `전체 ${result.totalProducts}개 제품 중 ${result.updatedCount}개 갱신, 미변경 ${result.unchangedCount ?? 0}개, 신제품 ${result.newProductCount}개`,
        });
        router.refresh();
      } else {
        toast({
          title: "등급 갱신 실패",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "등급 갱신 실패",
        description: "알 수 없는 오류가 발생했습니다",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRefresh}
      disabled={isLoading}
    >
      <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
      {isLoading ? "갱신 중..." : "등급 갱신"}
    </Button>
  );
}
