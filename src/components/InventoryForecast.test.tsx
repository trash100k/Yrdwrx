// @ts-nocheck
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";
import InventoryForecast from "./InventoryForecast";

// Mock jobsRepo to return empty array cleanly
vi.mock("../lib/repos", () => ({
  jobsRepo: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

describe("InventoryForecast component", () => {
  const sampleItems = [
    { id: "item-1", name: "Mulch", quantity: 100, category: "BAG" },
    { id: "item-2", name: "Trimmer Line", quantity: 5, category: "SPOOL" },
  ];

  it("renders with region role, header, and close button", async () => {
    const handleClose = vi.fn();
    render(<InventoryForecast items={sampleItems} onClose={handleClose} />);

    const region = screen.getByRole("region", { name: "AI Stock Forecast" });
    expect(region).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: "Close inventory forecast" });
    expect(closeBtn).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Mulch")).toBeInTheDocument();
      expect(screen.getByText("Trimmer Line")).toBeInTheDocument();
    });

    const progressbars = screen.getAllByRole("progressbar");
    expect(progressbars.length).toBe(2);
    expect(progressbars[0]).toHaveAttribute("aria-valuenow");
  });

  it("calls onClose when close button is clicked", async () => {
    const handleClose = vi.fn();
    render(<InventoryForecast items={sampleItems} onClose={handleClose} />);

    await waitFor(() => {
      expect(screen.getByText("Mulch")).toBeInTheDocument();
    });

    const closeBtn = screen.getByRole("button", { name: "Close inventory forecast" });
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape key is pressed", async () => {
    const handleClose = vi.fn();
    render(<InventoryForecast items={sampleItems} onClose={handleClose} />);

    await waitFor(() => {
      expect(screen.getByText("Mulch")).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: "Escape" });

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
