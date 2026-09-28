import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { EmptyState } from "./EmptyState";
import { Folder } from "lucide-react";

describe("EmptyState Component", () => {
  it("renders title, description, and icon container with aria-hidden", () => {
    render(
      <EmptyState
        icon={Folder}
        title="No items found"
        description="Try adjusting your filter criteria."
      />
    );

    expect(screen.getByRole("heading", { level: 3, name: "No items found" })).toBeInTheDocument();
    expect(screen.getByText("Try adjusting your filter criteria.")).toBeInTheDocument();

    // Check that icon container has aria-hidden="true"
    const iconWrapper = screen.getByText("No items found").previousElementSibling;
    expect(iconWrapper).toHaveAttribute("aria-hidden", "true");
  });

  it("renders action button with type='button' and calls onClick when clicked", () => {
    const handleClick = vi.fn();
    render(
      <EmptyState
        icon={Folder}
        title="No items found"
        description="Try adjusting your filter criteria."
        action={{
          label: "Create Item",
          onClick: handleClick,
        }}
      />
    );

    const button = screen.getByRole("button", { name: "Create Item" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("focus-visible:ring-forest-500");

    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
