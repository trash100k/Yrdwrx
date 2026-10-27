import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Slider } from "./Slider";

describe("Slider Component", () => {
  it("renders correctly with label and associates label with input via htmlFor", () => {
    const handleChange = vi.fn();
    render(<Slider label="Volume Level" value={50} onChange={handleChange} />);

    const labelElement = screen.getByText("Volume Level");
    const inputElement = screen.getByRole("slider", { name: "Volume Level" });

    expect(labelElement).toBeInTheDocument();
    expect(inputElement).toBeInTheDocument();
    expect(labelElement.getAttribute("for")).toBe(inputElement.getAttribute("id"));
  });

  it("passes ARIA attributes correctly", () => {
    render(
      <Slider
        min={10}
        max={200}
        value={75}
        onChange={() => {}}
        ariaLabel="Custom Slider Label"
      />
    );

    const inputElement = screen.getByRole("slider", { name: "Custom Slider Label" });
    expect(inputElement).toHaveAttribute("aria-valuenow", "75");
    expect(inputElement).toHaveAttribute("aria-valuemin", "10");
    expect(inputElement).toHaveAttribute("aria-valuemax", "200");
  });

  it("calls onChange when value changes", () => {
    const handleChange = vi.fn();
    render(<Slider value={25} onChange={handleChange} min={0} max={100} />);

    const inputElement = screen.getByRole("slider");
    fireEvent.change(inputElement, { target: { value: "60" } });

    expect(handleChange).toHaveBeenCalledWith(60);
  });

  it("handles disabled state correctly", () => {
    render(<Slider value={30} onChange={() => {}} disabled label="Disabled Slider" />);

    const inputElement = screen.getByRole("slider", { name: "Disabled Slider" });
    expect(inputElement).toBeDisabled();
  });
});
