import { getSuppliers } from "@/server/actions/suppliers";
import { SuppliersClient } from "@/components/features/suppliers/suppliers-client";

export default async function SuppliersPage() {
  const { suppliers } = await getSuppliers({});
  return <SuppliersClient initialSuppliers={suppliers} />;
}
