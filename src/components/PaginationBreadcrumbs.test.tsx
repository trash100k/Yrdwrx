import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { Pagination } from "./Pagination";
import { Breadcrumbs } from "./Breadcrumbs";

describe("Pagination Component Accessibility & UX", () => {
  it("renders a nav landmark with aria-label='Pagination'", () => {
    render(<Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />);
    const nav = screen.getByRole("navigation", { name: "Pagination" });
    expect(nav).toBeInTheDocument();
  });

  it("renders previous and next buttons with proper aria-labels and type='button'", () => {
    render(<Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />);
    const prevBtn = screen.getByRole("button", { name: "Previous page" });
    const nextBtn = screen.getByRole("button", { name: "Next page" });

    expect(prevBtn).toHaveAttribute("type", "button");
    expect(nextBtn).toHaveAttribute("type", "button");
    expect(prevBtn).not.toBeDisabled();
    expect(nextBtn).not.toBeDisabled();
  });

  it("disables previous button on first page and next button on last page", () => {
    const { rerender } = render(<Pagination currentPage={1} totalPages={3} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();

    rerender(<Pagination currentPage={3} totalPages={3} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("calls onPageChange with correct page number when clicked", () => {
    const handlePageChange = vi.fn();
    render(<Pagination currentPage={2} totalPages={5} onPageChange={handlePageChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(handlePageChange).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(handlePageChange).toHaveBeenCalledWith(3);
  });

  it("returns null when totalPages <= 1", () => {
    const { container } = render(<Pagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("Breadcrumbs Component Accessibility & UX", () => {
  it("renders a nav landmark with aria-label='Breadcrumb'", () => {
    const crumbs = [
      { label: "Home", path: "/" },
      { label: "CRM", path: "/crm" },
      { label: "Customers" },
    ];
    render(
      <MemoryRouter>
        <Breadcrumbs crumbs={crumbs} />
      </MemoryRouter>
    );

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(nav).toBeInTheDocument();
  });

  it("marks the last item with aria-current='page'", () => {
    const crumbs = [
      { label: "Dashboard", path: "/" },
      { label: "Invoices" },
    ];
    render(
      <MemoryRouter>
        <Breadcrumbs crumbs={crumbs} />
      </MemoryRouter>
    );

    const activeCrumb = screen.getByText("Invoices");
    expect(activeCrumb).toHaveAttribute("aria-current", "page");
  });
});
