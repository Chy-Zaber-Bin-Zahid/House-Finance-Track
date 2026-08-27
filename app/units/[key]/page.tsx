import { TenantScreen } from "@/components/tenant-screen";

export const metadata = {
  title: "Tenant profile",
};

type PageProps = { params: Promise<{ key: string }> };

export default async function TenantPage({ params }: PageProps) {
  /* Units live in the browser, so the key is resolved on the client. */
  const { key } = await params;
  return <TenantScreen unitKey={key} />;
}
