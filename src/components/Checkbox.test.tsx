import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { Checkbox } from "./Checkbox";

describe("Checkbox component", () => {
  it("renders with label and description", () => {
    const handleChange = vi.fn();
    render(
      <Checkbox
        checked={false}
        onChange={handleChange}
        label="Accept terms"
        description="I agree to follow the code of conduct"
      />
    );

    expect(screen.getByText("Accept terms")).toBeInTheDocument();
    expect(screen.getByText("I agree to follow the code of conduct")).toBeInTheDocument();
  });

  it("calls onChange when clicked", () => {
    const handleChange = vi.fn();
    render(<Checkbox checked={false} onChange={handleChange} label="Accept terms" />);

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    expect(handleChange).toHaveBeenCalledWith(true);
  });
});
