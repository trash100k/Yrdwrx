import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./Button";
import { Plus } from "lucide-react";

describe("Button component", () => {
  it("renders children correctly", () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByRole("button", { name: "Click Me" })).toBeInTheDocument();
  });

  it("includes focus-visible accessibility ring styles", () => {
    render(<Button>Focus Target</Button>);
    const button = screen.getByRole("button", { name: "Focus Target" });
    expect(button).toHaveClass("focus-visible:ring-2");
    expect(button).toHaveClass("focus-visible:ring-forest-500");
  });

  it("handles loading state with aria-busy and disabled", () => {
    render(<Button isLoading>Submitting</Button>);
    const button = screen.getByRole("button", { name: "Submitting" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("renders left icon when provided", () => {
    render(<Button leftIcon={<Plus data-testid="plus-icon" />}>Add Item</Button>);
    expect(screen.getByTestId("plus-icon")).toBeInTheDocument();
  });
});
