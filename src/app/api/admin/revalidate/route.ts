import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== "Bearer flostok-revalidate-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = "00000000-0000-0000-0000-000000000000";

  revalidateTag(`inventory-${orgId}`);
  revalidateTag(`kpi-${orgId}`);
  revalidateTag(`analytics-${orgId}`);
  revalidateTag(`psi-${orgId}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/psi");
  revalidatePath("/dashboard/analytics");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/outbound");

  return NextResponse.json({ success: true, message: "캐시 초기화 완료", orgId });
}
