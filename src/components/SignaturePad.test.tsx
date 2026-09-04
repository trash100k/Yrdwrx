import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import SignaturePad from "./SignaturePad";

describe("SignaturePad component", () => {
  it("renders with proper accessibility dialog roles and heading linkage when open", () => {
    const handleCancel = vi.fn();
    const handleSign = vi.fn();

    render(
      <SignaturePad
        open={true}
        title="Sign & Accept Proposal"
        amountLabel="$1,500.00"
        onCancel={handleCancel}
        onSign={handleSign}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "signature-pad-title");

    const heading = screen.getByText("Sign & Accept Proposal");
    expect(heading).toHaveAttribute("id", "signature-pad-title");
  });

  it("supports tab switcher roles and aria-selected state", () => {
    const handleCancel = vi.fn();
    const handleSign = vi.fn();

    render(
      <SignaturePad
        open={true}
        onCancel={handleCancel}
        onSign={handleSign}
      />
    );

    const tablist = screen.getByRole("tablist", { name: "Signature method" });
    expect(tablist).toBeInTheDocument();

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");

    fireEvent.click(tabs[1]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "false");
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
  });

  it("dismisses via onCancel on Escape keydown", () => {
    const handleCancel = vi.fn();
    const handleSign = vi.fn();

    render(
      <SignaturePad
        open={true}
        onCancel={handleCancel}
        onSign={handleSign}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleCancel).toHaveBeenCalledTimes(1);
  });
});
