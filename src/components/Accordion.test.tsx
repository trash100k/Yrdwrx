import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Accordion } from "./Accordion";

describe("Accordion", () => {
  const sampleItems = [
    { id: "item-1", title: "Section 1", content: "Content 1" },
    { id: "item-2", title: "Section 2", content: "Content 2" },
  ];

  it("renders accordion header buttons with correct ARIA attributes", () => {
    render(<Accordion items={sampleItems} />);

    const button1 = screen.getByRole("button", { name: "Section 1" });
    const button2 = screen.getByRole("button", { name: "Section 2" });

    expect(button1).toHaveAttribute("id", "accordion-header-item-1");
    expect(button1).toHaveAttribute("aria-expanded", "false");
    expect(button1).toHaveAttribute("aria-controls", "accordion-content-item-1");

    expect(button2).toHaveAttribute("id", "accordion-header-item-2");
    expect(button2).toHaveAttribute("aria-expanded", "false");
    expect(button2).toHaveAttribute("aria-controls", "accordion-content-item-2");
  });

  it("toggles content visibility and updates aria-expanded on click", async () => {
    render(<Accordion items={sampleItems} />);

    const button1 = screen.getByRole("button", { name: "Section 1" });
    expect(screen.queryByText("Content 1")).not.toBeInTheDocument();

    fireEvent.click(button1);

    expect(button1).toHaveAttribute("aria-expanded", "true");
    const region1 = screen.getByRole("region", { name: "Section 1" });
    expect(region1).toHaveAttribute("id", "accordion-content-item-1");
    expect(region1).toHaveTextContent("Content 1");

    fireEvent.click(button1);

    expect(button1).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => {
      expect(screen.queryByText("Content 1")).not.toBeInTheDocument();
    });
  });

  it("closes previous section when single-expand mode is active", async () => {
    render(<Accordion items={sampleItems} allowMultiple={false} />);

    const button1 = screen.getByRole("button", { name: "Section 1" });
    const button2 = screen.getByRole("button", { name: "Section 2" });

    fireEvent.click(button1);
    expect(screen.getByText("Content 1")).toBeInTheDocument();

    fireEvent.click(button2);
    await waitFor(() => {
      expect(screen.queryByText("Content 1")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Content 2")).toBeInTheDocument();
  });
});
