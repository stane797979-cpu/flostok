import { OutboundClient } from "./_components/outbound-client";

export default async function OutboundPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const resolvedTab = tab === "upload" ? "upload" : tab === "transfer" ? "transfer" : "records";

  return <OutboundClient key={resolvedTab} initialTab={resolvedTab} />;
}
