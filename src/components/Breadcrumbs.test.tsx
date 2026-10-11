import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Breadcrumbs } from "./Breadcrumbs";

describe("Breadcrumbs component", () => {
  const sampleCrumbs = [
    { label: "Home", path: "/" },
    { label: "Jobs", path: "/jobs" },
    { label: "Job #1024" },
  ];

  it("renders nav element with aria-label='Breadcrumb'", () => {
    render(
      <MemoryRouter>
        <Breadcrumbs crumbs={sampleCrumbs} />
      </MemoryRouter>
    );

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(nav).toBeInTheDocument();
  });

  it("marks the last item with aria-current='page'", () => {
    render(
      <MemoryRouter>
        <Breadcrumbs crumbs={sampleCrumbs} />
      </MemoryRouter>
    );

    const activeItem = screen.getByText("Job #1024");
    expect(activeItem).toHaveAttribute("aria-current", "page");
  });

  it("renders non-last items as links when path is provided", () => {
    render(
      <MemoryRouter>
        <Breadcrumbs crumbs={sampleCrumbs} />
      </MemoryRouter>
    );

    const homeLink = screen.getByRole("link", { name: "Home" });
    expect(homeLink).toHaveAttribute("href", "/");

    const jobsLink = screen.getByRole("link", { name: "Jobs" });
    expect(jobsLink).toHaveAttribute("href", "/jobs");
  });
});
