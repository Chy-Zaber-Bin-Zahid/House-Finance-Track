import { describe, expect, it } from "vitest";
import { assertTestBucket, assertTestDatabase } from "./guards";

describe("assertTestDatabase", () => {
  it("accepts a database whose name marks it as a test database", () => {
    expect(() => assertTestDatabase("postgres://u:p@localhost:5432/house_test")).not.toThrow();
    expect(() => assertTestDatabase("postgres://u:p@localhost:5432/test_house")).not.toThrow();
  });

  it("refuses a database whose name does not mark it as a test database", () => {
    expect(() => assertTestDatabase("postgres://u:p@localhost:5432/house")).toThrow(
      /does not mark it as a test database/,
    );
  });

  it("refuses a production-looking name that merely contains the letters", () => {
    expect(() => assertTestDatabase("postgres://u:p@localhost:5432/greatest")).toThrow(
      /does not mark it as a test database/,
    );
  });

  it("refuses when nothing is configured", () => {
    expect(() => assertTestDatabase(undefined)).toThrow(/DATABASE_URL is not set/);
  });

  it("refuses a value that is not a URL", () => {
    expect(() => assertTestDatabase("house_test")).toThrow(/not a valid URL/);
  });
});

describe("assertTestBucket", () => {
  it("accepts a bucket whose name marks it as a test bucket", () => {
    expect(() => assertTestBucket("house-test")).not.toThrow();
  });

  it("refuses the production bucket", () => {
    expect(() => assertTestBucket("house-files")).toThrow(/does not mark it as a test bucket/);
  });

  it("refuses when nothing is configured", () => {
    expect(() => assertTestBucket(undefined)).toThrow(/R2_BUCKET is not set/);
  });
});
