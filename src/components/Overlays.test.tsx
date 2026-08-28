import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Modal } from "./Modal";
import { Drawer } from "./Drawer";
import { ConfirmDialog } from "./ConfirmDialog";

describe("Overlay components accessibility and keyboard navigation", () => {
  describe("Modal", () => {
    it("renders with correct ARIA attributes and handles Escape key", () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute("aria-modal", "true");

      const title = screen.getByText("Test Modal");
      expect(dialog).toHaveAttribute("aria-labelledby", title.id);

      const closeButton = screen.getByRole("button", { name: "Close dialog" });
      expect(closeButton).toBeInTheDocument();

      fireEvent.keyDown(window, { key: "Escape" });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("Drawer", () => {
    it("renders with correct ARIA attributes and handles Escape key", () => {
      const handleClose = vi.fn();
      render(
        <Drawer isOpen={true} onClose={handleClose} title="Test Drawer">
          <p>Drawer content</p>
        </Drawer>
      );

      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute("aria-modal", "true");

      const title = screen.getByText("Test Drawer");
      expect(dialog).toHaveAttribute("aria-labelledby", title.id);

      const closeButton = screen.getByRole("button", { name: "Close drawer" });
      expect(closeButton).toBeInTheDocument();

      fireEvent.keyDown(window, { key: "Escape" });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("ConfirmDialog", () => {
    it("renders with alertdialog role and handles Escape key", () => {
      const handleClose = vi.fn();
      const handleConfirm = vi.fn();
      render(
        <ConfirmDialog
          isOpen={true}
          onClose={handleClose}
          onConfirm={handleConfirm}
          title="Delete Item"
          description="Are you sure you want to delete this?"
        />
      );

      const alertDialog = screen.getByRole("alertdialog");
      expect(alertDialog).toBeInTheDocument();
      expect(alertDialog).toHaveAttribute("aria-modal", "true");

      const title = screen.getByText("Delete Item");
      expect(alertDialog).toHaveAttribute("aria-labelledby", title.id);

      fireEvent.keyDown(window, { key: "Escape" });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });
});
