import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pagination } from "./Pagination";

describe("Pagination Component", () => {
  it("renders nothing when totalPages is 1 or less", () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders pagination navigation with proper ARIA attributes", () => {
    render(<Pagination currentPage={2} totalPages={5} onPageChange={() => {}} />);

    const nav = screen.getByRole("navigation", { name: "Pagination" });
    expect(nav).toBeInTheDocument();

    const prevBtn = screen.getByRole("button", { name: "Previous page" });
    const nextBtn = screen.getByRole("button", { name: "Next page" });

    expect(prevBtn).toBeInTheDocument();
    expect(nextBtn).toBeInTheDocument();
    expect(prevBtn).not.toBeDisabled();
    expect(nextBtn).not.toBeDisabled();
  });

  it("disables previous button on the first page", () => {
    render(<Pagination currentPage={1} totalPages={3} onPageChange={() => {}} />);

    const prevBtn = screen.getByRole("button", { name: "Previous page" });
    const nextBtn = screen.getByRole("button", { name: "Next page" });

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();
  });

  it("disables next button on the last page", () => {
    render(<Pagination currentPage={3} totalPages={3} onPageChange={() => {}} />);

    const prevBtn = screen.getByRole("button", { name: "Previous page" });
    const nextBtn = screen.getByRole("button", { name: "Next page" });

    expect(prevBtn).not.toBeDisabled();
    expect(nextBtn).toBeDisabled();
  });

  it("calls onPageChange with correct page number when buttons are clicked", async () => {
    const handlePageChange = vi.fn();
    const user = userEvent.setup();

    render(<Pagination currentPage={2} totalPages={4} onPageChange={handlePageChange} />);

    const prevBtn = screen.getByRole("button", { name: "Previous page" });
    const nextBtn = screen.getByRole("button", { name: "Next page" });

    await user.click(prevBtn);
    expect(handlePageChange).toHaveBeenCalledWith(1);

    await user.click(nextBtn);
    expect(handlePageChange).toHaveBeenCalledWith(3);
  });
});
