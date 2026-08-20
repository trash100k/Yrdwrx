import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ProgressBar } from "./ProgressBar";

describe("ProgressBar Component", () => {
  it("renders with progressbar role and correct ARIA attributes", () => {
    render(<ProgressBar progress={45} label="Uploading file" />);

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toBeInTheDocument();
    expect(progressbar).toHaveAttribute("aria-valuenow", "45");
    expect(progressbar).toHaveAttribute("aria-valuemin", "0");
    expect(progressbar).toHaveAttribute("aria-valuemax", "100");
    expect(progressbar).toHaveAttribute("aria-label", "Uploading file");
  });

  it("clamps progress values below 0 and above 100", () => {
    const { rerender } = render(<ProgressBar progress={-20} />);
    let progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "0");
    expect(progressbar).toHaveAttribute("aria-label", "Progress");

    rerender(<ProgressBar progress={150} />);
    progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "100");
  });
});
