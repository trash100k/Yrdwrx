import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserProfileMenu } from "./UserProfileMenu";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockSignOutUser = vi.fn();
vi.mock("../lib/supabase", () => ({
  getCurrentUser: () => ({
    displayName: "Supervisor Test",
    email: "test@yardworx.com",
  }),
  signOutUser: () => mockSignOutUser(),
}));

describe("UserProfileMenu accessibility and keyboard navigation", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("does not render dropdown content when closed", () => {
    render(
      <MemoryRouter>
        <UserProfileMenu isOpen={false} onClose={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("renders with menu role and accessible menuitem buttons when open", () => {
    render(
      <MemoryRouter>
        <UserProfileMenu isOpen={true} onClose={vi.fn()} />
      </MemoryRouter>
    );

    const menu = screen.getByRole("menu", { name: "User profile menu" });
    expect(menu).toBeInTheDocument();

    const menuItems = screen.getAllByRole("menuitem");
    expect(menuItems).toHaveLength(3);
    expect(menuItems[0]).toHaveTextContent("My Profile");
    expect(menuItems[1]).toHaveTextContent("Preferences");
    expect(menuItems[2]).toHaveTextContent("Sign Out");
  });

  it("dismisses menu when pressing the Escape key", () => {
    const handleClose = vi.fn();
    render(
      <MemoryRouter>
        <UserProfileMenu isOpen={true} onClose={handleClose} />
      </MemoryRouter>
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("navigates to settings and calls onClose when clicking a settings item", () => {
    const handleClose = vi.fn();
    render(
      <MemoryRouter>
        <UserProfileMenu isOpen={true} onClose={handleClose} />
      </MemoryRouter>
    );

    const profileButton = screen.getByRole("menuitem", { name: /my profile/i });
    fireEvent.click(profileButton);

    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/admin/settings");
  });

  it("triggers signOutUser and calls onClose when clicking Sign Out", async () => {
    const handleClose = vi.fn();
    render(
      <MemoryRouter>
        <UserProfileMenu isOpen={true} onClose={handleClose} />
      </MemoryRouter>
    );

    const signOutButton = screen.getByRole("menuitem", { name: /sign out/i });
    fireEvent.click(signOutButton);

    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(mockSignOutUser).toHaveBeenCalledTimes(1);
  });
});
