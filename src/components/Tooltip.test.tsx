import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Tooltip } from "./Tooltip";

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

describe("Tooltip Component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders trigger child element", () => {
    render(
      <Tooltip content="Tooltip details">
        <button>Hover or focus me</button>
      </Tooltip>
    );

    expect(screen.getByRole("button", { name: "Hover or focus me" })).toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows tooltip content on focus after delay and sets role='tooltip'", () => {
    render(
      <Tooltip content="Tooltip details" delay={200}>
        <button>Hover or focus me</button>
      </Tooltip>
    );

    const button = screen.getByRole("button", { name: "Hover or focus me" });

    act(() => {
      fireEvent.focus(button);
    });

    // Before timer completes, tooltip is not shown
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent("Tooltip details");
  });

  it("dismisses tooltip when Escape key is pressed", () => {
    render(
      <Tooltip content="Tooltip details" delay={0}>
        <button>Hover or focus me</button>
      </Tooltip>
    );

    const button = screen.getByRole("button", { name: "Hover or focus me" });

    act(() => {
      fireEvent.mouseEnter(button);
      vi.advanceTimersByTime(0);
    });

    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
