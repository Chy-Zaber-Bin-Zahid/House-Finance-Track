import { YearScreen } from "@/components/year-screen";
import { HOUSE_CONFIG } from "@/lib/config";

export const metadata = {
  title: `Bills and rent, ${HOUSE_CONFIG.yearLabel}`,
};

export default function YearPage() {
  return <YearScreen />;
}
