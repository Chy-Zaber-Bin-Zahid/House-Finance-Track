import { redirect } from "next/navigation";

/** "One month" in the nav lands on the current one. */
export default function MonthIndex() {
  const now = new Date();
  redirect(`/month/${now.getFullYear()}/${now.getMonth() + 1}`);
}
