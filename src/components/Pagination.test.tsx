import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Pagination } from "./Pagination";

describe("Pagination Component", () => {
  it("renders null when totalPages is 1 or less", () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nav container with correct aria-label and page indicator", () => {
    render(
      <Pagination currentPage={2} totalPages={5} onPageChange={vi.fn()} />
    );

    const nav = screen.getByRole("navigation", { name: "Pagination" });
    expect(nav).toBeInTheDocument();

    const indicator = screen.getByText((content, element) => {
      return element?.tagName.toLowerCase() === "span" && element.textContent === "2 / 5";
    });
    expect(indicator).toBeInTheDocument();
  });

  it("disables previous button on first page and enables next button", () => {
    const onPageChange = vi.fn();
    render(
      <Pagination currentPage={1} totalPages={3} onPageChange={onPageChange} />
    );

    const prevButton = screen.getByRole("button", { name: "Previous page" });
    const nextButton = screen.getByRole("button", { name: "Next page" });

    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    fireEvent.click(nextButton);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("disables next button on last page and enables previous button", () => {
    const onPageChange = vi.fn();
    render(
      <Pagination currentPage={3} totalPages={3} onPageChange={onPageChange} />
    );

    const prevButton = screen.getByRole("button", { name: "Previous page" });
    const nextButton = screen.getByRole("button", { name: "Next page" });

    expect(prevButton).not.toBeDisabled();
    expect(nextButton).toBeDisabled();

    fireEvent.click(prevButton);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
