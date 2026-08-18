import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Accordion } from "./Accordion";

describe("Accordion Component", () => {
  const items = [
    { id: "section1", title: "Section 1", content: "Content 1" },
    { id: "section2", title: "Section 2", content: "Content 2" },
  ];

  it("renders accordion items correctly with ARIA attributes", () => {
    render(<Accordion items={items} />);

    const button1 = screen.getByRole("button", { name: "Section 1" });
    const button2 = screen.getByRole("button", { name: "Section 2" });

    expect(button1).toBeInTheDocument();
    expect(button2).toBeInTheDocument();

    expect(button1).toHaveAttribute("aria-expanded", "false");
    expect(button1).toHaveAttribute("aria-controls", "accordion-panel-section1");

    expect(screen.queryByText("Content 1")).not.toBeInTheDocument();
  });

  it("expands and collapses panels on click with proper region association", async () => {
    render(<Accordion items={items} />);

    const button1 = screen.getByRole("button", { name: "Section 1" });

    // Open panel 1
    fireEvent.click(button1);
    expect(button1).toHaveAttribute("aria-expanded", "true");

    const panel1 = screen.getByRole("region", { name: "Section 1" });
    expect(panel1).toBeInTheDocument();
    expect(panel1).toHaveAttribute("id", "accordion-panel-section1");
    expect(screen.getByText("Content 1")).toBeInTheDocument();

    // Close panel 1
    fireEvent.click(button1);
    expect(button1).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => {
      expect(screen.queryByText("Content 1")).not.toBeInTheDocument();
    });
  });

  it("supports single panel open behavior by default", async () => {
    render(<Accordion items={items} />);

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

  it("supports multiple open panels when allowMultiple is true", () => {
    render(<Accordion items={items} allowMultiple />);

    const button1 = screen.getByRole("button", { name: "Section 1" });
    const button2 = screen.getByRole("button", { name: "Section 2" });

    fireEvent.click(button1);
    fireEvent.click(button2);

    expect(screen.getByText("Content 1")).toBeInTheDocument();
    expect(screen.getByText("Content 2")).toBeInTheDocument();
  });
});
