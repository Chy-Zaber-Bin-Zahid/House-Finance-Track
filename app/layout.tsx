import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { QueryProvider } from "@/components/query-provider";
import { SiteHeader } from "@/components/site-header";
import { HOUSE_CONFIG } from "@/lib/config";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-figtree",
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
    <html lang="en" className={figtree.variable}>
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        <QueryProvider>
          <SiteHeader />
          <main className="mx-auto max-w-[1340px] px-[30px] pt-[30px] pb-16">{children}</main>
        </QueryProvider>
      </body>
    </html>
  );
}
