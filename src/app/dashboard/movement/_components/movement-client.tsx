"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Download,
  Loader2,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Package,
  CalendarDays,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getInventoryMovementData,
  type ProductMovementSummary,
} from "@/server/actions/inventory-movement";
import { exportInventoryMovementToExcel } from "@/server/actions/excel-export";
import { SummaryTable } from "./summary-table";
import { DailyMovementTable } from "./daily-movement-table";

/**
 * 오늘 기준 이번 달 시작일/종료일
 */
function getDefaultRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const startDate = new Date(year, month, 1).toISOString().split("T")[0];
  const endDate = new Date(year, month + 1, 0).toISOString().split("T")[0];
  return { startDate, endDate };
}

function formatPeriodLabel(startDate: string, endDate: string): string {
  const s = new Date(startDate);
  const e = new Date(endDate);
  const fmt = (d: Date) =>
    `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  return `${fmt(s)} ~ ${fmt(e)}`;
}

interface PeriodData {
  totalInbound: number;
  totalOutbound: number;
  netChange: number;
  productCount: number;
}

export function MovementClient() {
  const defaultRange = getDefaultRange();
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [products, setProducts] = useState<ProductMovementSummary[]>([]);
  const [period, setPeriod] = useState<PeriodData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { toast } = useToast();

  // 수불부 데이터 조회
  const loadMovementData = useCallback(
    async (start: string, end: string) => {
      setIsLoading(true);
      try {
        const result = await getInventoryMovementData({
          startDate: start,
          endDate: end,
        });

        if (result.success && result.data) {
          setProducts(result.data.products);
          setPeriod(result.data.period);
        } else {
          setProducts([]);
          setPeriod(null);
        }
      } catch (error) {
        console.error("수불부 데이터 조회 오류:", error);
        setProducts([]);
        setPeriod(null);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // 초기 로드
  useEffect(() => {
    loadMovementData(startDate, endDate);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 조회 버튼
  const handleSearch = useCallback(() => {
    if (startDate > endDate) {
      toast({
        title: "기간 오류",
        description: "시작일이 종료일보다 늦을 수 없습니다",
        variant: "destructive",
      });
      return;
    }
    loadMovementData(startDate, endDate);
  }, [startDate, endDate, loadMovementData, toast]);

  // Excel 다운로드
  const handleDownloadExcel = useCallback(async () => {
    setIsDownloading(true);
    try {
      const result = await exportInventoryMovementToExcel({
        startDate,
        endDate,
      });

      if (result.success && result.data) {
        const binaryString = atob(result.data.buffer);
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
        link.download = result.data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        toast({
          title: "다운로드 완료",
          description: `${result.data.filename} 파일이 다운로드되었습니다`,
        });
      } else {
        toast({
          title: "다운로드 실패",
          description: result.error || "재고 수불부 다운로드에 실패했습니다",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("재고 수불부 다운로드 오류:", error);
      toast({
        title: "오류",
        description: "재고 수불부 다운로드 중 오류가 발생했습니다",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  }, [startDate, endDate, toast]);

  // 검색 필터링
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.productSku.toLowerCase().includes(q) ||
        p.productName.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">수불관리</h1>
          <p className="mt-2 text-slate-500">
            기간별 입출고 현황과 재고 수불부를 확인하세요
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadExcel}
          disabled={isDownloading || products.length === 0}
        >
          {isDownloading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Excel 다운로드
        </Button>
      </div>

      {/* 기간 설정 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">조회 기간</span>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-[160px]"
            />
            <span className="text-slate-400">~</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-[160px]"
            />
            <Button onClick={handleSearch} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              조회
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 통계 카드 */}
      {period && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="rounded-lg bg-blue-50 p-2.5 dark:bg-blue-950">
                <ArrowUpRight className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">총 입고</p>
                <p className="text-2xl font-bold text-blue-600">
                  +{period.totalInbound.toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="rounded-lg bg-red-50 p-2.5 dark:bg-red-950">
                <ArrowDownRight className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">총 출고</p>
                <p className="text-2xl font-bold text-red-600">
                  -{period.totalOutbound.toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="rounded-lg bg-emerald-50 p-2.5 dark:bg-emerald-950">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">순변동</p>
                <p
                  className={`text-2xl font-bold ${
                    period.netChange > 0
                      ? "text-blue-600"
                      : period.netChange < 0
                        ? "text-red-600"
                        : "text-slate-400"
                  }`}
                >
                  {period.netChange > 0 ? "+" : ""}
                  {period.netChange.toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="rounded-lg bg-slate-100 p-2.5 dark:bg-slate-800">
                <Package className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">변동 제품</p>
                <p className="text-2xl font-bold">
                  {period.productCount.toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 수불부 테이블 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>재고 수불부</CardTitle>
              <CardDescription>
                {formatPeriodLabel(startDate, endDate)} 제품별 입출고 현황 및
                기말재고
              </CardDescription>
            </div>
            {/* 제품 검색 */}
            <div className="relative w-[250px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="SKU 또는 제품명 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-48 items-center justify-center text-slate-400">
              수불부 데이터를 불러오는 중...
            </div>
          ) : (
            <Tabs defaultValue="summary" className="space-y-4">
              <TabsList>
                <TabsTrigger value="summary">종합 요약</TabsTrigger>
                <TabsTrigger value="daily">일별 수불부</TabsTrigger>
              </TabsList>

              <TabsContent value="summary">
                <SummaryTable products={filteredProducts} />
              </TabsContent>

              <TabsContent value="daily">
                <DailyMovementTable products={filteredProducts} />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
