"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MatrixCell {
  grade: string;
  count: number;
}

interface ABCXYZMatrixProps {
  matrixData: MatrixCell[];
  selectedGrade: string | null;
  onSelectGrade: (grade: string) => void;
}

const GRADE_COLORS: Record<string, string> = {
  AX: "bg-green-600 hover:bg-green-700 text-white",
  AY: "bg-green-500 hover:bg-green-600 text-white",
  AZ: "bg-yellow-500 hover:bg-yellow-600 text-white",
  BX: "bg-green-500 hover:bg-green-600 text-white",
  BY: "bg-yellow-400 hover:bg-yellow-500 text-white",
  BZ: "bg-orange-400 hover:bg-orange-500 text-white",
  CX: "bg-yellow-400 hover:bg-yellow-500 text-white",
  CY: "bg-orange-400 hover:bg-orange-500 text-white",
  CZ: "bg-slate-400 hover:bg-slate-500 text-white",
};

const GRADE_LABELS: Record<string, string> = {
  AX: "AX: 핵심 안정",
  AY: "AY: 핵심 변동",
  AZ: "AZ: 핵심 불안정",
  BX: "BX: 중요 안정",
  BY: "BY: 중요 변동",
  BZ: "BZ: 중요 불안정",
  CX: "CX: 일반 안정",
  CY: "CY: 일반 변동",
  CZ: "CZ: 일반 불안정",
};

export function ABCXYZMatrix({ matrixData, selectedGrade, onSelectGrade }: ABCXYZMatrixProps) {
  const getCount = (grade: string) => {
    return matrixData.find((d) => d.grade === grade)?.count || 0;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>ABC-XYZ 매트릭스</CardTitle>
        <p className="text-sm text-slate-500">셀을 클릭하여 해당 등급 제품을 필터링하세요</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-2">
          {/* 헤더 행 */}
          <div className="flex items-center justify-center text-sm font-medium text-slate-600">
            ABC \ XYZ
          </div>
          <div className="flex items-center justify-center text-sm font-medium text-slate-600">
            X (안정)
          </div>
          <div className="flex items-center justify-center text-sm font-medium text-slate-600">
            Y (변동)
          </div>
          <div className="flex items-center justify-center text-sm font-medium text-slate-600">
            Z (불안정)
          </div>

          {/* A등급 행 */}
          <div className="flex items-center justify-center text-sm font-medium text-slate-600">
            A (상위)
          </div>
          {["AX", "AY", "AZ"].map((grade) => (
            <button
              key={grade}
              onClick={() => onSelectGrade(grade)}
              className={cn(
                "rounded-lg p-4 transition-all duration-200",
                GRADE_COLORS[grade],
                selectedGrade === grade && "ring-2 ring-slate-900 ring-offset-2",
                "flex flex-col items-center justify-center"
              )}
            >
              <span className="mb-1 text-xs font-medium">{grade}</span>
              <span className="text-2xl font-bold">{getCount(grade)}</span>
              <span className="text-xs opacity-80">제품</span>
            </button>
          ))}

          {/* B등급 행 */}
          <div className="flex items-center justify-center text-sm font-medium text-slate-600">
            B (중위)
          </div>
          {["BX", "BY", "BZ"].map((grade) => (
            <button
              key={grade}
              onClick={() => onSelectGrade(grade)}
              className={cn(
                "rounded-lg p-4 transition-all duration-200",
                GRADE_COLORS[grade],
                selectedGrade === grade && "ring-2 ring-slate-900 ring-offset-2",
                "flex flex-col items-center justify-center"
              )}
            >
              <span className="mb-1 text-xs font-medium">{grade}</span>
              <span className="text-2xl font-bold">{getCount(grade)}</span>
              <span className="text-xs opacity-80">제품</span>
            </button>
          ))}

          {/* C등급 행 */}
          <div className="flex items-center justify-center text-sm font-medium text-slate-600">
            C (하위)
          </div>
          {["CX", "CY", "CZ"].map((grade) => (
            <button
              key={grade}
              onClick={() => onSelectGrade(grade)}
              className={cn(
                "rounded-lg p-4 transition-all duration-200",
                GRADE_COLORS[grade],
                selectedGrade === grade && "ring-2 ring-slate-900 ring-offset-2",
                "flex flex-col items-center justify-center"
              )}
            >
              <span className="mb-1 text-xs font-medium">{grade}</span>
              <span className="text-2xl font-bold">{getCount(grade)}</span>
              <span className="text-xs opacity-80">제품</span>
            </button>
          ))}
        </div>

        {selectedGrade && (
          <div className="mt-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
            <p className="text-sm font-medium text-slate-900">
              선택된 등급: {GRADE_LABELS[selectedGrade]}
            </p>
            <button
              onClick={() => onSelectGrade("")}
              className="mt-2 text-xs text-blue-600 hover:text-blue-700"
            >
              필터 초기화
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
