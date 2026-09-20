import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("renders with correct ARIA attributes when open", () => {
    render(
      <ConfirmDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Delete Item"
        description="Are you sure you want to delete this item?"
      />
    );

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");

    const titleId = dialog.getAttribute("aria-labelledby");
    const descriptionId = dialog.getAttribute("aria-describedby");

    expect(titleId).toBeTruthy();
    expect(descriptionId).toBeTruthy();

    expect(screen.getByText("Delete Item")).toHaveAttribute("id", titleId!);
    expect(screen.getByText("Are you sure you want to delete this item?")).toHaveAttribute("id", descriptionId!);
  });

  it("does not render when isOpen is false", () => {
    render(
      <ConfirmDialog
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Delete Item"
        description="Are you sure?"
      />
    );

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("triggers onClose when Escape key is pressed", () => {
    const handleClose = vi.fn();
    render(
      <ConfirmDialog
        isOpen={true}
        onClose={handleClose}
        onConfirm={vi.fn()}
        title="Confirm Action"
        description="Do you want to proceed?"
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("triggers onConfirm and onClose when confirm button is clicked", () => {
    const handleConfirm = vi.fn();
    const handleClose = vi.fn();

    render(
      <ConfirmDialog
        isOpen={true}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title="Confirm Action"
        description="Do you want to proceed?"
        confirmText="Yes, delete"
        cancelText="No, cancel"
      />
    );

    fireEvent.click(screen.getByText("Yes, delete"));
    expect(handleConfirm).toHaveBeenCalledTimes(1);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("triggers onClose when cancel button is clicked", () => {
    const handleClose = vi.fn();

    render(
      <ConfirmDialog
        isOpen={true}
        onClose={handleClose}
        onConfirm={vi.fn()}
        title="Confirm Action"
        description="Do you want to proceed?"
        confirmText="Yes, delete"
        cancelText="No, cancel"
      />
    );

    fireEvent.click(screen.getByText("No, cancel"));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
