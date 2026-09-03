import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QuickCreateMenu } from "./QuickCreateMenu";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("QuickCreateMenu", () => {
  it("renders menu options when isOpen is true with appropriate ARIA roles", () => {
    const handleClose = vi.fn();
    render(
      <MemoryRouter>
        <QuickCreateMenu isOpen={true} onClose={handleClose} />
      </MemoryRouter>
    );

    const menu = screen.getByRole("menu", { name: "Quick create menu" });
    expect(menu).toBeInTheDocument();

    const menuItems = screen.getAllByRole("menuitem");
    expect(menuItems).toHaveLength(4);

    const closeButton = screen.getByRole("button", { name: "Close menu" });
    expect(closeButton).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    const handleClose = vi.fn();
    render(
      <MemoryRouter>
        <QuickCreateMenu isOpen={false} onClose={handleClose} />
      </MemoryRouter>
    );

    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("calls onClose when Escape key is pressed", () => {
    const handleClose = vi.fn();
    render(
      <MemoryRouter>
        <QuickCreateMenu isOpen={true} onClose={handleClose} />
      </MemoryRouter>
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("navigates and closes menu when an item is clicked", () => {
    const handleClose = vi.fn();
    render(
      <MemoryRouter>
        <QuickCreateMenu isOpen={true} onClose={handleClose} />
      </MemoryRouter>
    );

    const clientItem = screen.getByRole("menuitem", { name: /New Client/i });
    fireEvent.click(clientItem);

    expect(mockNavigate).toHaveBeenCalledWith("/admin/crm?create=client");
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
