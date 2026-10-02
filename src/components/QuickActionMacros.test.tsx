// @ts-nocheck
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import QuickActionMacros from "./QuickActionMacros";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../hooks/useRole", () => ({
  useRole: () => ({ role: "owner" }),
}));

describe("QuickActionMacros", () => {
  it("renders quick action buttons with type='button'", () => {
    render(
      <MemoryRouter>
        <QuickActionMacros />
      </MemoryRouter>
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(4);

    buttons.forEach((button) => {
      expect(button).toHaveAttribute("type", "button");
    });
  });

  it("navigates to corresponding route on click", () => {
    mockNavigate.mockReset();
    render(
      <MemoryRouter>
        <QuickActionMacros />
      </MemoryRouter>
    );

    const addClientBtn = screen.getByRole("button", { name: /add client/i });
    fireEvent.click(addClientBtn);

    expect(mockNavigate).toHaveBeenCalledWith("/admin/crm");
  });
});
