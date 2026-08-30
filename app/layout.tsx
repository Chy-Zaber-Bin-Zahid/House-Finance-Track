import type { Metadata } from "next";
import { Figtree, Montserrat } from "next/font/google";
import { QueryProvider } from "@/components/query-provider";
import { AppShell } from "@/components/app-shell";
import { HOUSE_CONFIG } from "@/lib/config";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-figtree",
  display: "swap",
});

/* The wordmark only. The logo sets "HOUSE" in a geometric sans with open
 * counters and wide tracking; Figtree is warmer and narrower, so the two set
 * side by side read as two different names rather than one. */
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-wordmark",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `Bills and rent · ${HOUSE_CONFIG.houseName}`,
    template: `%s · ${HOUSE_CONFIG.houseName}`,
  },
  description: "Rent collected and bills paid, one sheet, kept year after year.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${figtree.variable} ${montserrat.variable}`}>
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        <QueryProvider>
          <AppShell>{children}</AppShell>
        </QueryProvider>
      </body>
    </html>
  );
}
