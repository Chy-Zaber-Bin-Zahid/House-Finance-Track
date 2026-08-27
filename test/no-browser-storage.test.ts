import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The whole point of the rebuild is that the sheet no longer lives in one
 * browser. A stray localStorage write would quietly recreate the problem for
 * whichever screen kept it, so this asserts the absence rather than trusting it.
 */
const sources = [
  ...globSync("components/**/*.{ts,tsx}"),
  ...globSync("app/**/*.{ts,tsx}"),
  ...globSync("lib/**/*.{ts,tsx}"),
].filter((f) => !f.endsWith(".test.ts") && !f.endsWith(".test.tsx"));

describe("nothing persists to the browser any more", () => {
  it("has sources to check", () => {
    expect(sources.length).toBeGreaterThan(10);
  });

  it("writes to no browser storage", () => {
    const offenders = sources.filter((file) =>
      /\b(localStorage|sessionStorage|indexedDB)\b/.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("no longer ships the client-side store", () => {
    expect(globSync("components/house-store.tsx")).toEqual([]);
    expect(globSync("components/storage-notice.tsx")).toEqual([]);
  });
});
