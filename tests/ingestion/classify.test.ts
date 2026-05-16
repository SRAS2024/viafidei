import { describe, expect, it } from "vitest";
import { classifyIngestedItem } from "@/lib/ingestion/classify";
import type {
  IngestedApparition,
  IngestedItem,
  IngestedPrayer,
  IngestedSaint,
} from "@/lib/ingestion/types";

describe("classifyIngestedItem", () => {
  it("keeps a well-shaped prayer in the prayer bucket", () => {
    const item: IngestedPrayer = {
      kind: "prayer",
      slug: "hail-mary",
      defaultTitle: "Hail Mary",
      category: "Marian",
      body: "Hail Mary, full of grace, the Lord is with thee. Holy Mary, Mother of God, pray for us. Amen.",
    };
    const result = classifyIngestedItem(item);
    expect(result.newKind).toBe("prayer");
    expect(result.originalKind).toBe("prayer");
  });

  it("re-routes a misclassified 'prayer' that is actually a saint biography", () => {
    const item: IngestedPrayer = {
      kind: "prayer",
      slug: "padre-pio",
      defaultTitle: "Padre Pio",
      category: "Devotional",
      body: "Saint Padre Pio was born in 1887 in Pietrelcina, Italy. He was ordained a priest in 1910 and entered the Capuchin order. He died in 1968 and was canonized by Pope John Paul II. He is the patron saint of stress relief.",
    };
    const result = classifyIngestedItem(item);
    expect(result.newKind).toBe("saint");
    expect(result.item.kind).toBe("saint");
    if (result.item.kind === "saint") {
      expect(result.item.canonicalName).toBe("Padre Pio");
      expect(result.item.biography).toContain("born in 1887");
    }
  });

  it("re-routes a misclassified 'saint' that is actually an apparition page", () => {
    const item: IngestedSaint = {
      kind: "saint",
      slug: "our-lady-of-lourdes",
      canonicalName: "Our Lady of Lourdes",
      patronages: [],
      biography:
        "Our Lady appeared eighteen times to Bernadette Soubirous at Lourdes, France in 1858. The Blessed Virgin Mary identified herself as the Immaculate Conception. The apparitions were declared worthy of belief.",
    };
    const result = classifyIngestedItem(item);
    expect(result.newKind).toBe("apparition");
    if (result.item.kind === "apparition") {
      expect(result.item.title).toBe("Our Lady of Lourdes");
      expect(result.item.summary).toContain("Bernadette");
    }
  });

  it("never re-routes a parish (parishes have a structurally different shape)", () => {
    const item: IngestedItem = {
      kind: "parish",
      slug: "saint-patricks-cathedral",
      name: "Saint Patrick's Cathedral",
      address: "5th Avenue, New York, NY 10022, USA",
    };
    const result = classifyIngestedItem(item);
    expect(result.newKind).toBe("parish");
  });

  it("does not re-route on a close call — gap must be meaningful", () => {
    // Body contains exactly one prayer marker AND one saint marker; the
    // classifier should keep the original kind rather than flip on noise.
    const item: IngestedPrayer = {
      kind: "prayer",
      slug: "test",
      defaultTitle: "Test",
      category: "General",
      body: "Saint and pray are mentioned but neither dominates. Amen.",
    };
    const result = classifyIngestedItem(item);
    expect(result.newKind).toBe("prayer");
  });

  it("re-routes a vague 'devotion' adapter output into apparition when Marian markers dominate", () => {
    const item: IngestedApparition = {
      kind: "apparition",
      slug: "marian-vision",
      title: "Our Lady of Guadalupe",
      approvedStatus: "Approved",
      summary:
        "Our Lady appeared to Juan Diego at Tepeyac in 1531. The Blessed Virgin Mary asked for a church. The apparition is approved by the Holy See.",
    };
    const result = classifyIngestedItem(item);
    expect(result.newKind).toBe("apparition");
  });
});
