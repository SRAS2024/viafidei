import { describe, expect, it } from "vitest";
import { DATA_MANAGEMENT_ACTIONS, dataManagementActionLabel } from "@/lib/data/data-management-log";

describe("dataManagementActionLabel", () => {
  it("returns a human label for every canonical action", () => {
    for (const a of DATA_MANAGEMENT_ACTIONS) {
      expect(dataManagementActionLabel(a)).not.toBe(a);
      expect(dataManagementActionLabel(a).length).toBeGreaterThan(2);
    }
  });

  it("falls back to the raw action when unknown", () => {
    expect(dataManagementActionLabel("UNKNOWN_ACTION")).toBe("UNKNOWN_ACTION");
  });
});

describe("DATA_MANAGEMENT_ACTIONS", () => {
  it("covers the full set of action categories", () => {
    expect(DATA_MANAGEMENT_ACTIONS).toEqual([
      "ADD",
      "UPDATE",
      "DELETE",
      "REJECT",
      "CLEANUP",
      "DEDUPE",
      "CATEGORY_FIX",
      "FAIL",
      "PURGE",
    ]);
  });
});
