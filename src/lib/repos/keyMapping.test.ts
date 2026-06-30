import { describe, it, expect } from "vitest";
import { toCamelKey, toSnakeKey } from "./base";

// The repo layer maps snake_case columns <-> camelCase app fields on every read/write.
// It MUST round-trip, or writes silently land in the wrong (or a non-existent) column.

describe("toCamelKey", () => {
  it("maps snake_case to camelCase", () => {
    expect(toCamelKey("created_at")).toBe("createdAt");
    expect(toCamelKey("tenant_id")).toBe("tenantId");
    expect(toCamelKey("customer_id")).toBe("customerId");
    expect(toCamelKey("address_line_2")).toBe("addressLine2");
    expect(toCamelKey("week_1_total")).toBe("week1Total");
    expect(toCamelKey("name")).toBe("name");
  });
});

describe("toSnakeKey", () => {
  it("maps camelCase to snake_case", () => {
    expect(toSnakeKey("createdAt")).toBe("created_at");
    expect(toSnakeKey("tenantId")).toBe("tenant_id");
    expect(toSnakeKey("dueDate")).toBe("due_date");
    expect(toSnakeKey("name")).toBe("name");
  });

  it("inserts an underscore before a digit that follows a letter (regression)", () => {
    // The old version produced address_line2 / week1_total — wrong columns, silent data loss.
    expect(toSnakeKey("addressLine2")).toBe("address_line_2");
    expect(toSnakeKey("week1Total")).toBe("week_1_total");
    expect(toSnakeKey("stage2At")).toBe("stage_2_at");
    expect(toSnakeKey("line1")).toBe("line_1");
  });
});

describe("round-trip (snake -> camel -> snake) is stable", () => {
  const columns = [
    "created_at",
    "tenant_id",
    "customer_id",
    "due_date",
    "is_archived",
    "storage_path",
    "size_bytes",
    "firebase_uid",
    "epa_reg_number",
    "service_interval_hours",
    "address_line_2",
    "line_1",
    "week_1_total",
    "stage_2_at",
    "name",
  ];
  it.each(columns)('"%s" survives the round-trip', (col) => {
    expect(toSnakeKey(toCamelKey(col))).toBe(col);
  });
});
