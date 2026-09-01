import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BeforeAfterSlider from "./BeforeAfterSlider";

describe("BeforeAfterSlider Accessibility & Controls", () => {
  const props = {
    beforeImage: "https://example.com/before.jpg",
    afterImage: "https://example.com/after.jpg",
  };

  it("renders with correct ARIA slider attributes and initial values", () => {
    render(<BeforeAfterSlider {...props} />);
    const slider = screen.getByRole("slider", { name: "Before/after comparison slider" });

    expect(slider).toBeInTheDocument();
    expect(slider).toHaveAttribute("aria-valuemin", "0");
    expect(slider).toHaveAttribute("aria-valuemax", "100");
    expect(slider).toHaveAttribute("aria-valuenow", "50");
    expect(slider).toHaveAttribute("aria-valuetext", "50% after view");
    expect(slider).toHaveAttribute("tabindex", "0");
  });

  it("handles keyboard navigation (ArrowLeft, ArrowRight, Home, End)", () => {
    render(<BeforeAfterSlider {...props} />);
    const slider = screen.getByRole("slider");

    // ArrowLeft reduces sliderPosition by 2 (50 -> 48)
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(slider).toHaveAttribute("aria-valuenow", "48");
    expect(slider).toHaveAttribute("aria-valuetext", "48% after view");

    // ArrowRight increases sliderPosition by 2 (48 -> 50)
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(slider).toHaveAttribute("aria-valuenow", "50");

    // Home sets sliderPosition to 0
    fireEvent.keyDown(slider, { key: "Home" });
    expect(slider).toHaveAttribute("aria-valuenow", "0");
    expect(slider).toHaveAttribute("aria-valuetext", "0% after view");

    // End sets sliderPosition to 100
    fireEvent.keyDown(slider, { key: "End" });
    expect(slider).toHaveAttribute("aria-valuenow", "100");
    expect(slider).toHaveAttribute("aria-valuetext", "100% after view");
  });
});
