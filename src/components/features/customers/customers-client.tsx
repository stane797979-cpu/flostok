"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Loader2, Download, FileDown } from "lucide-react";
import { CustomerTable } from "@/components/features/customers/customer-table";
import { CustomerFormDialog } from "@/components/features/customers/customer-form-dialog";
import { getCustomers, deleteCustomer, exportCustomersExcel, downloadCustomerTemplate } from "@/server/actions/customers";
import { type Customer } from "@/server/db/schema";
import { useToast } from "@/hooks/use-toast";

interface CustomersClientProps {
  initialCustomers: Customer[];
}

export function CustomersClient({ initialCustomers }: CustomersClientProps) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [excelLoading, setExcelLoading] = useState(false);

  const fetchCustomers = useCallback(async (searchTerm?: string) => {
    try {
      setIsLoading(true);
      const result = await getCustomers({ search: searchTerm || undefined });
      setCustomers(result.customers);
    } catch {
      toast({ title: "오류", description: "거래처 목록을 불러오는데 실패했습니다.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    fetchCustomers(value || undefined);
  };

  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingCustomer(null);
      fetchCustomers(search || undefined);
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsDialogOpen(true);
  };

  const triggerDownload = (data: number[], filename: string) => {
    const buf = new Uint8Array(data);
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = async () => {
    setExcelLoading(true);
    try {
      const result = await exportCustomersExcel();
      triggerDownload(result.data, result.filename);
      toast({ title: "다운로드 완료", description: `${customers.length}개 거래처 데이터를 내보냈습니다.` });
    } catch {
      toast({ title: "오류", description: "엑셀 다운로드에 실패했습니다.", variant: "destructive" });
    } finally {
      setExcelLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    setExcelLoading(true);
    try {
      const result = await downloadCustomerTemplate();
      triggerDownload(result.data, result.filename);
    } catch {
      toast({ title: "오류", description: "템플릿 다운로드에 실패했습니다.", variant: "destructive" });
    } finally {
      setExcelLoading(false);
    }
  };

  const handleDelete = async (customer: Customer) => {
    if (!confirm(`"${customer.name}" 거래처를 삭제하시겠습니까?`)) return;

    const result = await deleteCustomer(customer.id);
    if (result.success) {
      toast({ title: "삭제 완료", description: `${customer.name}이(가) 삭제되었습니다.` });
      fetchCustomers(search || undefined);
    } else {
      toast({ title: "삭제 실패", description: result.error, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">거래처</h1>
        <p className="mt-2 text-slate-500">거래처(판매처) 정보 관리</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="거래처명, 거래처코드 검색..."
            className="pl-9"
            value={search}
            onChange={handleSearchChange}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleDownloadTemplate} disabled={excelLoading}>
            <FileDown className="mr-1.5 h-4 w-4" />
            양식 다운로드
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportExcel} disabled={excelLoading || customers.length === 0}>
            {excelLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
            엑셀 다운로드
          </Button>
          <Button size="sm" onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            거래처 추가
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <CustomerTable customers={customers} onEdit={handleEdit} onDelete={handleDelete} />
      )}

      <CustomerFormDialog
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        customer={editingCustomer}
      />
    </div>
  );
}
