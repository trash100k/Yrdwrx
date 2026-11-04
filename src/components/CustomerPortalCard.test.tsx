import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CustomerPortalCard } from "./CustomerPortalCard";
import { ToastProvider } from "../contexts/ToastContext";
import { Customer } from "../types";

vi.mock("../lib/api", () => ({
  fetchApi: vi.fn(),
}));

const mockCustomerWithEmail: Customer = {
  id: "cust-123",
  firstName: "Jane",
  lastName: "Doe",
  email: "jane.doe@example.com",
  phone: "555-0199",
  address: "123 Evergreen Terrace",
  status: "active",
};

const mockCustomerNoEmail: Customer = {
  id: "cust-456",
  firstName: "Bob",
  lastName: "Smith",
  phone: "555-0144",
  address: "456 Elm St",
  status: "lead",
};

describe("CustomerPortalCard", () => {
  it("renders with landmark role and accessible region label", () => {
    render(
      <ToastProvider>
        <CustomerPortalCard customer={mockCustomerWithEmail} />
      </ToastProvider>
    );

    const region = screen.getByRole("region", { name: "Client Portal Management" });
    expect(region).toBeInTheDocument();
  });

  it("renders invite button enabled with accessible label when customer has email", () => {
    render(
      <ToastProvider>
        <CustomerPortalCard customer={mockCustomerWithEmail} />
      </ToastProvider>
    );

    const inviteBtn = screen.getByRole("button", {
      name: "Create portal invite for Jane Doe",
    });
    expect(inviteBtn).toBeInTheDocument();
    expect(inviteBtn).not.toBeDisabled();
    expect(inviteBtn).toHaveAttribute("type", "button");
    expect(inviteBtn.className).toContain("focus-visible:ring-blue-400");
  });

  it("renders invite button disabled with accessible label when customer has no email", () => {
    render(
      <ToastProvider>
        <CustomerPortalCard customer={mockCustomerNoEmail} />
      </ToastProvider>
    );

    const inviteBtn = screen.getByRole("button", {
      name: "No email on file for client portal invite",
    });
    expect(inviteBtn).toBeInTheDocument();
    expect(inviteBtn).toBeDisabled();
  });

  it("renders copy and view as buttons with explicit type and focus visible styles", () => {
    render(
      <ToastProvider>
        <CustomerPortalCard customer={mockCustomerWithEmail} />
      </ToastProvider>
    );

    const copyBtn = screen.getByRole("button", {
      name: "Copy portal link for Jane Doe",
    });
    const viewBtn = screen.getByRole("button", {
      name: "View portal as Jane Doe",
    });

    expect(copyBtn).toHaveAttribute("type", "button");
    expect(copyBtn.className).toContain("focus-visible:ring-blue-400");

    expect(viewBtn).toHaveAttribute("type", "button");
    expect(viewBtn.className).toContain("focus-visible:ring-blue-400");
  });
});
