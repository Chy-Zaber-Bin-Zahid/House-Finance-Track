export type Status = "Paid" | "Upcoming";

export type Entry = {
  amount: number;
  status: Status;
};

export type DocumentFile = {
  id: string;
  name: string;
  /** Human-readable size + kind, e.g. "PDF · 1.8 MB". */
  meta: string;
  image: boolean;
  added: string;
  /** Present only when the file's bytes were small enough to keep. */
  dataUrl?: string;
};

export type Unit = {
  key: string;
  label: string;
  floor: string;
  name: string;
  phone: string;
  /** The rent you expect each month; drives the placeholder on the month screen. */
  expected: number;
  notes: string;
  docs: DocumentFile[];
  /** Twelve entries, January first. */
  rent: Entry[];
};

export type HouseState = {
  /** Twelve rows of three bills — water, gas, current — January first. */
  bills: Entry[][];
  units: Unit[];
};

export type BillKind = "water" | "gas" | "current";
