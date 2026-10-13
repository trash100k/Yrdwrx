import { describe, it, expect, beforeAll } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { StockDepletionChart } from "./StockDepletionChart";

beforeAll(() => {
  if (!(global as any).ResizeObserver) {
    (global as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

describe("StockDepletionChart", () => {
  it("renders with role='region' and aria-label='Stock depletion chart'", () => {
    render(<StockDepletionChart />);
    const region = screen.getByRole("region", { name: "Stock depletion chart" });
    expect(region).toBeInTheDocument();
  });
});
