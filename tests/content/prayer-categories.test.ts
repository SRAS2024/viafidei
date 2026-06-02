import { describe, expect, it } from "vitest";

import {
  PRAYER_CATEGORIES,
  categorizePrayer,
  prayerCategoryLabel,
} from "@/lib/content-shared/prayer-categories";

describe("prayer categorisation (drives the /prayers filter)", () => {
  it("exposes the canonical categories with labels", () => {
    expect(PRAYER_CATEGORIES.map((c) => c.value)).toContain("marian");
    expect(PRAYER_CATEGORIES.map((c) => c.value)).toContain("angelic");
    expect(PRAYER_CATEGORIES.map((c) => c.value)).toContain("liturgical");
    expect(prayerCategoryLabel("marian")).toBe("Marian");
    expect(prayerCategoryLabel("unknown")).toBe("General");
  });

  it("categorises by title/text keywords", () => {
    expect(
      categorizePrayer({ title: "The Memorare", body: "Remember, O most gracious Virgin Mary" }),
    ).toBe("marian");
    expect(categorizePrayer({ title: "Prayer to St. Michael the Archangel" })).toBe("angelic");
    expect(categorizePrayer({ title: "Anima Christi", body: "Soul of Christ" })).toBe(
      "eucharistic",
    );
    expect(categorizePrayer({ title: "Act of Contrition" })).toBe("penitential");
    expect(categorizePrayer({ title: "Litany of the Saints" })).toBe("liturgical");
    expect(
      categorizePrayer({ title: "Sign of the Cross", body: "In the name of the Father" }),
    ).toBe("general");
  });

  it("respects prayerType hints", () => {
    expect(categorizePrayer({ title: "x", prayerType: "marian" })).toBe("marian");
    expect(categorizePrayer({ title: "x", prayerType: "consecration" })).toBe("devotional");
  });

  it("prefers an already-canonical stored category over derivation", () => {
    // Stored "angelic" wins even though the text looks Marian.
    expect(categorizePrayer({ title: "Hail Mary", body: "Holy Mary", category: "angelic" })).toBe(
      "angelic",
    );
    // A non-canonical stored category ("PRAYER") is ignored and derived.
    expect(categorizePrayer({ title: "The Memorare", category: "PRAYER" })).toBe("marian");
  });
});
