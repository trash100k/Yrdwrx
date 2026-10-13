import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import BarcodeScanner from "./BarcodeScanner";

vi.mock("html5-qrcode", () => ({
  Html5QrcodeScanner: class {
    render() {}
    clear() {
      return Promise.resolve();
    }
  },
}));

describe("BarcodeScanner", () => {
  it("renders with role='region' and aria-label='Barcode scanner'", () => {
    render(<BarcodeScanner onScanSuccess={vi.fn()} />);
    const region = screen.getByRole("region", { name: "Barcode scanner" });
    expect(region).toBeInTheDocument();
  });
});
