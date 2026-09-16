import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Skeleton } from "./Skeleton";

describe("Skeleton component", () => {
  it("renders with default accessibility attributes role='status' and aria-label", () => {
    render(<Skeleton />);
    const skeleton = screen.getByRole("status");
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute("aria-label", "Loading...");
  });

  it("supports custom ariaLabel prop", () => {
    render(<Skeleton ariaLabel="Loading profile information" />);
    const skeleton = screen.getByRole("status");
    expect(skeleton).toHaveAttribute("aria-label", "Loading profile information");
  });

  it("applies aria-hidden when aria-hidden is true", () => {
    const { container } = render(<Skeleton aria-hidden={true} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    const skeleton = container.querySelector("[aria-hidden='true']");
    expect(skeleton).toBeInTheDocument();
  });

  it("applies circle and custom className correctly", () => {
    render(<Skeleton circle className="w-12 h-12" ariaLabel="Avatar skeleton" />);
    const skeleton = screen.getByRole("status");
    expect(skeleton).toHaveClass("rounded-full");
    expect(skeleton).toHaveClass("w-12");
    expect(skeleton).toHaveClass("h-12");
  });
});
