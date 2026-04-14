"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ABCXYZFMRItem } from "@/server/services/scm/abc-xyz-analysis";

interface AnalyticsFMRProps {
  items: ABCXYZFMRItem[];
}

const ABC_COLORS: Record<string, string> = {
  A: "bg-green-100 text-green-800",
  B: "bg-blue-100 text-blue-800",
  C: "bg-slate-100 text-slate-700",
};

const XYZ_COLORS: Record<string, string> = {
  X: "bg-emerald-100 text-emerald-800",
  Y: "bg-yellow-100 text-yellow-800",
  Z: "bg-orange-100 text-orange-800",
};

const FMR_COLORS: Record<string, string> = {
  F: "bg-blue-100 text-blue-800",
  M: "bg-indigo-100 text-indigo-800",
  R: "bg-slate-100 text-slate-600",
};

const FMR_LABELS: Record<string, string> = {
  F: "F (고빈도)",
  M: "M (중빈도)",
  R: "R (저빈도)",
};

// 27가지 조합 분포 히트맵 데이터
function buildHeatmapData(items: ABCXYZFMRItem[]) {
  const abcList = ["A", "B", "C"];
  const xyzList = ["X", "Y", "Z"];
  const fmrList = ["F", "M", "R"];

  return abcList.map((abc) => ({
    abc,
    rows: xyzList.map((xyz) => ({
      xyz,
      cells: fmrList.map((fmr) => ({
        fmr,
        grade: `${abc}${xyz}${fmr}`,
        count: items.filter((i) => i.abcGrade === abc && i.xyzGrade === xyz && i.fmrGrade === fmr).length,
      })),
    })),
  }));
}

function getCellColor(abc: string, count: number): string {
  if (count === 0) return "bg-slate-50 text-slate-300";
  if (abc === "A") return "bg-green-100 text-green-900 font-semibold";
  if (abc === "B") return "bg-blue-50 text-blue-900";
  return "bg-slate-100 text-slate-700";
}

export function AnalyticsFMR({ items }: AnalyticsFMRProps) {
  const [fmrFilter, setFmrFilter] = useState<string>("all");
  const [abcFilter, setAbcFilter] = useState<string>("all");
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const heatmap = buildHeatmapData(items);

  const fCount = items.filter((i) => i.fmrGrade === "F").length;
  const mCount = items.filter((i) => i.fmrGrade === "M").length;
  const rCount = items.filter((i) => i.fmrGrade === "R").length;

  let filtered = items;
  if (fmrFilter !== "all") filtered = filtered.filter((i) => i.fmrGrade === fmrFilter);
  if (abcFilter !== "all") filtered = filtered.filter((i) => i.abcGrade === abcFilter);

  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">F등급 (고빈도)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{fCount}개</div>
            <p className="text-xs text-slate-500 mt-1">월 10회 이상 출고 — 자동발주 적합</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-indigo-700">M등급 (중빈도)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-700">{mCount}개</div>
            <p className="text-xs text-slate-500 mt-1">월 4~9회 출고 — 정기 검토</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">R등급 (저빈도)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-600">{rCount}개</div>
            <p className="text-xs text-slate-500 mt-1">월 3회 이하 출고 — 재고 최소화</p>
          </CardContent>
        </Card>
      </div>

      {/* 27가지 조합 히트맵 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">ABC × XYZ × FMR 분포 (27가지 조합)</CardTitle>
          <p className="text-xs text-slate-500">각 셀의 숫자는 해당 등급 제품 수</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="border p-2 bg-slate-50 text-left w-12">ABC</th>
                  <th className="border p-2 bg-slate-50 text-left w-12">XYZ</th>
                  <th className="border p-2 bg-blue-50 text-center">F (고빈도)</th>
                  <th className="border p-2 bg-indigo-50 text-center">M (중빈도)</th>
                  <th className="border p-2 bg-slate-50 text-center">R (저빈도)</th>
                </tr>
              </thead>
              <tbody>
                {heatmap.map(({ abc, rows }) =>
                  rows.map(({ xyz, cells }, rowIdx) => (
                    <tr key={`${abc}-${xyz}`}>
                      {rowIdx === 0 && (
                        <td
                          rowSpan={3}
                          className={`border p-2 text-center font-bold text-lg ${
                            abc === "A" ? "bg-green-50 text-green-800" :
                            abc === "B" ? "bg-blue-50 text-blue-800" :
                            "bg-slate-50 text-slate-700"
                          }`}
                        >
                          {abc}
                        </td>
                      )}
                      <td className="border p-2 text-center font-medium text-slate-600">
                        {xyz}
                      </td>
                      {cells.map(({ fmr, grade, count }) => (
                        <td
                          key={fmr}
                          className={`border p-2 text-center cursor-pointer hover:ring-2 hover:ring-blue-300 ${getCellColor(abc, count)}`}
                          onClick={() => {
                            setAbcFilter(abc);
                            setFmrFilter(fmr);
                          }}
                        >
                          <div className="font-mono text-xs text-slate-400">{grade}</div>
                          <div className="text-base font-bold">{count > 0 ? count : "-"}</div>
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 mt-2">셀 클릭 시 해당 등급으로 필터링됩니다.</p>
        </CardContent>
      </Card>

      {/* 제품 목록 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-medium">제품별 3중 등급 목록</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Select value={abcFilter} onValueChange={(v) => { setAbcFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="ABC" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ABC 전체</SelectItem>
                  <SelectItem value="A">A등급</SelectItem>
                  <SelectItem value="B">B등급</SelectItem>
                  <SelectItem value="C">C등급</SelectItem>
                </SelectContent>
              </Select>
              <Select value={fmrFilter} onValueChange={(v) => { setFmrFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="FMR" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">FMR 전체</SelectItem>
                  <SelectItem value="F">F (고빈도)</SelectItem>
                  <SelectItem value="M">M (중빈도)</SelectItem>
                  <SelectItem value="R">R (저빈도)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-slate-500">총 {filtered.length}개 제품</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>제품명</TableHead>
                  <TableHead className="text-center">ABC</TableHead>
                  <TableHead className="text-center">XYZ</TableHead>
                  <TableHead className="text-center">FMR</TableHead>
                  <TableHead className="text-center font-semibold">3중 등급</TableHead>
                  <TableHead className="text-right">우선순위</TableHead>
                  <TableHead className="min-w-48">권장 전략</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-slate-400">
                      조건에 맞는 제품이 없습니다
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={ABC_COLORS[item.abcGrade]}>{item.abcGrade}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={XYZ_COLORS[item.xyzGrade]}>{item.xyzGrade}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={FMR_COLORS[item.fmrGrade]}>
                          {FMR_LABELS[item.fmrGrade]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-mono font-bold tracking-widest text-sm">
                          {item.combinedGrade}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-slate-500">
                        {item.priority}점
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{item.strategy}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {/* 페이지네이션 */}
          <div className="flex items-center justify-between px-2 py-3 border-t text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>페이지당</span>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                <SelectTrigger className="h-7 w-16 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span>개 · 총 {filtered.length}개</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>이전</Button>
              <span className="px-2">{currentPage} / {Math.max(1, Math.ceil(filtered.length / pageSize))}</span>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={currentPage >= Math.ceil(filtered.length / pageSize)} onClick={() => setCurrentPage((p) => p + 1)}>다음</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
