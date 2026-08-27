/**
 * The knobs the design exposed as editable props. They are read-only app
 * configuration here — one place to change the currency, the house, the year.
 */
export const HOUSE_CONFIG = {
  currency: "৳",
  houseName: "My house",
  yearLabel: "2026",
} as const;

export type HouseConfig = typeof HOUSE_CONFIG;
