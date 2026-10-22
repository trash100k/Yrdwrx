import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ProgressBar } from "./ProgressBar";

describe("ProgressBar Component", () => {
  it("renders with correct ARIA progressbar roles and values", () => {
    render(<ProgressBar progress={45} label="Storage used" />);

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toBeInTheDocument();
    expect(progressbar).toHaveAttribute("aria-valuenow", "45");
    expect(progressbar).toHaveAttribute("aria-valuemin", "0");
    expect(progressbar).toHaveAttribute("aria-valuemax", "100");
    expect(progressbar).toHaveAttribute("aria-label", "Storage used");
    expect(screen.getByText("Storage used")).toBeInTheDocument();
    expect(screen.getByText("45%")).toBeInTheDocument();
  });

  it("uses ariaLabel prop when provided over label", () => {
    render(<ProgressBar progress={70} label="Visible Label" ariaLabel="Custom Accessible Label" />);

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-label", "Custom Accessible Label");
  });

  it("defaults aria-label to 'Progress' when no label or ariaLabel is given", () => {
    render(<ProgressBar progress={20} showValue={false} />);

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-label", "Progress");
  });

  it("clamps progress between 0 and 100 for ARIA attributes", () => {
    const { rerender } = render(<ProgressBar progress={150} />);
    let progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "100");

    rerender(<ProgressBar progress={-20} />);
    progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "0");
  });
});
