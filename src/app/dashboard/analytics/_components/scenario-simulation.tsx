"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, PackageX, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { ScenarioSimulationData } from "@/server/actions/scenario-simulation";
import type { SimulationResult, ScenarioResult } from "@/server/services/scm/scenario-simulation";

// ─── 정렬 ────────────────────────────────────────────────────────────────────

type ScenarioSortKey = "scenarioName" | "demandChangePercent" | "adjustedLeadTime" | "newSafetyStock" | "newReorderPoint" | "stockStatus" | "requiredOrderQuantity";
type SortDir = "asc" | "desc";

interface ScenarioSimulationProps {
  data: ScenarioSimulationData | null;
}

export function ScenarioSimulation({ data }: ScenarioSimulationProps) {
  const products = data?.products ?? [];
  const simulations = data?.simulations ?? [];

  // 선택된 제품 인덱스 (simulations 배열 기준)
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [demandChange, setDemandChange] = useState<number>(0);
  const [leadTimeChange, setLeadTimeChange] = useState<number>(0);
  const [results, setResults] = useState<ScenarioResult[]>([]);
  const [scenarioSortKey, setScenarioSortKey] = useState<ScenarioSortKey | null>(null);
  const [scenarioSortDir, setScenarioSortDir] = useState<SortDir>("asc");

  const handleScenarioSort = useCallback((key: ScenarioSortKey) => {
    setScenarioSortKey((prev) => {
      if (prev === key) {
        setScenarioSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return key;
      }
      setScenarioSortDir("asc");
      return key;
    });
  }, []);

  const ScenarioSortIcon = ({ column }: { column: ScenarioSortKey }) => {
    if (scenarioSortKey !== column) return <ArrowUpDown className="ml-1 inline h-3 w-3 text-muted-foreground/50" />;
    return scenarioSortDir === "asc"
      ? <ArrowUp className="ml-1 inline h-3 w-3" />
      : <ArrowDown className="ml-1 inline h-3 w-3" />;
  };

  const sortedResults = useMemo(() => {
    if (!scenarioSortKey) return results;
    const statusOrder: Record<string, number> = { "긴급": 0, "발주필요": 1, "충분": 2 };
    return [...results].sort((a, b) => {
      let cmp = 0;
      switch (scenarioSortKey) {
        case "scenarioName": cmp = a.scenarioName.localeCompare(b.scenarioName); break;
        case "demandChangePercent": cmp = a.demandChangePercent - b.demandChangePercent; break;
        case "adjustedLeadTime": cmp = a.adjustedLeadTime - b.adjustedLeadTime; break;
        case "newSafetyStock": cmp = a.newSafetyStock - b.newSafetyStock; break;
        case "newReorderPoint": cmp = a.newReorderPoint - b.newReorderPoint; break;
        case "stockStatus": cmp = (statusOrder[a.stockStatus] ?? 3) - (statusOrder[b.stockStatus] ?? 3); break;
        case "requiredOrderQuantity": cmp = a.requiredOrderQuantity - b.requiredOrderQuantity; break;
      }
      return scenarioSortDir === "asc" ? cmp : -cmp;
    });
  }, [results, scenarioSortKey, scenarioSortDir]);

  // 데이터 없음 처리
  if (!data || simulations.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <PackageX className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">
            시뮬레이션 데이터 없음
          </h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground/70">
            최근 90일간 판매 데이터가 있는 제품이 없습니다. 판매 기록 또는
            출고 이력을 입력하면 시나리오 분석이 가능합니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  const currentSim: SimulationResult = simulations[selectedIndex];
  const baseInput = currentSim.baseline;

  // 현재 제품 정보 (baseline 기준)
  const currentStock =
    baseInput.newSafetyStock > 0
      ? Math.round((baseInput.safetyStockRatio / 100) * baseInput.newSafetyStock)
      : 0;
  const averageDailyDemand = baseInput.adjustedDemand;
  const leadTimeDays = baseInput.adjustedLeadTime;
  const safetyStock = baseInput.newSafetyStock;

  // simulations 배열과 products 배열의 이름을 연결
  // products 배열 순서와 simulations 순서가 동일 — products에서 표시 이름을 가져옴
  const productLabel = (index: number) => {
    const prod = products[index];
    if (prod) return `${prod.name} (${prod.sku})`;
    return `제품 ${index + 1}`;
  };

  // 시뮬레이션 실행 (사용자 설정 + 사전 정의 시나리오)
  const runSimulation = () => {
    const baseline = currentSim.baseline;
    const predefined = currentSim.scenarios;

    // 사용자 설정 시나리오 계산 (클라이언트 사이드 — 간이 계산)
    const zScore = 1.65;
    const aDemand = averageDailyDemand * (1 + demandChange / 100);
    const aLeadTime = Math.max(1, leadTimeDays + leadTimeChange);
    const aStdDev =
      (baseline.newSafetyStock / zScore / Math.sqrt(leadTimeDays)) *
      (1 + demandChange / 100);
    const aSafety = Math.ceil(zScore * aStdDev * Math.sqrt(aLeadTime));
    const aReorder = Math.ceil(aDemand * aLeadTime + aSafety);

    let aStatus: "충분" | "발주필요" | "긴급";
    if (currentStock < aSafety * 0.5) {
      aStatus = "긴급";
    } else if (currentStock <= aReorder) {
      aStatus = "발주필요";
    } else {
      aStatus = "충분";
    }

    const userScenario: ScenarioResult = {
      scenarioName: "사용자 설정",
      demandChangePercent: demandChange,
      leadTimeChangeDays: leadTimeChange,
      adjustedDemand: Math.round(aDemand * 10) / 10,
      adjustedLeadTime: aLeadTime,
      newSafetyStock: aSafety,
      newReorderPoint: aReorder,
      stockStatus: aStatus,
      requiredOrderQuantity:
        aStatus !== "충분"
          ? Math.max(0, Math.ceil(aReorder + aDemand * 30 - currentStock))
          : 0,
      safetyStockRatio:
        aSafety > 0 ? Math.round((currentStock / aSafety) * 100) : 0,
    };

    // 표시 순서: 기준 → 사용자 설정 → 사전 정의 시나리오 (핵심만 7개)
    const displayScenarios: ScenarioResult[] = [
      baseline,
      userScenario,
      ...predefined.filter((s) =>
        [
          "수요 +20%",
          "수요 -20%",
          "리드타임 +5일",
          "리드타임 -2일",
          "최악: 수요↑20% + 리드타임↑5일",
          "최선: 수요↓20% + 리드타임↓2일",
        ].includes(s.scenarioName)
      ),
    ];

    setResults(displayScenarios);
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
            수요 변동 및 리드타임 변동 시나리오를 시뮬레이션하여 재고 정책에
            미치는 영향을 분석하세요
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 제품 선택 */}
          <div className="space-y-2">
            <Label>제품 선택</Label>
            <Select
              value={String(selectedIndex)}
              onValueChange={(value) => {
                setSelectedIndex(Number(value));
                setResults([]);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {simulations.map((_, idx) => (
                  <SelectItem key={idx} value={String(idx)}>
                    {productLabel(idx)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 현재 제품 정보 */}
          <div className="grid grid-cols-2 gap-4 rounded-lg border bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700 p-4 sm:grid-cols-4">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">현재 재고</p>
              <p className="text-lg font-semibold dark:text-slate-100">
                {currentStock.toLocaleString()}개
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">일평균 판매량</p>
              <p className="text-lg font-semibold dark:text-slate-100">
                {averageDailyDemand.toFixed(1)}개
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">리드타임</p>
              <p className="text-lg font-semibold dark:text-slate-100">
                {leadTimeDays}일
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">안전재고</p>
              <p className="text-lg font-semibold dark:text-slate-100">
                {safetyStock.toLocaleString()}개
              </p>
            </div>
          </div>

          {/* 시뮬레이션 파라미터 */}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>수요 변동률</Label>
                <span className="text-sm font-medium dark:text-slate-200">
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
              <p className="text-xs text-slate-500 dark:text-slate-400">
                변경 후:{" "}
                {(averageDailyDemand * (1 + demandChange / 100)).toFixed(1)}
                개/일
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>리드타임 변동</Label>
                <span className="text-sm font-medium dark:text-slate-200">
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
              <p className="text-xs text-slate-500 dark:text-slate-400">
                변경 후: {Math.max(1, leadTimeDays + leadTimeChange)}일
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
              <CardDescription>
                각 시나리오에서 필요한 안전재고와 발주점을 확인하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b dark:border-slate-700">
                      <th className="pb-3 text-left font-medium dark:text-slate-200 cursor-pointer select-none hover:text-foreground" onClick={() => handleScenarioSort("scenarioName")}>
                        시나리오<ScenarioSortIcon column="scenarioName" />
                      </th>
                      <th className="pb-3 text-right font-medium dark:text-slate-200 cursor-pointer select-none hover:text-foreground" onClick={() => handleScenarioSort("demandChangePercent")}>
                        수요 변동<ScenarioSortIcon column="demandChangePercent" />
                      </th>
                      <th className="pb-3 text-right font-medium dark:text-slate-200 cursor-pointer select-none hover:text-foreground" onClick={() => handleScenarioSort("adjustedLeadTime")}>
                        리드타임<ScenarioSortIcon column="adjustedLeadTime" />
                      </th>
                      <th className="pb-3 text-right font-medium dark:text-slate-200 cursor-pointer select-none hover:text-foreground" onClick={() => handleScenarioSort("newSafetyStock")}>
                        안전재고<ScenarioSortIcon column="newSafetyStock" />
                      </th>
                      <th className="pb-3 text-right font-medium dark:text-slate-200 cursor-pointer select-none hover:text-foreground" onClick={() => handleScenarioSort("newReorderPoint")}>
                        발주점<ScenarioSortIcon column="newReorderPoint" />
                      </th>
                      <th className="pb-3 text-right font-medium dark:text-slate-200 cursor-pointer select-none hover:text-foreground" onClick={() => handleScenarioSort("stockStatus")}>
                        재고 상태<ScenarioSortIcon column="stockStatus" />
                      </th>
                      <th className="pb-3 text-right font-medium dark:text-slate-200 cursor-pointer select-none hover:text-foreground" onClick={() => handleScenarioSort("requiredOrderQuantity")}>
                        발주 필요량<ScenarioSortIcon column="requiredOrderQuantity" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedResults.map((result, index) => (
                      <tr
                        key={index}
                        className={`border-b dark:border-slate-700 ${
                          result.scenarioName === "사용자 설정"
                            ? "bg-blue-50 font-medium dark:bg-blue-950/30"
                            : ""
                        } ${
                          result.scenarioName.includes("최악")
                            ? "bg-red-50 dark:bg-red-950/30"
                            : result.scenarioName.includes("최선")
                              ? "bg-green-50 dark:bg-green-950/30"
                              : ""
                        }`}
                      >
                        <td className="py-3 dark:text-slate-200">
                          {result.scenarioName}
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className={
                              result.demandChangePercent > 0
                                ? "text-red-600 dark:text-red-400"
                                : result.demandChangePercent < 0
                                  ? "text-green-600 dark:text-green-400"
                                  : "dark:text-slate-300"
                            }
                          >
                            {result.demandChangePercent > 0 ? "+" : ""}
                            {result.demandChangePercent}%
                          </span>
                        </td>
                        <td className="py-3 text-right dark:text-slate-300">
                          {result.adjustedLeadTime}일
                          {result.leadTimeChangeDays !== 0 && (
                            <span
                              className={
                                result.leadTimeChangeDays > 0
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-green-600 dark:text-green-400"
                              }
                            >
                              {" "}
                              ({result.leadTimeChangeDays > 0 ? "+" : ""}
                              {result.leadTimeChangeDays})
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-right dark:text-slate-300">
                          {result.newSafetyStock.toLocaleString()}개
                          {result.scenarioName !== "기준" && results[0] && (
                            <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
                              (
                              {result.newSafetyStock >
                              results[0].newSafetyStock ? (
                                <TrendingUp className="inline h-3 w-3 text-red-600 dark:text-red-400" />
                              ) : result.newSafetyStock <
                                results[0].newSafetyStock ? (
                                <TrendingDown className="inline h-3 w-3 text-green-600 dark:text-green-400" />
                              ) : (
                                "="
                              )}
                              )
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-right dark:text-slate-300">
                          {result.newReorderPoint.toLocaleString()}개
                          {result.scenarioName !== "기준" && results[0] && (
                            <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
                              (
                              {result.newReorderPoint >
                              results[0].newReorderPoint ? (
                                <TrendingUp className="inline h-3 w-3 text-red-600 dark:text-red-400" />
                              ) : result.newReorderPoint <
                                results[0].newReorderPoint ? (
                                <TrendingDown className="inline h-3 w-3 text-green-600 dark:text-green-400" />
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
                            <span className="dark:text-slate-200">
                              {result.stockStatus}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 text-right dark:text-slate-300">
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
              <CardDescription>
                현재 재고 수준과 각 시나리오의 발주점을 비교합니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* 현재 재고 기준선 */}
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-0.5 w-8 bg-blue-600 dark:bg-blue-400"></div>
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    현재 재고: {currentStock.toLocaleString()}개
                  </span>
                </div>

                {/* 시나리오별 바 차트 */}
                {results.map((result, index) => {
                  const maxValue =
                    Math.max(...results.map((r) => r.newReorderPoint)) * 1.2;
                  const barWidth =
                    maxValue > 0 ? (result.newReorderPoint / maxValue) * 100 : 0;
                  const currentStockWidth =
                    maxValue > 0 ? (currentStock / maxValue) * 100 : 0;

                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium dark:text-slate-200">
                          {result.scenarioName}
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          {result.newReorderPoint.toLocaleString()}개
                        </span>
                      </div>
                      <div className="relative h-8 w-full">
                        {/* 발주점 바 */}
                        <div
                          className={`absolute left-0 top-0 h-full rounded ${
                            result.newReorderPoint > currentStock
                              ? "bg-red-200 dark:bg-red-950/60"
                              : "bg-green-200 dark:bg-green-950/60"
                          }`}
                          style={{ width: `${barWidth}%` }}
                        >
                          <div
                            className={`flex h-full items-center justify-end pr-2 text-xs font-medium ${
                              result.newReorderPoint > currentStock
                                ? "text-red-800 dark:text-red-300"
                                : "text-green-800 dark:text-green-300"
                            }`}
                          >
                            {result.stockStatus}
                          </div>
                        </div>
                        {/* 현재 재고 라인 */}
                        <div
                          className="absolute top-0 h-full border-l-2 border-blue-600 dark:border-blue-400"
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
                  className={`rounded-lg border p-4 ${getStatusColor(
                    results.find((r) => r.scenarioName.includes("최악"))
                      ?.stockStatus || "충분"
                  )}`}
                >
                  <p className="text-sm font-medium">최악의 시나리오</p>
                  <p className="mt-2 text-xs opacity-70">
                    {results.find((r) => r.scenarioName.includes("최악"))
                      ?.scenarioName}
                  </p>
                  <p className="mt-1 text-2xl font-bold">
                    {results
                      .find((r) => r.scenarioName.includes("최악"))
                      ?.newReorderPoint.toLocaleString()}
                    개
                  </p>
                  <p className="text-xs opacity-70">발주점</p>
                </div>

                <div
                  className={`rounded-lg border p-4 ${getStatusColor(
                    results.find((r) => r.scenarioName.includes("최선"))
                      ?.stockStatus || "충분"
                  )}`}
                >
                  <p className="text-sm font-medium">최선의 시나리오</p>
                  <p className="mt-2 text-xs opacity-70">
                    {results.find((r) => r.scenarioName.includes("최선"))
                      ?.scenarioName}
                  </p>
                  <p className="mt-1 text-2xl font-bold">
                    {results
                      .find((r) => r.scenarioName.includes("최선"))
                      ?.newReorderPoint.toLocaleString()}
                    개
                  </p>
                  <p className="text-xs opacity-70">발주점</p>
                </div>

                <div className="rounded-lg border bg-blue-50 p-4 dark:bg-blue-950/50 dark:border-blue-800">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-300">
                    평균 발주점
                  </p>
                  <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                    전체 시나리오 평균
                  </p>
                  <p className="mt-1 text-2xl font-bold text-blue-900 dark:text-blue-300">
                    {Math.ceil(
                      results.reduce((sum, r) => sum + r.newReorderPoint, 0) /
                        results.length
                    ).toLocaleString()}
                    개
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">발주점</p>
                </div>
              </div>

              <div className="rounded-lg border bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700 p-4">
                <h4 className="mb-2 font-medium dark:text-slate-200">권장사항</h4>
                <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  {results[0].stockStatus !== "충분" && (
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
                      <span>
                        현재 재고가 기준 시나리오의 발주점보다 낮습니다. 즉시
                        발주를 고려하세요.
                      </span>
                    </li>
                  )}
                  {results.some((r) => r.stockStatus === "긴급") && (
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                      <span>
                        일부 시나리오에서 긴급 상황이 발생합니다. 안전재고를
                        증가시키는 것을 권장합니다.
                      </span>
                    </li>
                  )}
                  <li className="flex items-start gap-2">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                    <span>
                      최악의 시나리오 발주점(
                      {results
                        .find((r) => r.scenarioName.includes("최악"))
                        ?.newReorderPoint.toLocaleString()}
                      개)을 안전재고 정책에 반영하면 더 안정적인 재고 관리가
                      가능합니다.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                    <span>
                      수요 변동성이 높은 제품은 더 자주 재고 수준을 모니터링하고
                      발주 주기를 단축하세요.
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
