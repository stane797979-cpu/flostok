"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Edit, Trash2, Star, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type Supplier } from "@/server/db/schema";
import { cn } from "@/lib/utils";

interface SupplierTableProps {
  suppliers: Supplier[];
  onEdit?: (supplier: Supplier) => void;
  onDelete?: (supplier: Supplier) => void;
}

type SortField = "name" | "contactName" | "contactPhone" | "contactEmail" | "avgLeadTime" | "rating";
type SortDirection = "asc" | "desc" | null;

export function SupplierTable({ suppliers, onEdit, onDelete }: SupplierTableProps) {
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // 3-state toggle: asc → desc → null
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortDirection(null);
        setSortField("name"); // 정렬 해제 시 기본값으로
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field || sortDirection === null) {
      return <ArrowUpDown className="ml-1 h-3 w-3 text-slate-400" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3 text-primary-600" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 text-primary-600" />
    );
  };

  const sortedSuppliers = useMemo(() => {
    if (sortDirection === null) return suppliers;

    const dir = sortDirection === "asc" ? 1 : -1;

    return [...suppliers].sort((a, b) => {
      let aValue: string | number | null;
      let bValue: string | number | null;

      switch (sortField) {
        case "name":
          aValue = a.name;
          bValue = b.name;
          break;
        case "contactName":
          aValue = a.contactName;
          bValue = b.contactName;
          break;
        case "contactPhone":
          aValue = a.contactPhone;
          bValue = b.contactPhone;
          break;
        case "contactEmail":
          aValue = a.contactEmail;
          bValue = b.contactEmail;
          break;
        case "avgLeadTime":
          aValue = a.avgLeadTime;
          bValue = b.avgLeadTime;
          break;
        case "rating":
          aValue = a.rating;
          bValue = b.rating;
          break;
        default:
          return 0;
      }

      // null 값 처리: null은 맨 뒤로
      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;

      // 숫자 정렬
      if (sortField === "avgLeadTime" || sortField === "rating") {
        const numA = Number(aValue);
        const numB = Number(bValue);
        return dir * (numA - numB);
      }

      // 문자열 정렬 (한국어 지원)
      return dir * String(aValue).localeCompare(String(bValue), "ko");
    });
  }, [suppliers, sortField, sortDirection]);

  return (
    <div className="rounded-lg border bg-white dark:bg-slate-950">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 font-medium hover:bg-transparent"
                onClick={() => handleSort("name")}
              >
                공급자명
                <SortIcon field="name" />
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 font-medium hover:bg-transparent"
                onClick={() => handleSort("contactName")}
              >
                담당자
                <SortIcon field="contactName" />
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 font-medium hover:bg-transparent"
                onClick={() => handleSort("contactPhone")}
              >
                연락처
                <SortIcon field="contactPhone" />
              </Button>
            </TableHead>
            <TableHead>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 font-medium hover:bg-transparent"
                onClick={() => handleSort("contactEmail")}
              >
                이메일
                <SortIcon field="contactEmail" />
              </Button>
            </TableHead>
            <TableHead className="text-center">
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 font-medium hover:bg-transparent"
                onClick={() => handleSort("avgLeadTime")}
              >
                리드타임
                <SortIcon field="avgLeadTime" />
              </Button>
            </TableHead>
            <TableHead className="text-center">
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 font-medium hover:bg-transparent"
                onClick={() => handleSort("rating")}
              >
                평점
                <SortIcon field="rating" />
              </Button>
            </TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                등록된 공급자가 없습니다.
              </TableCell>
            </TableRow>
          ) : (
            sortedSuppliers.map((supplier) => (
              <TableRow key={supplier.id}>
                <TableCell className="font-medium">{supplier.name}</TableCell>
                <TableCell>{supplier.contactName || "-"}</TableCell>
                <TableCell className="font-mono text-sm">{supplier.contactPhone || "-"}</TableCell>
                <TableCell className="text-slate-500">{supplier.contactEmail || "-"}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline">{supplier.avgLeadTime}일</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">
                      {(Number(supplier.rating) / 20).toFixed(1)}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`${supplier.name} 옵션`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit?.(supplier)}>
                        <Edit className="mr-2 h-4 w-4" />
                        수정
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => onDelete?.(supplier)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        삭제
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
