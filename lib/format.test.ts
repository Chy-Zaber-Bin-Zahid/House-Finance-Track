import { describe, expect, it } from "vitest";
import { countLabel, fileKind, formatAmount, formatBytes, initialsOf, parseAmount } from "@/lib/format";

describe("formatAmount", () => {
  it("writes zero bare and everything else with the currency", () => {
    expect(formatAmount(0)).toBe("0");
    expect(formatAmount(1_080)).toBe("৳1,080");
    expect(formatAmount(115_100)).toBe("৳115,100");
  });

  it("keeps the minus in front of the currency when a month costs more than it earns", () => {
    expect(formatAmount(-1_380)).toBe("-৳1,380");
    expect(formatAmount(-500, "$")).toBe("-$500");
  });

  it("honours a currency the caller supplies", () => {
    expect(formatAmount(500, "$")).toBe("$500");
    expect(formatAmount(0, "$")).toBe("0");
  });
});

describe("parseAmount", () => {
  it("reads a number out of whatever a person types", () => {
    expect(parseAmount("6000")).toBe(6_000);
    expect(parseAmount("৳6,000")).toBe(6_000);
    expect(parseAmount("")).toBe(0);
    expect(parseAmount("not a number")).toBe(0);
  });
});

describe("initialsOf", () => {
  it("takes first and last initials from a full name", () => {
    expect(initialsOf("Anwar Hossain")).toBe("AH");
    expect(initialsOf("Rehana Chowdhury")).toBe("RC");
  });

  it("falls back for a single name or none", () => {
    expect(initialsOf("Kamal")).toBe("Ka");
    expect(initialsOf("")).toBe("—");
  });
});

describe("file helpers", () => {
  it("scales bytes to a readable unit", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2_048)).toBe("2 KB");
    expect(formatBytes(1_500_000)).toBe("1.4 MB");
  });

  it("names a file's kind from its type or extension", () => {
    expect(fileKind("application/pdf", "lease.pdf")).toBe("PDF");
    expect(fileKind("image/jpeg", "id.jpg")).toBe("JPG");
  });

  it("pluralises a count", () => {
    expect(countLabel(1, "unit", "units")).toBe("1 unit");
    expect(countLabel(3, "file", "files")).toBe("3 files");
  });
});
