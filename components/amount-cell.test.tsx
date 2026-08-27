import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AmountCell } from "@/components/amount-cell";

/**
 * Exercises the jsdom project. A cell's marker is the only thing telling the
 * reader whether money arrived, so it is worth asserting rather than eyeballing.
 */
describe("AmountCell", () => {
  it("shows the amount and names its status for a screen reader", () => {
    render(<AmountCell entry={{ amount: 5_500, status: "Paid" }} currency="৳" />);
    expect(screen.getByText("৳5,500")).toBeDefined();
    expect(screen.getByText("Paid")).toBeDefined();
  });

  it("writes a zero bare and still names the status", () => {
    render(<AmountCell entry={{ amount: 0, status: "Upcoming" }} currency="৳" />);
    expect(screen.getByText("0")).toBeDefined();
    expect(screen.getByText("Upcoming")).toBeDefined();
  });
});
