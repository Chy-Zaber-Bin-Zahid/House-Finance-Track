import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { HouseProvider } from "@/components/house-store";
import { SiteHeader } from "@/components/site-header";
import { StorageNotice } from "@/components/storage-notice";
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
  description: `Rent collected and bills paid across ${HOUSE_CONFIG.yearLabel}, one sheet.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={figtree.variable}>
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        <HouseProvider>
          <SiteHeader />
          <main className="mx-auto max-w-[1340px] px-[30px] pt-[30px] pb-16">
            <StorageNotice />
            {children}
          </main>
        </HouseProvider>
      </body>
    </html>
  );
}
