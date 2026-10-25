import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { LeadSubmissionModal } from "./LeadSubmissionModal";
import { ToastProvider } from "../contexts/ToastContext";

describe("LeadSubmissionModal", () => {
  it("renders with correct accessibility roles and attributes when open", () => {
    render(
      <ToastProvider>
        <LeadSubmissionModal isOpen={true} onClose={() => {}} />
      </ToastProvider>
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "lead-modal-title");

    const closeButton = screen.getByRole("button", { name: /close modal/i });
    expect(closeButton).toBeInTheDocument();

    const firstNameInput = screen.getByLabelText(/first name/i);
    expect(firstNameInput).toBeInTheDocument();

    const addressInput = screen.getByLabelText(/property address/i);
    expect(addressInput).toBeInTheDocument();

    const phoneInput = screen.getByLabelText(/phone number/i);
    expect(phoneInput).toBeInTheDocument();

    const emailInput = screen.getByLabelText(/email address/i);
    expect(emailInput).toBeInTheDocument();
  });

  it("calls onClose when Escape key is pressed", () => {
    const handleClose = vi.fn();
    render(
      <ToastProvider>
        <LeadSubmissionModal isOpen={true} onClose={handleClose} />
      </ToastProvider>
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("does not render when isOpen is false", () => {
    render(
      <ToastProvider>
        <LeadSubmissionModal isOpen={false} onClose={() => {}} />
      </ToastProvider>
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
