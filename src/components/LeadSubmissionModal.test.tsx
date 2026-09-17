import React from "react";
import { render } from "@testing-library/react";
import { LeadSubmissionModal } from "./LeadSubmissionModal";
import { vi, describe, it, expect } from "vitest";

vi.mock("../contexts/ToastContext", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("../lib/repos", () => ({
  customersRepo: { create: vi.fn().mockResolvedValue({}) },
}));

describe("LeadSubmissionModal component", () => {
  it("renders with proper ARIA attributes when open", () => {
    const { getByRole, getByLabelText } = render(
      <LeadSubmissionModal isOpen={true} onClose={vi.fn()} />
    );

    const dialog = getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "submit-lead-title");

    expect(getByLabelText("First Name")).toBeInTheDocument();
    expect(getByLabelText("Last Name")).toBeInTheDocument();
    expect(getByLabelText("Phone number")).toBeInTheDocument();
    expect(getByLabelText("Email address")).toBeInTheDocument();
    expect(getByLabelText("Property Address")).toBeInTheDocument();
    expect(getByLabelText("Service Notes")).toBeInTheDocument();
    expect(getByRole("button", { name: "Close modal" })).toBeInTheDocument();
  });
});
