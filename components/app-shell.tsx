"use client";

import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/site-header";

/**
 * Signed-out pages get the window to themselves.
 *
 * One place decides this. The header used to hide itself while the layout went
 * on wrapping every page in the same padded column, so a full-bleed sign-in had
 * no way to reach the edge of the screen without fighting its own container.
 */
const BARE_ROUTES = ["/sign-in", "/register"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (BARE_ROUTES.some((route) => pathname.startsWith(route))) return <>{children}</>;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1340px] px-[30px] pt-[30px] pb-16">{children}</main>
    </>
  );
}
