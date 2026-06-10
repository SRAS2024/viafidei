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
    // Litanies are their own category (the /litanies tab), not "liturgical".
    expect(categorizePrayer({ title: "Litany of the Saints" })).toBe("litany");
    expect(categorizePrayer({ title: "Litany of Loreto" })).toBe("litany");
    expect(
      categorizePrayer({
        title: "Litany of the Sacred Heart",
        body: "Heart of Jesus, have mercy on us",
      }),
    ).toBe("litany");
    // Te Deum is still liturgical, not a litany.
    expect(categorizePrayer({ title: "Te Deum" })).toBe("liturgical");
    expect(
      categorizePrayer({ title: "Sign of the Cross", body: "In the name of the Father" }),
    ).toBe("general");
  });

  it("respects prayerType hints", () => {
    expect(categorizePrayer({ title: "x", prayerType: "marian" })).toBe("marian");
    expect(categorizePrayer({ title: "x", prayerType: "consecration" })).toBe("consecration");
    expect(categorizePrayer({ title: "x", prayerType: "novena" })).toBe("novena");
    expect(categorizePrayer({ title: "x", prayerType: "chaplet" })).toBe("chaplet");
  });

  it("categorises the expanded set (Trinitarian, chaplet, consecration, novena, saint-related)", () => {
    expect(PRAYER_CATEGORIES.map((c) => c.value)).toEqual(
      expect.arrayContaining(["trinitarian", "saintly", "novena", "chaplet", "consecration"]),
    );
    expect(categorizePrayer({ title: "Glory Be", body: "Glory be to the Father" })).toBe(
      "trinitarian",
    );
    expect(categorizePrayer({ title: "The Divine Mercy Chaplet" })).toBe("chaplet");
    expect(categorizePrayer({ title: "Act of Consecration to the Sacred Heart" })).toBe(
      "consecration",
    );
    expect(categorizePrayer({ title: "Novena to St. Jude" })).toBe("novena");
    expect(categorizePrayer({ title: "Prayer to St. Joseph" })).toBe("saintly");
    expect(prayerCategoryLabel("saintly")).toBe("Saint-related");
  });

  it("prefers an already-canonical stored category over derivation", () => {
    // Stored "angelic" wins even though the text looks Marian.
    expect(categorizePrayer({ title: "Hail Mary", body: "Holy Mary", category: "angelic" })).toBe(
      "angelic",
    );
    // A non-canonical stored category ("PRAYER") is ignored and derived.
    expect(categorizePrayer({ title: "The Memorare", category: "PRAYER" })).toBe("marian");
  });

  it("classifies litanies as litany even when the stored category is a canonical theme", () => {
    // Regression: the Litany of the BVM's stored category is "marian" and the
    // Litany of Humility's is "general" — both canonical. The stored-category
    // shortcut used to hijack them into their theme, so the /litanies tab showed
    // only the litanies whose theme was NOT canonical (2 of 4). Litanies must
    // take priority over the stored category.
    expect(
      categorizePrayer({
        title: "Litany of the Blessed Virgin Mary",
        prayerType: "litany",
        category: "marian",
      }),
    ).toBe("litany");
    expect(
      categorizePrayer({
        title: "Litany of Humility",
        prayerType: "litany",
        category: "general",
      }),
    ).toBe("litany");
    // Detected by title too, even with a canonical stored category.
    expect(categorizePrayer({ title: "Litany of the Sacred Heart", category: "general" })).toBe(
      "litany",
    );
  });
});
