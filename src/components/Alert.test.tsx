import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Alert } from "./Alert";

describe("Alert component accessibility and behavior", () => {
  it("renders role='alert' and content correctly", () => {
    render(<Alert title="System Notice">This is an alert message.</Alert>);

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(screen.getByText("System Notice")).toBeInTheDocument();
    expect(screen.getByText("This is an alert message.")).toBeInTheDocument();
  });

  it("renders dismiss button with explicit aria-label when onClose is provided", () => {
    const handleClose = vi.fn();
    render(
      <Alert title="Warning" variant="warning" onClose={handleClose}>
        Warning description
      </Alert>
    );

    const closeButton = screen.getByRole("button", { name: "Dismiss alert" });
    expect(closeButton).toBeInTheDocument();

    fireEvent.click(closeButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("does not render dismiss button when onClose is absent", () => {
    render(<Alert variant="error">Error description</Alert>);

    expect(screen.queryByRole("button", { name: "Dismiss alert" })).not.toBeInTheDocument();
  });
});
