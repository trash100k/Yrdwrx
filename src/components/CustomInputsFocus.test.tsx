// @ts-nocheck
import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { Checkbox } from "./Checkbox";
import { Toggle } from "./Toggle";
import { RadioGroup } from "./RadioGroup";

describe("Custom inputs focus-visible styling", () => {
  it("renders Checkbox with peer-focus-visible styles", () => {
    const { container } = render(
      <Checkbox checked={false} onChange={() => {}} label="Test Checkbox" />
    );
    const input = container.querySelector("input[type='checkbox']");
    expect(input).toBeInTheDocument();
    expect(input).toHaveClass("peer", "sr-only");

    const customDiv = container.querySelector("div.peer-focus-visible\\:ring-2");
    expect(customDiv).toBeInTheDocument();
    expect(customDiv).toHaveClass("peer-focus-visible:ring-forest-500");
  });

  it("renders Toggle with peer-focus-visible styles", () => {
    const { container } = render(
      <Toggle checked={false} onChange={() => {}} label="Test Toggle" />
    );
    const input = container.querySelector("input[type='checkbox']");
    expect(input).toBeInTheDocument();
    expect(input).toHaveClass("peer", "sr-only");

    const customDiv = container.querySelector("div.peer-focus-visible\\:ring-2");
    expect(customDiv).toBeInTheDocument();
    expect(customDiv).toHaveClass("peer-focus-visible:ring-forest-500");
  });

  it("renders RadioGroup with peer-focus-visible styles", () => {
    const options = [
      { value: "opt1", label: "Option 1" },
      { value: "opt2", label: "Option 2" },
    ];
    const { container } = render(
      <RadioGroup options={options} value="opt1" onChange={() => {}} />
    );
    const inputs = container.querySelectorAll("input[type='radio']");
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveClass("peer", "sr-only");

    const customDivs = container.querySelectorAll("div.peer-focus-visible\\:ring-2");
    expect(customDivs).toHaveLength(2);
    expect(customDivs[0]).toHaveClass("peer-focus-visible:ring-forest-500");
  });
});
