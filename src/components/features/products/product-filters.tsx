"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, X } from "lucide-react";

interface ProductFiltersProps {
  onFilterChange?: (filters: ProductFilterState) => void;
}

export interface ProductFilterState {
  category?: string;
  abcGrade?: string;
  xyzGrade?: string;
  status?: string;
}

export function ProductFilters({ onFilterChange }: ProductFiltersProps) {
  const handleCategoryChange = (value: string) => {
    console.log("Category:", value);
    onFilterChange?.({ category: value === "all" ? undefined : value });
  };

  const handleAbcGradeChange = (value: string) => {
    console.log("ABC Grade:", value);
    onFilterChange?.({ abcGrade: value === "all" ? undefined : value });
  };

  const handleXyzGradeChange = (value: string) => {
    console.log("XYZ Grade:", value);
    onFilterChange?.({ xyzGrade: value === "all" ? undefined : value });
  };

  const handleStatusChange = (value: string) => {
    console.log("Status:", value);
    onFilterChange?.({ status: value === "all" ? undefined : value });
  };

  const handleReset = () => {
    console.log("Reset filters");
    onFilterChange?.({});
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Filter className="h-4 w-4" />
        <span className="font-medium">필터:</span>
      </div>

      {/* 카테고리 */}
      <Select defaultValue="all" onValueChange={handleCategoryChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="카테고리" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 카테고리</SelectItem>
          <SelectItem value="체결류">체결류</SelectItem>
          <SelectItem value="프레임">프레임</SelectItem>
          <SelectItem value="동력전달">동력전달</SelectItem>
          <SelectItem value="유압">유압</SelectItem>
          <SelectItem value="전기">전기</SelectItem>
          <SelectItem value="소모품">소모품</SelectItem>
        </SelectContent>
      </Select>

      {/* ABC 등급 */}
      <Select defaultValue="all" onValueChange={handleAbcGradeChange}>
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="ABC 등급" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 등급</SelectItem>
          <SelectItem value="A">A 등급</SelectItem>
          <SelectItem value="B">B 등급</SelectItem>
          <SelectItem value="C">C 등급</SelectItem>
        </SelectContent>
      </Select>

      {/* XYZ 등급 */}
      <Select defaultValue="all" onValueChange={handleXyzGradeChange}>
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="XYZ 등급" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 등급</SelectItem>
          <SelectItem value="X">X 등급</SelectItem>
          <SelectItem value="Y">Y 등급</SelectItem>
          <SelectItem value="Z">Z 등급</SelectItem>
        </SelectContent>
      </Select>

      {/* 재고상태 */}
      <Select defaultValue="all" onValueChange={handleStatusChange}>
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder="재고상태" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 상태</SelectItem>
          <SelectItem value="out_of_stock">품절</SelectItem>
          <SelectItem value="critical">위험</SelectItem>
          <SelectItem value="shortage">부족</SelectItem>
          <SelectItem value="caution">주의</SelectItem>
          <SelectItem value="optimal">적정</SelectItem>
          <SelectItem value="excess">과다</SelectItem>
          <SelectItem value="overstock">과잉</SelectItem>
        </SelectContent>
      </Select>

      {/* 필터 초기화 */}
      <Button variant="ghost" size="sm" onClick={handleReset}>
        <X className="mr-1 h-4 w-4" />
        초기화
      </Button>
    </div>
  );
}
