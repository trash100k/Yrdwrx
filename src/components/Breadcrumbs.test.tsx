import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Breadcrumbs } from "./Breadcrumbs";

describe("Breadcrumbs", () => {
  it("renders nav with aria-label='Breadcrumb'", () => {
    const crumbs = [
      { label: "Home", path: "/" },
      { label: "Clients", path: "/clients" },
      { label: "Acme Corp" },
    ];

    render(
      <MemoryRouter>
        <Breadcrumbs crumbs={crumbs} />
      </MemoryRouter>
    );

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(nav).toBeDefined();
  });

  it("marks the last breadcrumb item with aria-current='page'", () => {
    const crumbs = [
      { label: "Home", path: "/" },
      { label: "Jobs", path: "/jobs" },
      { label: "Job #101" },
    ];

    render(
      <MemoryRouter>
        <Breadcrumbs crumbs={crumbs} />
      </MemoryRouter>
    );

    const currentItem = screen.getByText("Job #101");
    expect(currentItem.getAttribute("aria-current")).toBe("page");

    const linkItem = screen.getByText("Home");
    expect(linkItem.getAttribute("aria-current")).toBeNull();
  });

  it("hides chevron icons from screen readers with aria-hidden='true'", () => {
    const crumbs = [
      { label: "Dashboard", path: "/dashboard" },
      { label: "Settings" },
    ];

    const { container } = render(
      <MemoryRouter>
        <Breadcrumbs crumbs={crumbs} />
      </MemoryRouter>
    );

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });
});
