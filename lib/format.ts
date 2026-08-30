import { HOUSE_CONFIG } from "@/lib/config";

/** Zero reads as a bare "0" — the sheet has a lot of them. */
export function formatAmount(n: number, currency: string = HOUSE_CONFIG.currency): string {
  if (n === 0) return "0";
  /* The minus sign goes in front of the currency, not between it and the
   * digits: a month whose bills beat its rent reads "-৳1,380", never
   * "৳-1,380". */
  return (n < 0 ? "-" : "") + currency + Math.abs(n).toLocaleString("en-US");
}

/** Accepts anything a person might type into a money field. */
export function parseAmount(value: string | number): number {
  const n = parseInt(String(value).replace(/[^0-9-]/g, ""), 10);
  return Number.isNaN(n) ? 0 : n;
}

export function initialsOf(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length > 1) return parts[0][0] + parts[parts.length - 1][0];
  return (parts[0] ?? "—").slice(0, 2);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileKind(type: string, name: string): string {
  if (type === "application/pdf") return "PDF";
  const ext = name.split(".").pop();
  return (ext ?? "FILE").toUpperCase();
}

export function countLabel(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
