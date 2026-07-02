import { describe, it, expect } from "vitest";
import { csvCell, csvRow, toCsv } from "./csv";

describe("csvCell", () => {
  it("quotes plain values", () => {
    expect(csvCell("hello")).toBe('"hello"');
  });

  it("doubles internal quotes", () => {
    expect(csvCell('she said "hi"')).toBe('"she said ""hi"""');
  });

  it("keeps commas/newlines inside the quoted field (no structure break)", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralizes formula-injection leads with a single quote", () => {
    expect(csvCell("=WEBSERVICE(1)")).toBe('"\'=WEBSERVICE(1)"');
    expect(csvCell("+1")).toBe('"\'+1"');
    expect(csvCell("-1+2")).toBe('"\'-1+2"');
    expect(csvCell("@SUM(A1)")).toBe('"\'@SUM(A1)"');
    expect(csvCell("\tstartsWithTab")).toBe('"\'\tstartsWithTab"');
  });

  it("does NOT prefix a normal number or text", () => {
    expect(csvCell("42")).toBe('"42"');
    expect(csvCell("Bob")).toBe('"Bob"');
  });

  it("blocks the classic quote-breakout + formula combo", () => {
    // A cell trying to break out and inject a formula stays fully contained + neutralized.
    const evil = '=1+1"),cmd|"/C calc"!A0';
    const out = csvCell(evil);
    expect(out.startsWith('"\'=')).toBe(true); // formula neutralized
    expect(out.endsWith('"')).toBe(true); // still one quoted field
    // internal quotes doubled -> no premature field termination
    expect(out.slice(1, -1).includes('""')).toBe(true);
  });

  it("handles null/undefined as empty", () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });
});

describe("csvRow / toCsv", () => {
  it("joins escaped fields with commas", () => {
    expect(csvRow(["a", "b,c", "=d"])).toBe('"a","b,c","\'=d"');
  });

  it("builds a CRLF document with a header", () => {
    const doc = toCsv(["Name", "Note"], [["Bob", "hi"], ["=Al", "x,y"]]);
    expect(doc).toBe('"Name","Note"\r\n"Bob","hi"\r\n"\'=Al","x,y"');
  });
});
