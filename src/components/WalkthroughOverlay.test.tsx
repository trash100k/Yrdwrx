import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import WalkthroughOverlay from "./WalkthroughOverlay";
import * as CuttyGuideContext from "../contexts/CuttyGuideContext";

vi.mock("../contexts/CuttyGuideContext", () => ({
  useCuttyGuide: vi.fn(),
}));

describe("WalkthroughOverlay accessibility and interactions", () => {
  const mockEndTour = vi.fn();
  const mockNextTourStep = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders with role=dialog, aria-modal, aria-labelledby, and accessible buttons", () => {
    (CuttyGuideContext.useCuttyGuide as any).mockReturnValue({
      activeFocus: {
        id: "step-1",
        label: "Welcome to YardWorx",
        description: "Let's take a quick tour around the workspace.",
        rect: { left: 100, top: 100, width: 200, height: 100, right: 300, bottom: 200 },
      },
      isTourActive: true,
      currentTourStep: 0,
      tourSteps: [
        { id: "step-1", label: "Welcome to YardWorx", description: "..." },
        { id: "step-2", label: "Second Step", description: "..." },
      ],
      nextTourStep: mockNextTourStep,
      endTour: mockEndTour,
    });

    render(<WalkthroughOverlay />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "walkthrough-step-title");

    const heading = screen.getByRole("heading", { name: /Welcome to YardWorx/i });
    expect(heading).toHaveAttribute("id", "walkthrough-step-title");

    const closeBtn = screen.getByRole("button", { name: /End tour/i });
    expect(closeBtn).toHaveAttribute("type", "button");

    const nextBtn = screen.getByRole("button", { name: /Next Step/i });
    expect(nextBtn).toHaveAttribute("type", "button");

    fireEvent.click(nextBtn);
    expect(mockNextTourStep).toHaveBeenCalledTimes(1);

    fireEvent.click(closeBtn);
    expect(mockEndTour).toHaveBeenCalledTimes(1);
  });

  it("closes the tour when the Escape key is pressed", () => {
    (CuttyGuideContext.useCuttyGuide as any).mockReturnValue({
      activeFocus: {
        id: "step-1",
        label: "Welcome to YardWorx",
        description: "Tour step details.",
        rect: { left: 50, top: 50, width: 100, height: 50, right: 150, bottom: 100 },
      },
      isTourActive: true,
      currentTourStep: 0,
      tourSteps: [{ id: "step-1" }],
      nextTourStep: mockNextTourStep,
      endTour: mockEndTour,
    });

    render(<WalkthroughOverlay />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(mockEndTour).toHaveBeenCalledTimes(1);
  });
});
