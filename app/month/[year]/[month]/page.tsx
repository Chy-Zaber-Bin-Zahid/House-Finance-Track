import { notFound } from "next/navigation";
import { MonthScreen } from "@/components/month-screen";
import { MONTH_NAMES } from "@/lib/seed";

type PageProps = { params: Promise<{ year: string; month: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { year, month } = await params;
  const index = Number(month) - 1;
  return { title: MONTH_NAMES[index] ? `${MONTH_NAMES[index]} ${year}` : "Month" };
}

export default async function MonthPage({ params }: PageProps) {
  const { year: rawYear, month: rawMonth } = await params;
  const year = Number(rawYear);
  const month = Number(rawMonth);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) notFound();
  return <MonthScreen year={year} month={month} />;
}
