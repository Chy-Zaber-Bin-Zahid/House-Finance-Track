import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AmountCell } from "@/components/amount-cell";

describe("AmountCell", () => {
  it("shows the amount and names its status for a screen reader", () => {
    render(<AmountCell cell={{ amount: 5_500, status: "paid" }} currency="৳" />);
    expect(screen.getByText("৳5,500")).toBeDefined();
    expect(screen.getByText("Paid")).toBeDefined();
  });

  it("writes a zero bare and still names the status", () => {
    render(<AmountCell cell={{ amount: 0, status: "upcoming" }} currency="৳" />);
    expect(screen.getByText("0")).toBeDefined();
    expect(screen.getByText("Upcoming")).toBeDefined();
  });
});
