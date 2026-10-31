import { describe, expect, it } from "vitest";

import { parishDesignation } from "@/lib/admin-worker/extractors";
import { parishSchema, PARISH_DESIGNATIONS } from "@/lib/checklist/schemas/parish";
import { toChecklistContentType } from "@/lib/admin-worker/classifier";

describe("parish content type", () => {
  it("is a publishable catalog type", () => {
    expect(toChecklistContentType("PARISH")).toBe("PARISH");
    expect(parishSchema.contentType).toBe("PARISH");
  });

  it("classifies the designation from the name/text", () => {
    expect(parishDesignation("Basilica of the National Shrine", "")).toBe("minor-basilica");
    expect(parishDesignation("Major Basilica of St. Peter", "")).toBe("major-basilica");
    expect(parishDesignation("Cathedral of the Holy Cross", "")).toBe("cathedral");
    expect(parishDesignation("Shrine of Our Lady", "")).toBe("shrine");
    expect(parishDesignation("St. Patrick Catholic Church", "A parish in the city.")).toBe(
      "parish",
    );
  });

  it("only allows the seven canonical designations", () => {
    expect([...PARISH_DESIGNATIONS]).toEqual([
      "parish",
      "chapel",
      "shrine",
      "cathedral",
      "major-basilica",
      "minor-basilica",
      "oratory",
    ]);
  });

  it("validates a complete parish record and rejects an incomplete one", () => {
    const ok = parishSchema.schema.safeParse({
      slug: "st-patrick",
      title: "St. Patrick Catholic Church",
      address: "123 Main Street",
      city: "Springfield",
      designation: "parish",
      citations: ["https://diocese.example/parishes/st-patrick"],
    });
    expect(ok.success).toBe(true);

    const bad = parishSchema.schema.safeParse({
      slug: "x",
      title: "x",
      city: "Springfield",
      citations: [],
    });
    expect(bad.success).toBe(false);
  });

  it("stores a short postal code and the chapel designation", () => {
    const base = {
      slug: "kapelle-st-georg",
      title: "Kapelle St. Georg",
      latitude: 46.71,
      longitude: 9.15,
      citations: ["https://www.openstreetmap.org/way/698048027"],
    };
    expect(
      parishSchema.schema.safeParse({ ...base, designation: "chapel", postalCode: "7134" }).success,
    ).toBe(true);
    expect(parishSchema.schema.safeParse({ ...base, postalCode: "" }).success).toBe(false);
    expect(parishSchema.schema.safeParse({ ...base, postalCode: "x".repeat(17) }).success).toBe(
      false,
    );
    expect(parishSchema.instruction.optionalFields).toContain("postalCode");
  });
});
