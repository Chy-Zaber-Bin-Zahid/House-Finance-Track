import { notFound } from "next/navigation";
import { TenantScreen } from "@/components/tenant-screen";

export const metadata = { title: "Tenant" };

type PageProps = { params: Promise<{ key: string }> };

export default async function TenantPage({ params }: PageProps) {
  const id = Number((await params).key);
  if (!Number.isInteger(id)) notFound();
  return <TenantScreen tenantId={id} />;
}
