import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "./Input";
import { Select } from "./Select";
import { Textarea } from "./Textarea";

describe("Form Input Accessibility", () => {
  it("links Input to error and sets aria-invalid", () => {
    render(<Input label="Email Address" id="email-field" error="Invalid email format" />);
    const input = screen.getByLabelText("Email Address");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "email-field-error");

    const errorMessage = screen.getByText("Invalid email format");
    expect(errorMessage).toHaveAttribute("id", "email-field-error");
  });

  it("links Input to helpText when no error is present", () => {
    render(<Input label="Username" id="user-field" helpText="Must be at least 3 characters" />);
    const input = screen.getByLabelText("Username");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).toHaveAttribute("aria-describedby", "user-field-help");

    const helpMessage = screen.getByText("Must be at least 3 characters");
    expect(helpMessage).toHaveAttribute("id", "user-field-help");
  });

  it("links Select to error and sets aria-invalid", () => {
    render(
      <Select label="Role" id="role-field" error="Please select a role">
        <option value="">Select...</option>
        <option value="admin">Admin</option>
      </Select>
    );
    const select = screen.getByLabelText("Role");
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveAttribute("aria-describedby", "role-field-error");
  });

  it("links Textarea to helpText when no error is present", () => {
    render(<Textarea label="Bio" id="bio-field" helpText="Brief description" />);
    const textarea = screen.getByLabelText("Bio");
    expect(textarea).not.toHaveAttribute("aria-invalid");
    expect(textarea).toHaveAttribute("aria-describedby", "bio-field-help");
  });
});
