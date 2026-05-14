import { describe, expect, it } from "vitest";
import {
  categorizePrayer,
  PRAYER_CATEGORY_ORDER,
} from "@/lib/ingestion/sources/categorize";

describe("categorizePrayer", () => {
  it("trusts explicit recognised categories from the seed", () => {
    expect(categorizePrayer({ title: "Anything", body: "", category: "Marian" })).toBe("Marian");
    expect(categorizePrayer({ title: "Anything", body: "", category: "Litany" })).toBe("Litany");
    expect(categorizePrayer({ title: "Anything", body: "", category: "Rosary" })).toBe("Rosary");
  });

  it("maps legacy aliases onto the canonical bucket", () => {
    expect(categorizePrayer({ title: "x", body: "", category: "Trinitarian" })).toBe(
      "Traditional",
    );
    expect(categorizePrayer({ title: "x", body: "", category: "Creedal" })).toBe("Traditional");
    expect(categorizePrayer({ title: "x", body: "", category: "Penitential" })).toBe(
      "Sacramental",
    );
  });

  it("classifies Marian prayers by title", () => {
    expect(categorizePrayer({ title: "Hail Mary", body: "Hail Mary, full of grace" })).toBe(
      "Marian",
    );
    expect(categorizePrayer({ title: "Memorare", body: "Remember, O most gracious Virgin" })).toBe(
      "Marian",
    );
    expect(categorizePrayer({ title: "Sub Tuum", body: "We fly to thy patronage" })).toBe("Marian");
  });

  it("classifies a Litany before a Marian bucket so 'Litany of Loreto' is a Litany", () => {
    expect(
      categorizePrayer({
        title: "Litany of the Blessed Virgin Mary",
        body: "Lord, have mercy. Christ, have mercy.",
      }),
    ).toBe("Litany");
  });

  it("classifies the Lord's Prayer as Dominical", () => {
    expect(
      categorizePrayer({ title: "Our Father", body: "Our Father, who art in heaven" }),
    ).toBe("Dominical");
  });

  it("classifies the Angel of God prayer as Angelic", () => {
    expect(
      categorizePrayer({ title: "Angel of God", body: "Angel of God, my guardian dear" }),
    ).toBe("Angelic");
  });

  it("classifies a Eucharistic prayer correctly", () => {
    expect(
      categorizePrayer({ title: "Anima Christi", body: "Soul of Christ, sanctify me" }),
    ).toBe("Eucharistic");
  });

  it("falls back to Traditional rather than Daily for ambiguous prayers", () => {
    expect(categorizePrayer({ title: "Sign of the Cross", body: "In the name of the Father" })).toBe(
      "Traditional",
    );
  });

  it("exports the canonical ordering used by the /prayers tabs", () => {
    expect(PRAYER_CATEGORY_ORDER.length).toBeGreaterThan(8);
    expect(PRAYER_CATEGORY_ORDER).toContain("Marian");
    expect(PRAYER_CATEGORY_ORDER).toContain("Rosary");
    expect(PRAYER_CATEGORY_ORDER).toContain("Litany");
    expect(PRAYER_CATEGORY_ORDER).toContain("Novena");
  });
});
