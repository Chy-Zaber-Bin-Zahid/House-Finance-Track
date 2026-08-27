/** The shapes the server sends. One definition, shared by every screen. */

export type EntryStatus = "paid" | "upcoming";
export type Role = "owner" | "super_admin" | "viewer";

export type Cell = { amount: number; status: EntryStatus };
export type RentCell = Cell & { tenantName: string | null };

export type BillType = { id: number; name: string; active: boolean };
export type Unit = { id: number; label: string; floor: string };
export type Tenant = { id: number; name: string; phone: string; notes: string };

export type MonthRow = {
  month: number;
  bills: Record<number, Cell>;
  rent: Record<number, RentCell>;
};

export type Sheet = {
  year: number;
  billTypes: BillType[];
  units: Unit[];
  months: MonthRow[];
  handovers: { unitId: number; tenancies: { tenantName: string }[] }[];
};

export type Totals = { rent: number; bills: number; kept: number };

export type SheetResponse = {
  sheet: Sheet;
  totals: Totals;
  years: number[];
  /** Decided by the server's clock, not the browser's. */
  currentYear: number;
};

export type MonthRef = { year: number; month: number };

export type Tenancy = {
  id: number;
  unitId: number;
  unitLabel: string;
  tenantId: number;
  tenantName: string;
  expectedRent: number;
  start: MonthRef;
  end: MonthRef | null;
};

export type StoredDocument = {
  id: number;
  tenantId: number;
  kind: "photo" | "document";
  name: string;
  contentType: string;
  size: number;
  createdAt: string;
};

/** A refusal the server meant, as opposed to a connection that failed. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly reason?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers:
        init?.body instanceof FormData
          ? init.headers
          : { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, "Could not reach the server. Check your connection.");
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string; reason?: string };
    throw new ApiError(response.status, body.error ?? "Something went wrong.", body.reason);
  }

  return (await response.json()) as T;
}
