import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Modal } from "./Modal";
import { ConfirmDialog } from "./ConfirmDialog";

describe("Modal and ConfirmDialog Accessibility", () => {
  describe("Modal", () => {
    it("renders dialog with proper ARIA attributes when open", () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute("aria-modal", "true");

      const heading = screen.getByRole("heading", { name: "Test Modal" });
      expect(heading).toBeInTheDocument();
      expect(dialog).toHaveAttribute("aria-labelledby", heading.id);

      const closeButton = screen.getByRole("button", { name: "Close" });
      expect(closeButton).toBeInTheDocument();
    });

    it("triggers onClose when Escape key is pressed", () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      fireEvent.keyDown(window, { key: "Escape" });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("ConfirmDialog", () => {
    it("renders dialog with proper ARIA attributes when open", () => {
      render(
        <ConfirmDialog
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
          title="Confirm Action"
          description="Are you sure?"
        />
      );

      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute("aria-modal", "true");

      const heading = screen.getByRole("heading", { name: "Confirm Action" });
      expect(heading).toBeInTheDocument();
      expect(dialog).toHaveAttribute("aria-labelledby", heading.id);
    });

    it("triggers onClose when Escape key is pressed", () => {
      const handleClose = vi.fn();
      render(
        <ConfirmDialog
          isOpen={true}
          onClose={handleClose}
          onConfirm={() => {}}
          title="Confirm Action"
          description="Are you sure?"
        />
      );

      fireEvent.keyDown(window, { key: "Escape" });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });
});
