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
import { MoreHorizontal, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Supplier } from "@/server/db/schema";

interface SupplierTableProps {
  suppliers: Supplier[];
  onEdit?: (supplier: Supplier) => void;
  onDelete?: (supplier: Supplier) => void;
}

type SortField = "name" | "code" | "representative" | "contactPhone" | "contactEmail" | "avgLeadTime" | "category" | "paymentTerms";
type SortDirection = "asc" | "desc" | null;

export function SupplierTable({ suppliers, onEdit, onDelete }: SupplierTableProps) {
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

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
          aValue = a.name; bValue = b.name; break;
        case "code":
          aValue = a.code; bValue = b.code; break;
        case "representative":
          aValue = a.representative; bValue = b.representative; break;
        case "contactPhone":
          aValue = a.contactPhone; bValue = b.contactPhone; break;
        case "contactEmail":
          aValue = a.contactEmail; bValue = b.contactEmail; break;
        case "avgLeadTime":
          aValue = a.avgLeadTime; bValue = b.avgLeadTime; break;
        case "category":
          aValue = a.category; bValue = b.category; break;
        case "paymentTerms":
          aValue = a.paymentTerms; bValue = b.paymentTerms; break;
        default:
          return 0;
      }

      // null 값 처리: null은 맨 뒤로
      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;

      // 숫자 정렬
      if (sortField === "avgLeadTime") {
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
              <Button variant="ghost" size="sm" className="h-auto p-0 font-medium hover:bg-transparent" onClick={() => handleSort("name")}>
                거래처명<SortIcon field="name" />
              </Button>
            </TableHead>
            <TableHead>
              <Button variant="ghost" size="sm" className="h-auto p-0 font-medium hover:bg-transparent" onClick={() => handleSort("code")}>
                거래처코드<SortIcon field="code" />
              </Button>
            </TableHead>
            <TableHead>
              <Button variant="ghost" size="sm" className="h-auto p-0 font-medium hover:bg-transparent" onClick={() => handleSort("representative")}>
                대표자<SortIcon field="representative" />
              </Button>
            </TableHead>
            <TableHead>사업자번호</TableHead>
            <TableHead>
              <Button variant="ghost" size="sm" className="h-auto p-0 font-medium hover:bg-transparent" onClick={() => handleSort("contactPhone")}>
                전화번호<SortIcon field="contactPhone" />
              </Button>
            </TableHead>
            <TableHead>
              <Button variant="ghost" size="sm" className="h-auto p-0 font-medium hover:bg-transparent" onClick={() => handleSort("contactEmail")}>
                이메일<SortIcon field="contactEmail" />
              </Button>
            </TableHead>
            <TableHead>주소</TableHead>
            <TableHead>
              <Button variant="ghost" size="sm" className="h-auto p-0 font-medium hover:bg-transparent" onClick={() => handleSort("paymentTerms")}>
                결제조건<SortIcon field="paymentTerms" />
              </Button>
            </TableHead>
            <TableHead>
              <Button variant="ghost" size="sm" className="h-auto p-0 font-medium hover:bg-transparent" onClick={() => handleSort("category")}>
                분류<SortIcon field="category" />
              </Button>
            </TableHead>
            <TableHead className="text-center">
              <Button variant="ghost" size="sm" className="h-auto p-0 font-medium hover:bg-transparent" onClick={() => handleSort("avgLeadTime")}>
                리드타임<SortIcon field="avgLeadTime" />
              </Button>
            </TableHead>
            <TableHead>메모</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="h-24 text-center text-slate-500">
                등록된 공급자가 없습니다.
              </TableCell>
            </TableRow>
          ) : (
            sortedSuppliers.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((supplier) => (
              <TableRow key={supplier.id}>
                <TableCell className="font-medium whitespace-nowrap">{supplier.name}</TableCell>
                <TableCell className="text-sm whitespace-nowrap">{supplier.code || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{supplier.representative || "-"}</TableCell>
                <TableCell className="font-mono text-sm whitespace-nowrap">{supplier.businessNumber || "-"}</TableCell>
                <TableCell className="font-mono text-sm whitespace-nowrap">{supplier.contactPhone || "-"}</TableCell>
                <TableCell className="text-slate-500 text-sm">{supplier.contactEmail || "-"}</TableCell>
                <TableCell className="text-slate-500 text-sm max-w-[200px] truncate">{supplier.address || "-"}</TableCell>
                <TableCell className="text-sm whitespace-nowrap">{supplier.paymentTerms || "-"}</TableCell>
                <TableCell>
                  {supplier.category ? (
                    <Badge variant="secondary">{supplier.category}</Badge>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline">{supplier.avgLeadTime}일</Badge>
                </TableCell>
                <TableCell className="text-slate-500 text-sm max-w-[150px] truncate">{supplier.notes || "-"}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
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
      {/* 페이지네이션 */}
      <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
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
          <span>개 · 총 {sortedSuppliers.length}개</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>이전</Button>
          <span className="px-2">{currentPage} / {Math.max(1, Math.ceil(sortedSuppliers.length / pageSize))}</span>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={currentPage >= Math.ceil(sortedSuppliers.length / pageSize)} onClick={() => setCurrentPage((p) => p + 1)}>다음</Button>

        </div>
      </div>
    </div>
  );
}
