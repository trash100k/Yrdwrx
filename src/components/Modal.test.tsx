import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Modal } from "./Modal";

describe("Modal Component", () => {
  it("renders with proper ARIA accessibility attributes when open", () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Test Modal Header">
        <div>Modal Body Content</div>
      </Modal>
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");

    const heading = screen.getByRole("heading", { name: "Test Modal Header" });
    expect(heading).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-labelledby", heading.getAttribute("id"));
  });

  it("calls onClose when the close button is clicked", () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Test Modal">
        <div>Content</div>
      </Modal>
    );

    const closeButton = screen.getByRole("button", { name: "Close dialog" });
    expect(closeButton).toBeInTheDocument();
    fireEvent.click(closeButton);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape key is pressed", () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Test Modal">
        <div>Content</div>
      </Modal>
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("does not render dialog content when closed", () => {
    render(
      <Modal isOpen={false} onClose={() => {}} title="Hidden Modal">
        <div>Content</div>
      </Modal>
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
