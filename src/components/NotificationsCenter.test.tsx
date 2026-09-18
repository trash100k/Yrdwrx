import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { NotificationsCenter } from "./NotificationsCenter";

vi.mock("../lib/repos", () => ({
  invoicesRepo: { list: async () => [] },
  inventoryRepo: { list: async () => [] },
  leadsRepo: { list: async () => [] },
  jobsRepo: { list: async () => [] },
}));

describe("NotificationsCenter accessibility and interaction", () => {
  it("renders with role='dialog' and aria-label='Notifications panel' when open", async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <NotificationsCenter isOpen={true} onClose={() => {}} />
        </MemoryRouter>
      );
    });

    const dialog = screen.getByRole("dialog", { name: "Notifications panel" });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");

    const closeBtn = screen.getByRole("button", { name: "Close notifications" });
    expect(closeBtn).toBeInTheDocument();
  });

  it("calls onClose when pressing Escape", async () => {
    const handleClose = vi.fn();
    await act(async () => {
      render(
        <MemoryRouter>
          <NotificationsCenter isOpen={true} onClose={handleClose} />
        </MemoryRouter>
      );
    });

    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
