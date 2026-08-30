"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMe } from "@/components/hooks";
import { CloseIcon, MenuIcon, PaidTickIcon } from "@/components/icons";
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
  const [menuOpen, setMenuOpen] = useState(false);

  /* Navigating is the end of the menu's job — otherwise it hangs over the page
   * the reader just asked for. */
  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

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
      <div className="mx-auto flex h-[58px] max-w-[1340px] items-center gap-7 px-4 sm:px-[30px] lg:h-[62px]">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <LogoMark className="size-8" />
          <span className="font-wordmark text-[15px] font-bold tracking-[0.1em] whitespace-nowrap text-logo uppercase">
            {HOUSE_CONFIG.houseName}
          </span>
        </Link>

        {/*
          Five sections, an address and a sign-out need about 840px to sit in a
          row. Below that they go behind the button rather than being squeezed
          until the last one falls off the edge.
        */}
        <nav className="hidden gap-[3px] lg:flex">
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
              <span className="hidden text-[13px] text-muted-2 lg:inline">
                {actor.email}
                {actor.role === "viewer" ? " · view only" : ""}
              </span>
              <button
                type="button"
                onClick={signOut}
                className="hidden cursor-pointer text-[13px] font-medium text-muted hover:text-ink lg:inline"
              >
                Sign out
              </button>
            </>
          ) : null}

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            aria-label={menuOpen ? "Close the menu" : "Open the menu"}
            className="-mr-2 grid size-10 cursor-pointer place-items-center rounded-nav text-ink transition-colors hover:bg-nav-active lg:hidden"
          >
            {menuOpen ? <CloseIcon className="size-[22px]" /> : <MenuIcon className="size-[22px]" />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div id="site-menu" className="border-t border-line-7 bg-canvas lg:hidden">
          <nav className="flex flex-col gap-0.5 p-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={link.active ? "page" : undefined}
                className={cn(
                  "rounded-nav px-3 py-2.5 text-[15px] font-medium transition-colors",
                  link.active ? "bg-nav-active text-ink" : "text-muted hover:text-ink",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          {actor ? (
            <div className="flex items-center justify-between gap-4 border-t border-line-7 px-5 py-3.5">
              <span className="truncate text-[13px] text-muted-2">
                {actor.email}
                {actor.role === "viewer" ? " · view only" : ""}
              </span>
              <button
                type="button"
                onClick={signOut}
                className="shrink-0 cursor-pointer text-[13px] font-medium text-muted hover:text-ink"
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
