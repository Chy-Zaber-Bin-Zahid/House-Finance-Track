import type { BillKind, DocumentFile, Entry, HouseState, Unit } from "@/lib/types";

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const BILL_KINDS: { key: BillKind; label: string }[] = [
  { key: "water", label: "Water" },
  { key: "gas", label: "Gas" },
  { key: "current", label: "Current" },
];

const paid = (amount: number): Entry => ({ amount, status: "Paid" });
const upcoming = (amount: number): Entry => ({ amount, status: "Upcoming" });

/** The owner's sheet, verbatim: [water, gas, current] per month. */
const BILL_SEED: [number, number, number][] = [
  [0, 1080, 0],
  [0, 1080, 0],
  [0, 1080, 0],
  [0, 1080, 0],
  [0, 1080, 0],
  [0, 1080, 0],
  [0, 1080, 0],
  [384, 1080, 4897],
  [384, 1080, 4351],
  [369, 1080, 3818],
  [381, 1080, 3632],
  [369, 1080, 2565],
];

const DOC_CATALOG: Omit<DocumentFile, "id" | "added">[] = [
  { name: "Rent agreement", meta: "PDF · 1.8 MB", image: false },
  { name: "Photo ID", meta: "JPG · 620 KB", image: true },
  { name: "Meter reading photo", meta: "JPG · 480 KB", image: true },
  { name: "Advance receipt", meta: "PDF · 210 KB", image: false },
];

function seedDocs(unitKey: string, count: number, since: string): DocumentFile[] {
  return DOC_CATALOG.slice(0, count).map((doc, i) => ({
    ...doc,
    id: `${unitKey}-doc-${i}`,
    added: since,
  }));
}

const UNIT_SEED: (Omit<Unit, "docs" | "notes" | "rent"> & {
  docCount: number;
  since: string;
  rent: [number, boolean][];
})[] = [
  {
    key: "f1b",
    label: "F1(B)",
    floor: "First floor, back",
    name: "Anwar Hossain",
    phone: "01711 204 866",
    expected: 6000,
    docCount: 3,
    since: "Jul",
    rent: [
      [0, true],
      [0, true],
      [0, true],
      [0, true],
      [0, true],
      [0, true],
      [5500, true],
      [5500, true],
      [5500, true],
      [5500, true],
      [6500, true],
      [6000, true],
    ],
  },
  {
    key: "f1f",
    label: "F1(F)",
    floor: "First floor, front",
    name: "Rehana Chowdhury",
    phone: "01812 553 190",
    expected: 6000,
    docCount: 2,
    since: "Sep",
    rent: [
      [0, false],
      [0, false],
      [0, false],
      [0, false],
      [0, false],
      [0, false],
      [0, false],
      [0, false],
      [2600, true],
      [6000, true],
      [6000, true],
      [0, false],
    ],
  },
  {
    key: "b1",
    label: "B1",
    floor: "Ground floor",
    name: "Kamal Uddin",
    phone: "01919 471 305",
    expected: 11000,
    docCount: 4,
    since: "Jul",
    rent: [
      [0, true],
      [0, true],
      [0, true],
      [0, true],
      [0, true],
      [0, true],
      [11000, true],
      [11000, true],
      [11000, true],
      [11000, true],
      [11000, true],
      [11000, true],
    ],
  },
];

export function createInitialState(): HouseState {
  return {
    bills: BILL_SEED.map((row) => row.map(paid)),
    units: UNIT_SEED.map(({ docCount, since, rent, ...unit }) => ({
      ...unit,
      notes: "",
      docs: seedDocs(unit.key, docCount, since),
      rent: rent.map(([amount, isPaid]) => (isPaid ? paid(amount) : upcoming(amount))),
    })),
  };
}

export function emptyRentYear(): Entry[] {
  return MONTH_NAMES.map(() => upcoming(0));
}
