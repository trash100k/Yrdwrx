import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { Tabs } from "./Tabs";

describe("Tabs component", () => {
  const tabs = ["Overview", "Details", "Settings"];

  it("renders tablist and tabs with correct roles and aria-selected states", () => {
    render(
      <Tabs
        tabs={tabs}
        activeTab="Overview"
        onChange={vi.fn()}
        aria-label="Section navigation"
      />
    );

    const tablist = screen.getByRole("tablist", { name: "Section navigation" });
    expect(tablist).toBeInTheDocument();

    const tabElements = screen.getAllByRole("tab");
    expect(tabElements).toHaveLength(3);

    expect(tabElements[0]).toHaveTextContent("Overview");
    expect(tabElements[0]).toHaveAttribute("aria-selected", "true");

    expect(tabElements[1]).toHaveTextContent("Details");
    expect(tabElements[1]).toHaveAttribute("aria-selected", "false");

    expect(tabElements[2]).toHaveTextContent("Settings");
    expect(tabElements[2]).toHaveAttribute("aria-selected", "false");
  });

  it("calls onChange callback when a tab is clicked", () => {
    const handleChange = vi.fn();
    render(
      <Tabs tabs={tabs} activeTab="Overview" onChange={handleChange} />
    );

    const detailsTab = screen.getByRole("tab", { name: "Details" });
    fireEvent.click(detailsTab);

    expect(handleChange).toHaveBeenCalledWith("Details");
  });
});
