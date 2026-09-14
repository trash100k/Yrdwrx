import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Loader } from "./Loader";

describe("Loader component", () => {
  it("renders with role status, aria-live polite, and default aria-label", () => {
    render(<Loader text="Processing data..." />);
    const statusElement = screen.getByRole("status");
    expect(statusElement).toBeInTheDocument();
    expect(statusElement).toHaveAttribute("aria-live", "polite");
    expect(statusElement).toHaveAttribute("aria-label", "Processing data...");
    expect(screen.getByText("Processing data...")).toBeInTheDocument();
  });

  it("uses custom ariaLabel when provided", () => {
    render(<Loader text="Please wait" ariaLabel="Custom loading message" />);
    const statusElement = screen.getByRole("status");
    expect(statusElement).toHaveAttribute("aria-label", "Custom loading message");
  });

  it("renders fullscreen loader wrapper", () => {
    render(<Loader fullScreen text="Loading app..." />);
    const statusElement = screen.getByRole("status");
    expect(statusElement).toBeInTheDocument();
    expect(statusElement.parentElement).toHaveClass("fixed inset-0");
  });
});
