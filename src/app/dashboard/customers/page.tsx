import { getCustomers } from "@/server/actions/customers";
import { CustomersClient } from "@/components/features/customers/customers-client";

export default async function CustomersPage() {
  const { customers } = await getCustomers({});
  return <CustomersClient initialCustomers={customers} />;
}
