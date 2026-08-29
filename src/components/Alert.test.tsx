import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Alert } from "./Alert";

describe("Alert component", () => {
  it("renders children, title, and role='alert'", () => {
    render(
      <Alert title="Attention Required" variant="warning">
        This is an important message.
      </Alert>
    );

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(screen.getByText("Attention Required")).toBeInTheDocument();
    expect(screen.getByText("This is an important message.")).toBeInTheDocument();
  });

  it("renders dismiss button with aria-label and handles onClose callback", () => {
    const handleClose = vi.fn();
    render(
      <Alert onClose={handleClose}>
        Dismissible alert
      </Alert>
    );

    const closeBtn = screen.getByRole("button", { name: "Dismiss alert" });
    expect(closeBtn).toBeInTheDocument();

    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
