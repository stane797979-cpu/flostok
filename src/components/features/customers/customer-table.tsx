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
import { type Customer } from "@/server/db/schema";

interface CustomerTableProps {
  customers: Customer[];
  onEdit?: (customer: Customer) => void;
  onDelete?: (customer: Customer) => void;
}

type SortField = "name" | "code" | "representative" | "contactPhone" | "contactEmail" | "channel" | "paymentTerms";
type SortDirection = "asc" | "desc" | null;

const CHANNEL_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  온라인몰: "default",
  오픈마켓: "secondary",
  홈쇼핑: "default",
  도매: "outline",
  직영: "secondary",
  기타: "outline",
};

export function CustomerTable({ customers, onEdit, onDelete }: CustomerTableProps) {
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortDirection(null);
        setSortField("name");
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

  const sortedCustomers = useMemo(() => {
    if (sortDirection === null) return customers;

    const dir = sortDirection === "asc" ? 1 : -1;

    return [...customers].sort((a, b) => {
      let aValue: string | null;
      let bValue: string | null;

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
        case "channel":
          aValue = a.channel; bValue = b.channel; break;
        case "paymentTerms":
          aValue = a.paymentTerms; bValue = b.paymentTerms; break;
        default:
          return 0;
      }

      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;

      return dir * String(aValue).localeCompare(String(bValue), "ko");
    });
  }, [customers, sortField, sortDirection]);

  return (
    <div className="rounded-lg border bg-white dark:bg-slate-950">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Button variant="ghost" size="sm" className="h-auto p-0 font-medium hover:bg-transparent" onClick={() => handleSort("code")}>
                거래처코드<SortIcon field="code" />
              </Button>
            </TableHead>
            <TableHead>
              <Button variant="ghost" size="sm" className="h-auto p-0 font-medium hover:bg-transparent" onClick={() => handleSort("name")}>
                거래처명<SortIcon field="name" />
              </Button>
            </TableHead>
            <TableHead>담당자</TableHead>
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
            <TableHead>
              <Button variant="ghost" size="sm" className="h-auto p-0 font-medium hover:bg-transparent" onClick={() => handleSort("channel")}>
                채널<SortIcon field="channel" />
              </Button>
            </TableHead>
            <TableHead>사업자번호</TableHead>
            <TableHead>
              <Button variant="ghost" size="sm" className="h-auto p-0 font-medium hover:bg-transparent" onClick={() => handleSort("paymentTerms")}>
                결제조건<SortIcon field="paymentTerms" />
              </Button>
            </TableHead>
            <TableHead>메모</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="h-24 text-center text-slate-500">
                등록된 거래처가 없습니다.
              </TableCell>
            </TableRow>
          ) : (
            sortedCustomers.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((customer) => (
              <TableRow key={customer.id}>
                <TableCell className="font-mono text-sm text-slate-500 whitespace-nowrap">{customer.code || "-"}</TableCell>
                <TableCell className="font-medium whitespace-nowrap">{customer.name}</TableCell>
                <TableCell className="text-sm whitespace-nowrap">{customer.contactName || "-"}</TableCell>
                <TableCell className="font-mono text-sm whitespace-nowrap">{customer.contactPhone || "-"}</TableCell>
                <TableCell className="text-slate-500 text-sm">{customer.contactEmail || "-"}</TableCell>
                <TableCell>
                  {customer.channel ? (
                    <Badge variant={CHANNEL_VARIANT[customer.channel] ?? "outline"}>
                      {customer.channel}
                    </Badge>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-sm whitespace-nowrap">{customer.businessNumber || "-"}</TableCell>
                <TableCell className="text-sm whitespace-nowrap">{customer.paymentTerms || "-"}</TableCell>
                <TableCell className="text-slate-500 text-sm max-w-[150px] truncate">{customer.notes || "-"}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit?.(customer)}>
                        <Edit className="mr-2 h-4 w-4" />
                        수정
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => onDelete?.(customer)}
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
          <span>개 · 총 {sortedCustomers.length}개</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>이전</Button>
          <span className="px-2">{currentPage} / {Math.max(1, Math.ceil(sortedCustomers.length / pageSize))}</span>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={currentPage >= Math.ceil(sortedCustomers.length / pageSize)} onClick={() => setCurrentPage((p) => p + 1)}>다음</Button>
        </div>
      </div>
    </div>
  );
}
