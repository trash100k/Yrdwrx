import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { Toggle } from "./Toggle";

describe("Toggle component", () => {
  it("renders with the correct label and aria-label", () => {
    const handleChange = vi.fn();
    render(<Toggle checked={false} onChange={handleChange} label="Test Toggle" />);

    // Label text should be visible
    expect(screen.getByText("Test Toggle")).toBeInTheDocument();

    // Checkbox input should have correct aria-label
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("aria-label", "Test Toggle");
  });

  it("calls onChange when clicked", () => {
    const handleChange = vi.fn();
    render(<Toggle checked={false} onChange={handleChange} label="Clickable Toggle" />);

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it("does not call onChange when disabled", () => {
    const handleChange = vi.fn();
    render(<Toggle checked={false} onChange={handleChange} label="Disabled Toggle" disabled={true} />);

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    expect(handleChange).not.toHaveBeenCalled();
    expect(checkbox).toBeDisabled();
  });
});
