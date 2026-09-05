// @ts-nocheck
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import OnMyWayButton from "./OnMyWayButton";

vi.mock("../contexts/TenantContext", () => ({
  useTenant: () => ({ tenant: { name: "Test YardWorx" } }),
}));

vi.mock("../contexts/ToastContext", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("../lib/api", () => ({
  fetchApi: vi.fn(),
}));

vi.mock("../lib/repos", () => ({
  customersRepo: {
    getById: vi.fn().mockResolvedValue({ phone: "555-0199" }),
  },
}));

describe("OnMyWayButton component", () => {
  const mockJob = {
    id: "job-1",
    client: "John Doe",
    phone: "555-1234",
    customerId: "cust-1",
  };

  it("renders trigger button with accessibility attributes", () => {
    render(<OnMyWayButton job={mockJob} />);
    const triggerBtn = screen.getByRole("button", { name: /text the customer an arrival window/i });
    expect(triggerBtn).toBeInTheDocument();
    expect(triggerBtn).toHaveAttribute("type", "button");
  });

  it("opens modal dialog with ARIA accessibility roles and headers", () => {
    render(<OnMyWayButton job={mockJob} />);
    const triggerBtn = screen.getByRole("button", { name: /text the customer an arrival window/i });
    fireEvent.click(triggerBtn);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "on-my-way-title");

    const header = screen.getByRole("heading", { name: /on my way/i });
    expect(header).toHaveAttribute("id", "on-my-way-title");
  });

  it("handles ETA button selection with aria-pressed attribute", () => {
    render(<OnMyWayButton job={mockJob} />);
    fireEvent.click(screen.getByRole("button", { name: /text the customer an arrival window/i }));

    const eta30 = screen.getByRole("button", { name: "30 minutes" });
    const eta15 = screen.getByRole("button", { name: "15 minutes" });

    expect(eta30).toHaveAttribute("aria-pressed", "true");
    expect(eta15).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(eta15);

    expect(eta30).toHaveAttribute("aria-pressed", "false");
    expect(eta15).toHaveAttribute("aria-pressed", "true");
  });

  it("closes modal on Escape key press", async () => {
    render(<OnMyWayButton job={mockJob} />);
    fireEvent.click(screen.getByRole("button", { name: /text the customer an arrival window/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("closes modal on Close button click", async () => {
    render(<OnMyWayButton job={mockJob} />);
    fireEvent.click(screen.getByRole("button", { name: /text the customer an arrival window/i }));

    const closeBtn = screen.getByRole("button", { name: "Close modal" });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
