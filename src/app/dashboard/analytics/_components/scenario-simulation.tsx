// NOTE: 현재 analytics 탭에 미연결된 상태. Mock 데이터 사용 중.
"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from "lucide-react";

interface SimulationProduct {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  averageDailyDemand: number;
  demandStdDev: number;
  leadTimeDays: number;
  safetyStock: number;
  reorderPoint: number;
}

interface ScenarioResult {
  scenarioName: string;
  demandChangePercent: number;
  leadTimeChangeDays: number;
  adjustedDemand: number;
  adjustedLeadTime: number;
  newSafetyStock: number;
  newReorderPoint: number;
  stockStatus: "충분" | "발주필요" | "긴급";
  requiredOrderQuantity: number;
  safetyStockRatio: number;
}

// Mock 데이터
const mockProducts: SimulationProduct[] = [
  {
    id: "1",
    name: "프리미엄 노트북",
    sku: "SKU-001",
    currentStock: 150,
    averageDailyDemand: 12.5,
    demandStdDev: 3.2,
    leadTimeDays: 7,
    safetyStock: 45,
    reorderPoint: 133,
  },
  {
    id: "2",
    name: "무선 이어폰",
    sku: "SKU-002",
    currentStock: 320,
    averageDailyDemand: 28.4,
    demandStdDev: 8.5,
    leadTimeDays: 5,
    safetyStock: 68,
    reorderPoint: 210,
  },
  {
    id: "3",
    name: "스마트워치",
    sku: "SKU-003",
    currentStock: 85,
    averageDailyDemand: 8.2,
    demandStdDev: 4.1,
    leadTimeDays: 10,
    safetyStock: 42,
    reorderPoint: 124,
  },
];

export function ScenarioSimulation() {
  const [selectedProduct, setSelectedProduct] = useState<SimulationProduct>(mockProducts[0]);
  const [demandChange, setDemandChange] = useState<number>(0);
  const [leadTimeChange, setLeadTimeChange] = useState<number>(0);
  const [results, setResults] = useState<ScenarioResult[]>([]);

  // 시뮬레이션 실행
  const runSimulation = () => {
    // 클라이언트 사이드 계산 (간단한 버전)
    const adjustedDemand = selectedProduct.averageDailyDemand * (1 + demandChange / 100);
    const adjustedLeadTime = Math.max(1, selectedProduct.leadTimeDays + leadTimeChange);
    const adjustedDemandStdDev = selectedProduct.demandStdDev * (1 + demandChange / 100);

    // 안전재고 재계산 (간단한 공식: Z × σd × √LT)
    const zScore = 1.65; // 95% 서비스 레벨
    const newSafetyStock = Math.ceil(zScore * adjustedDemandStdDev * Math.sqrt(adjustedLeadTime));

    // 발주점 재계산
    const newReorderPoint = Math.ceil(adjustedDemand * adjustedLeadTime + newSafetyStock);

    // 재고 상태 판단
    let stockStatus: "충분" | "발주필요" | "긴급";
    if (selectedProduct.currentStock < newSafetyStock * 0.5) {
      stockStatus = "긴급";
    } else if (selectedProduct.currentStock <= newReorderPoint) {
      stockStatus = "발주필요";
    } else {
      stockStatus = "충분";
    }

    const _requiredQty =
      stockStatus !== "충분"
        ? Math.max(0, newReorderPoint + adjustedDemand * 30 - selectedProduct.currentStock)
        : 0;

    const _safetyRatio =
      newSafetyStock > 0 ? Math.round((selectedProduct.currentStock / newSafetyStock) * 100) : 0;

    // 여러 시나리오 생성
    const scenarios: Array<{ name: string; demandPct: number; leadDays: number }> = [
      { name: "현재 (기준)", demandPct: 0, leadDays: 0 },
      { name: "사용자 설정", demandPct: demandChange, leadDays: leadTimeChange },
      { name: "수요 +20%", demandPct: 20, leadDays: 0 },
      { name: "수요 -20%", demandPct: -20, leadDays: 0 },
      { name: "리드타임 +5일", demandPct: 0, leadDays: 5 },
      { name: "리드타임 -2일", demandPct: 0, leadDays: -2 },
      { name: "최악: 수요↑20% + 리드타임↑5일", demandPct: 20, leadDays: 5 },
      { name: "최선: 수요↓20% + 리드타임↓2일", demandPct: -20, leadDays: -2 },
    ];

    const simulatedResults: ScenarioResult[] = scenarios.map((scenario) => {
      const aDemand = selectedProduct.averageDailyDemand * (1 + scenario.demandPct / 100);
      const aLeadTime = Math.max(1, selectedProduct.leadTimeDays + scenario.leadDays);
      const aStdDev = selectedProduct.demandStdDev * (1 + scenario.demandPct / 100);
      const aSafety = Math.ceil(zScore * aStdDev * Math.sqrt(aLeadTime));
      const aReorder = Math.ceil(aDemand * aLeadTime + aSafety);

      let aStatus: "충분" | "발주필요" | "긴급";
      if (selectedProduct.currentStock < aSafety * 0.5) {
        aStatus = "긴급";
      } else if (selectedProduct.currentStock <= aReorder) {
        aStatus = "발주필요";
      } else {
        aStatus = "충분";
      }

      const _requiredOrderQuantity =
        aStatus !== "충분" ? Math.max(0, aReorder + aDemand * 30 - selectedProduct.currentStock) : 0;

      const _safetyStockRatio = aSafety > 0 ? Math.round((selectedProduct.currentStock / aSafety) * 100) : 0;

      return {
        scenarioName: scenario.name,
        demandChangePercent: scenario.demandPct,
        leadTimeChangeDays: scenario.leadDays,
        adjustedDemand: Math.round(aDemand * 10) / 10,
        adjustedLeadTime: aLeadTime,
        newSafetyStock: aSafety,
        newReorderPoint: aReorder,
        stockStatus: aStatus,
        requiredOrderQuantity: Math.ceil(_requiredOrderQuantity),
        safetyStockRatio: _safetyStockRatio,
      };
    });

    setResults(simulatedResults);
  };

  // 재고 상태 아이콘
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "충분":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "발주필요":
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case "긴급":
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default:
        return null;
    }
  };

  // 재고 상태 색상
  const getStatusColor = (status: string) => {
    switch (status) {
      case "충분":
        return "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800";
      case "발주필요":
        return "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-300 dark:border-yellow-800";
      case "긴급":
        return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700";
    }
  };

  return (
    <div className="space-y-6">
      {/* 제품 선택 & 시뮬레이션 설정 */}
      <Card>
        <CardHeader>
          <CardTitle>시나리오 시뮬레이션</CardTitle>
          <CardDescription>
            수요 변동 및 리드타임 변동 시나리오를 시뮬레이션하여 재고 정책에 미치는 영향을 분석하세요
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 제품 선택 */}
          <div className="space-y-2">
            <Label>제품 선택</Label>
            <Select
              value={selectedProduct.id}
              onValueChange={(value) => {
                const product = mockProducts.find((p) => p.id === value);
                if (product) setSelectedProduct(product);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {mockProducts.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name} ({product.sku})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 현재 제품 정보 */}
          <div className="grid grid-cols-2 gap-4 rounded-lg border bg-slate-50 dark:bg-slate-800/50 p-4 sm:grid-cols-4">
            <div>
              <p className="text-sm text-slate-500">현재 재고</p>
              <p className="text-lg font-semibold">{selectedProduct.currentStock.toLocaleString()}개</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">일평균 판매량</p>
              <p className="text-lg font-semibold">{selectedProduct.averageDailyDemand.toFixed(1)}개</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">리드타임</p>
              <p className="text-lg font-semibold">{selectedProduct.leadTimeDays}일</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">안전재고</p>
              <p className="text-lg font-semibold">{selectedProduct.safetyStock.toLocaleString()}개</p>
            </div>
          </div>

          {/* 시뮬레이션 파라미터 */}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>수요 변동률</Label>
                <span className="text-sm font-medium">
                  {demandChange > 0 ? "+" : ""}
                  {demandChange}%
                </span>
              </div>
              <Slider
                value={[demandChange]}
                onValueChange={(values) => setDemandChange(values[0])}
                min={-50}
                max={50}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-slate-500">
                변경 후: {(selectedProduct.averageDailyDemand * (1 + demandChange / 100)).toFixed(1)}개/일
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>리드타임 변동</Label>
                <span className="text-sm font-medium">
                  {leadTimeChange > 0 ? "+" : ""}
                  {leadTimeChange}일
                </span>
              </div>
              <Slider
                value={[leadTimeChange]}
                onValueChange={(values) => setLeadTimeChange(values[0])}
                min={-5}
                max={10}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-slate-500">
                변경 후: {Math.max(1, selectedProduct.leadTimeDays + leadTimeChange)}일
              </p>
            </div>
          </div>

          <Button onClick={runSimulation} className="w-full">
            시뮬레이션 실행
          </Button>
        </CardContent>
      </Card>

      {/* 시뮬레이션 결과 */}
      {results.length > 0 && (
        <>
          {/* 결과 테이블 */}
          <Card>
            <CardHeader>
              <CardTitle>시나리오별 분석 결과</CardTitle>
              <CardDescription>각 시나리오에서 필요한 안전재고와 발주점을 확인하세요</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="pb-3 text-left font-medium">시나리오</th>
                      <th className="pb-3 text-right font-medium">수요 변동</th>
                      <th className="pb-3 text-right font-medium">리드타임</th>
                      <th className="pb-3 text-right font-medium">안전재고</th>
                      <th className="pb-3 text-right font-medium">발주점</th>
                      <th className="pb-3 text-right font-medium">재고 상태</th>
                      <th className="pb-3 text-right font-medium">발주 필요량</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result, index) => (
                      <tr
                        key={index}
                        className={`border-b ${
                          index === 1 ? "bg-blue-50 font-medium dark:bg-blue-950/30" : "" // 사용자 설정 하이라이트
                        } ${
                          result.scenarioName.includes("최악")
                            ? "bg-red-50 dark:bg-red-950/30"
                            : result.scenarioName.includes("최선")
                              ? "bg-green-50 dark:bg-green-950/30"
                              : ""
                        }`}
                      >
                        <td className="py-3">{result.scenarioName}</td>
                        <td className="py-3 text-right">
                          <span
                            className={
                              result.demandChangePercent > 0
                                ? "text-red-600"
                                : result.demandChangePercent < 0
                                  ? "text-green-600"
                                  : ""
                            }
                          >
                            {result.demandChangePercent > 0 ? "+" : ""}
                            {result.demandChangePercent}%
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          {result.adjustedLeadTime}일
                          {result.leadTimeChangeDays !== 0 && (
                            <span
                              className={
                                result.leadTimeChangeDays > 0 ? "text-red-600" : "text-green-600"
                              }
                            >
                              {" "}
                              ({result.leadTimeChangeDays > 0 ? "+" : ""}
                              {result.leadTimeChangeDays})
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          {result.newSafetyStock.toLocaleString()}개
                          {index > 0 && (
                            <span className="ml-1 text-xs text-slate-500">
                              (
                              {result.newSafetyStock > results[0].newSafetyStock ? (
                                <TrendingUp className="inline h-3 w-3 text-red-600" />
                              ) : result.newSafetyStock < results[0].newSafetyStock ? (
                                <TrendingDown className="inline h-3 w-3 text-green-600" />
                              ) : (
                                "="
                              )}
                              )
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          {result.newReorderPoint.toLocaleString()}개
                          {index > 0 && (
                            <span className="ml-1 text-xs text-slate-500">
                              (
                              {result.newReorderPoint > results[0].newReorderPoint ? (
                                <TrendingUp className="inline h-3 w-3 text-red-600" />
                              ) : result.newReorderPoint < results[0].newReorderPoint ? (
                                <TrendingDown className="inline h-3 w-3 text-green-600" />
                              ) : (
                                "="
                              )}
                              )
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {getStatusIcon(result.stockStatus)}
                            <span>{result.stockStatus}</span>
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          {result.requiredOrderQuantity > 0
                            ? `${result.requiredOrderQuantity.toLocaleString()}개`
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 시각화: 시나리오별 발주점 비교 차트 */}
          <Card>
            <CardHeader>
              <CardTitle>시나리오별 발주점 비교</CardTitle>
              <CardDescription>현재 재고 수준과 각 시나리오의 발주점을 비교합니다</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* 현재 재고 기준선 */}
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-0.5 w-8 bg-blue-600"></div>
                  <span className="font-medium text-blue-600">
                    현재 재고: {selectedProduct.currentStock.toLocaleString()}개
                  </span>
                </div>

                {/* 시나리오별 바 차트 */}
                {results.map((result, index) => {
                  const maxValue = Math.max(...results.map((r) => r.newReorderPoint)) * 1.2;
                  const barWidth = (result.newReorderPoint / maxValue) * 100;
                  const currentStockWidth = (selectedProduct.currentStock / maxValue) * 100;

                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{result.scenarioName}</span>
                        <span className="text-slate-600">
                          {result.newReorderPoint.toLocaleString()}개
                        </span>
                      </div>
                      <div className="relative h-8 w-full">
                        {/* 발주점 바 */}
                        <div
                          className={`absolute left-0 top-0 h-full rounded ${
                            result.newReorderPoint > selectedProduct.currentStock
                              ? "bg-red-200 dark:bg-red-950/60"
                              : "bg-green-200 dark:bg-green-950/60"
                          }`}
                          style={{ width: `${barWidth}%` }}
                        >
                          <div
                            className={`flex h-full items-center justify-end pr-2 text-xs font-medium ${
                              result.newReorderPoint > selectedProduct.currentStock
                                ? "text-red-800 dark:text-red-300"
                                : "text-green-800 dark:text-green-300"
                            }`}
                          >
                            {result.stockStatus}
                          </div>
                        </div>
                        {/* 현재 재고 라인 */}
                        <div
                          className="absolute top-0 h-full border-l-2 border-blue-600"
                          style={{ left: `${currentStockWidth}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* 요약 및 권장사항 */}
          <Card>
            <CardHeader>
              <CardTitle>분석 요약 및 권장사항</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div
                  className={`rounded-lg border p-4 ${getStatusColor(results.find((r) => r.scenarioName.includes("최악"))?.stockStatus || "충분")}`}
                >
                  <p className="text-sm font-medium">최악의 시나리오</p>
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                    {results.find((r) => r.scenarioName.includes("최악"))?.scenarioName}
                  </p>
                  <p className="mt-1 text-2xl font-bold">
                    {results
                      .find((r) => r.scenarioName.includes("최악"))
                      ?.newReorderPoint.toLocaleString()}
                    개
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">발주점</p>
                </div>

                <div
                  className={`rounded-lg border p-4 ${getStatusColor(results.find((r) => r.scenarioName.includes("최선"))?.stockStatus || "충분")}`}
                >
                  <p className="text-sm font-medium">최선의 시나리오</p>
                  <p className="mt-2 text-xs text-slate-600">
                    {results.find((r) => r.scenarioName.includes("최선"))?.scenarioName}
                  </p>
                  <p className="mt-1 text-2xl font-bold">
                    {results
                      .find((r) => r.scenarioName.includes("최선"))
                      ?.newReorderPoint.toLocaleString()}
                    개
                  </p>
                  <p className="text-xs text-slate-600">발주점</p>
                </div>

                <div className="rounded-lg border bg-blue-50 p-4 dark:bg-blue-950/50 dark:border-blue-800">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-300">평균 발주점</p>
                  <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">전체 시나리오 평균</p>
                  <p className="mt-1 text-2xl font-bold text-blue-900 dark:text-blue-300">
                    {Math.ceil(
                      results.reduce((sum, r) => sum + r.newReorderPoint, 0) / results.length
                    ).toLocaleString()}
                    개
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">발주점</p>
                </div>
              </div>

              <div className="rounded-lg border bg-slate-50 dark:bg-slate-800/50 p-4">
                <h4 className="mb-2 font-medium">권장사항</h4>
                <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  {results[0].stockStatus !== "충분" && (
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
                      <span>
                        현재 재고가 기준 시나리오의 발주점보다 낮습니다. 즉시 발주를 고려하세요.
                      </span>
                    </li>
                  )}
                  {results.some((r) => r.stockStatus === "긴급") && (
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                      <span>
                        일부 시나리오에서 긴급 상황이 발생합니다. 안전재고를 증가시키는 것을 권장합니다.
                      </span>
                    </li>
                  )}
                  <li className="flex items-start gap-2">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                    <span>
                      최악의 시나리오 발주점({results.find((r) => r.scenarioName.includes("최악"))?.newReorderPoint.toLocaleString()}개)을 안전재고 정책에 반영하면 더 안정적인 재고 관리가 가능합니다.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                    <span>
                      수요 변동성이 높은 제품은 더 자주 재고 수준을 모니터링하고 발주 주기를 단축하세요.
                    </span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
