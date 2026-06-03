import { describe, expect, it } from "vitest";

import { parishDesignation } from "@/lib/admin-worker/extractors";
import { parishSchema, PARISH_DESIGNATIONS } from "@/lib/worker/schemas/parish";
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

  it("only allows the five canonical designations", () => {
    expect([...PARISH_DESIGNATIONS]).toEqual([
      "parish",
      "shrine",
      "cathedral",
      "major-basilica",
      "minor-basilica",
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
});
