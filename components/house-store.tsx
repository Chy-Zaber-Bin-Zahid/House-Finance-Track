"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { HOUSE_CONFIG, type HouseConfig } from "@/lib/config";
import { parseAmount } from "@/lib/format";
import { createInitialState, emptyRentYear } from "@/lib/seed";
import type { DocumentFile, HouseState, Status, Unit } from "@/lib/types";

const STORAGE_KEY = "bills-and-rent:v2";

type Persisted = { state: HouseState; lastMonth: number };

export type UnitDraft = {
  label: string;
  floor: string;
  rent: string;
  name: string;
};

type Action =
  | { type: "replace"; payload: HouseState }
  | { type: "setBillAmount"; month: number; bill: number; amount: number }
  | { type: "setBillStatus"; month: number; bill: number; status: Status }
  | { type: "setRentAmount"; month: number; unitKey: string; amount: number }
  | { type: "setRentStatus"; month: number; unitKey: string; status: Status }
  | { type: "addUnit"; draft: UnitDraft }
  | { type: "patchUnit"; unitKey: string; patch: Partial<Omit<Unit, "key" | "rent" | "docs">> }
  | { type: "setMonthlyRent"; unitKey: string; amount: number }
  | { type: "addDocs"; unitKey: string; docs: DocumentFile[] }
  | { type: "removeDoc"; unitKey: string; docId: string };

function mapUnit(state: HouseState, unitKey: string, fn: (unit: Unit) => Unit): HouseState {
  return { ...state, units: state.units.map((u) => (u.key === unitKey ? fn(u) : u)) };
}

function mapEntry<T extends { amount: number; status: Status }>(
  entries: T[],
  index: number,
  patch: Partial<T>,
): T[] {
  return entries.map((e, i) => (i === index ? { ...e, ...patch } : e));
}

function reducer(state: HouseState, action: Action): HouseState {
  switch (action.type) {
    case "replace":
      return action.payload;

    case "setBillAmount":
    case "setBillStatus": {
      const patch =
        action.type === "setBillAmount"
          ? { amount: action.amount }
          : { status: action.status };
      return {
        ...state,
        bills: state.bills.map((row, i) =>
          i === action.month ? mapEntry(row, action.bill, patch) : row,
        ),
      };
    }

    case "setRentAmount":
      return mapUnit(state, action.unitKey, (u) => ({
        ...u,
        rent: mapEntry(u.rent, action.month, { amount: action.amount }),
      }));

    case "setRentStatus":
      return mapUnit(state, action.unitKey, (u) => ({
        ...u,
        rent: mapEntry(u.rent, action.month, { status: action.status }),
      }));

    case "addUnit": {
      const label = action.draft.label.trim();
      if (!label) return state;
      const unit: Unit = {
        key: `u-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${state.units.length}`,
        label,
        floor: action.draft.floor.trim() || "Not set",
        name: action.draft.name.trim() || "Empty",
        phone: "",
        expected: parseAmount(action.draft.rent),
        notes: "",
        docs: [],
        rent: emptyRentYear(),
      };
      return { ...state, units: [...state.units, unit] };
    }

    case "patchUnit":
      return mapUnit(state, action.unitKey, (u) => ({ ...u, ...action.patch }));

    /* Changing what a unit charges reprices every month it has actually collected. */
    case "setMonthlyRent":
      return mapUnit(state, action.unitKey, (u) => ({
        ...u,
        expected: action.amount,
        rent: u.rent.map((e) => (e.amount === 0 ? e : { ...e, amount: action.amount })),
      }));

    case "addDocs":
      return mapUnit(state, action.unitKey, (u) => ({ ...u, docs: [...u.docs, ...action.docs] }));

    case "removeDoc":
      return mapUnit(state, action.unitKey, (u) => ({
        ...u,
        docs: u.docs.filter((d) => d.id !== action.docId),
      }));

    default:
      return state;
  }
}

type HouseContextValue = {
  state: HouseState;
  config: HouseConfig;
  /** False until localStorage has been read, so nothing is saved over. */
  ready: boolean;
  /** Set when the browser refused to store the sheet, usually a large upload. */
  storageWarning: string | null;
  lastMonth: number;
  rememberMonth: (month: number) => void;
  dispatch: (action: Action) => void;
  reset: () => void;
};

const HouseContext = createContext<HouseContextValue | null>(null);

/** Strips file bodies — the fallback when the sheet no longer fits in storage. */
function withoutDocBodies(state: HouseState): HouseState {
  return {
    ...state,
    units: state.units.map((u) => ({
      ...u,
      docs: u.docs.map(({ dataUrl: _dataUrl, ...doc }) => doc),
    })),
  };
}

export function HouseProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, null, createInitialState);
  const [lastMonth, setLastMonth] = useState(11);
  const [ready, setReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const readyRef = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<Persisted>;
        if (saved.state?.bills && saved.state?.units) {
          dispatch({ type: "replace", payload: saved.state });
        }
        if (typeof saved.lastMonth === "number") {
          setLastMonth(Math.min(11, Math.max(0, saved.lastMonth)));
        }
      }
    } catch {
      /* A corrupt or unreadable entry just means we start from the seed. */
    }
    readyRef.current = true;
    setReady(true);
  }, []);

  useEffect(() => {
    if (!readyRef.current) return;
    const write = (payload: Persisted) =>
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    try {
      write({ state, lastMonth });
      setStorageWarning(null);
    } catch {
      try {
        write({ state: withoutDocBodies(state), lastMonth });
        setStorageWarning("Files are too large to keep on this device — only their details were saved.");
      } catch {
        setStorageWarning("This browser will not save the sheet. Changes last until you reload.");
      }
    }
  }, [state, lastMonth, ready]);

  const rememberMonth = useCallback((month: number) => {
    setLastMonth(Math.min(11, Math.max(0, month)));
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "replace", payload: createInitialState() });
    setLastMonth(11);
  }, []);

  const value = useMemo<HouseContextValue>(
    () => ({
      state,
      config: HOUSE_CONFIG,
      ready,
      storageWarning,
      lastMonth,
      rememberMonth,
      dispatch,
      reset,
    }),
    [state, ready, storageWarning, lastMonth, rememberMonth, reset],
  );

  return <HouseContext.Provider value={value}>{children}</HouseContext.Provider>;
}

export function useHouse(): HouseContextValue {
  const ctx = useContext(HouseContext);
  if (!ctx) throw new Error("useHouse must be used inside <HouseProvider>");
  return ctx;
}
