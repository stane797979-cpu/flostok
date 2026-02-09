"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

interface PSIFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  abcFilter: string;
  onAbcFilterChange: (v: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (v: string) => void;
  categories: string[];
}

export function PSIFilters({
  search,
  onSearchChange,
  abcFilter,
  onAbcFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  categories,
}: PSIFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-[250px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="SKU 또는 제품명 검색..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <Select value={abcFilter} onValueChange={onAbcFilterChange}>
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="ABC 등급" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">전체 등급</SelectItem>
          <SelectItem value="A">A등급</SelectItem>
          <SelectItem value="B">B등급</SelectItem>
          <SelectItem value="C">C등급</SelectItem>
        </SelectContent>
      </Select>

      {categories.length > 0 && (
        <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="카테고리" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 카테고리</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
