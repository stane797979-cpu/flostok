import { getWarehouses } from "@/server/actions/warehouses";
import { WarehousesPageClient } from "./_components/warehouses-page-client";

export default async function WarehousesPage() {
  try {
    const { warehouses } = await getWarehouses();

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">창고 관리</h1>
          <p className="mt-2 text-slate-500">
            창고 추가, 수정, 삭제 및 재고 이동
          </p>
        </div>
        <WarehousesPageClient warehouses={warehouses} />
      </div>
    );
  } catch (error) {
    console.error("창고 목록 로드 실패:", error);
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">창고 관리</h1>
          <p className="mt-2 text-slate-500">
            창고 추가, 수정, 삭제 및 재고 이동
          </p>
        </div>
        <WarehousesPageClient warehouses={[]} />
      </div>
    );
  }
}
