import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MonthScreen } from "@/components/month-screen";
import { HOUSE_CONFIG } from "@/lib/config";
import { MONTH_NAMES } from "@/lib/seed";

type PageProps = { params: Promise<{ month: string }> };

/** Months are 1–12 in the URL and 0-based everywhere inside. */
function parseMonth(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n - 1 : null;
}

export function generateStaticParams() {
  return MONTH_NAMES.map((_, i) => ({ month: String(i + 1) }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const month = parseMonth((await params).month);
  return { title: month === null ? "Month" : `${MONTH_NAMES[month]} ${HOUSE_CONFIG.yearLabel}` };
}

export default async function MonthPage({ params }: PageProps) {
  const month = parseMonth((await params).month);
  if (month === null) notFound();
  return <MonthScreen month={month} />;
}
