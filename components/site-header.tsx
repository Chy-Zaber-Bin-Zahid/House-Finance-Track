"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMe } from "@/components/hooks";
import { PaidTickIcon } from "@/components/icons";
import { LogoMark } from "@/components/logo";
import { UpcomingDot } from "@/components/ui";
import { cn } from "@/lib/cn";
import { HOUSE_CONFIG } from "@/lib/config";
import { api } from "@/lib/api";

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { data } = useMe();
  const actor = data?.actor ?? null;

  const links = [
    { href: "/", label: "The year", active: pathname === "/" },
    /* No link to a month: a month is reached by picking one out of the year's
     * sheet, so the one you land on is always the one you pointed at. */
    { href: "/units", label: "Units", active: pathname.startsWith("/units") },
    { href: "/tenants", label: "Tenants", active: pathname.startsWith("/tenants") },
    ...(actor?.role === "owner"
      ? [
          { href: "/accounts", label: "Accounts", active: pathname.startsWith("/accounts") },
          { href: "/audit", label: "Audit log", active: pathname.startsWith("/audit") },
        ]
      : []),
  ];

  async function signOut() {
    await api("/api/auth/sign-out", { method: "POST" }).catch(() => {});
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-line-7 bg-white/90 backdrop-blur-[10px]">
      {/*
        On a phone this wraps to two rows — the house and the account on the
        first, the sections on the second — because a single row of five
        sections cannot fit and pushed the whole page sideways when it tried.
      */}
      <div className="mx-auto flex max-w-[1340px] flex-wrap items-center gap-x-7 gap-y-1 px-4 py-2.5 sm:h-[62px] sm:flex-nowrap sm:px-[30px] sm:py-0">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <LogoMark className="size-8" />
          <span className="font-wordmark text-[15px] font-bold tracking-[0.1em] whitespace-nowrap text-logo uppercase">
            {HOUSE_CONFIG.houseName}
          </span>
        </Link>

        {/*
          Its own row on a phone, and scrollable there rather than truncated:
          the last section stays reachable instead of disappearing off the edge.
          `-mx-4 px-4` lets it scroll edge to edge without losing its inset.
        */}
        <nav className="order-last -mx-4 flex gap-[3px] overflow-x-auto px-4 [scrollbar-width:none] sm:order-none sm:mx-0 sm:overflow-x-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={link.active ? "page" : undefined}
              className={cn(
                "rounded-nav px-[13px] py-[7px] text-sm font-medium whitespace-nowrap transition-colors",
                link.active ? "bg-nav-active text-ink" : "text-muted hover:text-ink",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-[18px]">
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
