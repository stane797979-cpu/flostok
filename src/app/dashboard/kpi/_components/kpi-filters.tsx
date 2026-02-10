"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface KPIFiltersProps {
  abcFilter: string;
  onAbcFilterChange: (v: string) => void;
  xyzFilter: string;
  onXyzFilterChange: (v: string) => void;
  isLoading?: boolean;
}

export function KPIFilters({
  abcFilter,
  onAbcFilterChange,
  xyzFilter,
  onXyzFilterChange,
  isLoading,
}: KPIFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={abcFilter} onValueChange={onAbcFilterChange} disabled={isLoading}>
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="ABC 등급" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 ABC</SelectItem>
          <SelectItem value="A">A등급</SelectItem>
          <SelectItem value="B">B등급</SelectItem>
          <SelectItem value="C">C등급</SelectItem>
        </SelectContent>
      </Select>

      <Select value={xyzFilter} onValueChange={onXyzFilterChange} disabled={isLoading}>
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="XYZ 등급" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 XYZ</SelectItem>
          <SelectItem value="X">X등급</SelectItem>
          <SelectItem value="Y">Y등급</SelectItem>
          <SelectItem value="Z">Z등급</SelectItem>
        </SelectContent>
      </Select>

      {isLoading && (
        <span className="text-xs text-muted-foreground animate-pulse">
          조회 중...
        </span>
      )}
    </div>
  );
}
