"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMe } from "@/components/hooks";
import { HouseIcon, PaidTickIcon } from "@/components/icons";
import { UpcomingDot } from "@/components/ui";
import { cn } from "@/lib/cn";
import { HOUSE_CONFIG } from "@/lib/config";
import { api } from "@/lib/api";

const HIDDEN_ON = ["/sign-in", "/register"];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { data } = useMe();
  const actor = data?.actor ?? null;

  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  const links = [
    { href: "/", label: "The year", active: pathname === "/" },
    { href: "/month", label: "One month", active: pathname.startsWith("/month") },
    { href: "/units", label: "Units & tenants", active: pathname.startsWith("/units") },
    ...(actor?.role === "owner"
      ? [{ href: "/accounts", label: "Accounts", active: pathname.startsWith("/accounts") }]
      : []),
  ];

  async function signOut() {
    await api("/api/auth/sign-out", { method: "POST" }).catch(() => {});
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-line-7 bg-white/90 backdrop-blur-[10px]">
      <div className="mx-auto flex h-[62px] max-w-[1340px] items-center gap-7 px-[30px]">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-nav bg-ink text-white">
            <HouseIcon className="size-[15px]" />
          </span>
          <span className="text-base font-semibold tracking-[-0.01em]">{HOUSE_CONFIG.houseName}</span>
        </Link>

        <nav className="flex gap-[3px]">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={link.active ? "page" : undefined}
              className={cn(
                "rounded-nav px-[13px] py-[7px] text-sm font-medium transition-colors",
                link.active ? "bg-nav-active text-ink" : "text-muted hover:text-ink",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-[18px]">
          <div className="hidden items-center gap-3.5 text-[12.5px] text-muted lg:flex">
            <span className="flex items-center gap-1.5">
              <PaidTickIcon />
              Paid
            </span>
            <span className="flex items-center gap-1.5">
              <UpcomingDot />
              Upcoming
            </span>
          </div>
          {actor ? (
            <>
              <span className="hidden text-[13px] text-muted-2 sm:inline">
                {actor.email}
                {actor.role === "viewer" ? " · view only" : ""}
              </span>
              <button
                type="button"
                onClick={signOut}
                className="cursor-pointer text-[13px] font-medium text-muted hover:text-ink"
              >
                Sign out
              </button>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
