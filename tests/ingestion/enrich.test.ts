import { describe, expect, it } from "vitest";
import { enrichIngestedItem } from "@/lib/ingestion/enrich";
import type {
  IngestedApparition,
  IngestedDevotion,
  IngestedParish,
  IngestedPrayer,
  IngestedSaint,
} from "@/lib/ingestion/types";

describe("enrichIngestedItem", () => {
  it("fills missing prayer category from body keywords", () => {
    const item: IngestedPrayer = {
      kind: "prayer",
      slug: "hail-mary",
      defaultTitle: "Hail Mary",
      category: "",
      body: "Hail Mary, full of grace, the Lord is with thee. Holy Mary, Mother of God, pray for us sinners. Amen.",
    };
    const out = enrichIngestedItem(item) as IngestedPrayer;
    expect(out.category.length).toBeGreaterThan(0);
  });

  it("extracts patronages from saint biography when missing", () => {
    const item: IngestedSaint = {
      kind: "saint",
      slug: "francis-of-assisi",
      canonicalName: "Saint Francis of Assisi",
      patronages: [],
      biography:
        "Saint Francis of Assisi (1181-1226) is the patron of animals, ecology, and Italy. He founded the Franciscan order.",
    };
    const out = enrichIngestedItem(item) as IngestedSaint;
    expect(out.patronages).toEqual(expect.arrayContaining(["animals", "ecology", "Italy"]));
  });

  it("parses saint feast day from biography", () => {
    const item: IngestedSaint = {
      kind: "saint",
      slug: "francis-of-assisi",
      canonicalName: "Saint Francis of Assisi",
      patronages: ["animals"],
      biography: "His feast day is October 4. He was born in 1181 in Assisi.",
    };
    const out = enrichIngestedItem(item) as IngestedSaint;
    expect(out.feastDay).toBe("October 4");
    expect(out.feastMonth).toBe(10);
    expect(out.feastDayOfMonth).toBe(4);
  });

  it("fills apparition location + country + status from named site", () => {
    const item: IngestedApparition = {
      kind: "apparition",
      slug: "our-lady-of-lourdes",
      title: "Our Lady of Lourdes",
      approvedStatus: "",
      summary: "Our Lady appeared at Lourdes to Bernadette Soubirous in 1858.",
    };
    const out = enrichIngestedItem(item) as IngestedApparition;
    expect(out.location).toBe("Lourdes");
    expect(out.country).toBe("France");
    expect(out.approvedStatus).toBe("Approved");
  });

  it("defaults approvedStatus to 'Pending' when no named site is recognised", () => {
    const item: IngestedApparition = {
      kind: "apparition",
      slug: "private-vision",
      title: "An Unknown Marian Vision",
      approvedStatus: "",
      summary: "Our Lady appeared in a small Italian village in the nineteenth century.",
    };
    const out = enrichIngestedItem(item) as IngestedApparition;
    expect(out.approvedStatus).toBe("Pending");
  });

  it("infers devotion duration from type", () => {
    const item: IngestedDevotion = {
      kind: "devotion",
      slug: "rosary-practice",
      title: "How to pray the Rosary",
      summary: "The Rosary is a Marian devotion centered on the mysteries of Christ.",
    };
    const out = enrichIngestedItem(item) as IngestedDevotion;
    expect(out.durationMinutes).toBe(20);
  });

  it("infers parish city + region + country from address", () => {
    const item: IngestedParish = {
      kind: "parish",
      slug: "saint-patricks-cathedral",
      name: "Saint Patrick's Cathedral",
      address: "5th Avenue, New York, NY 10022",
      externalSourceKey: "https://archny.org/parishes/saint-patricks",
    };
    const out = enrichIngestedItem(item) as IngestedParish;
    expect(out.city).toBe("New York");
    expect(out.region).toBe("NY");
    expect(out.country).toBe("USA");
    expect(out.diocese).toBe("Archdiocese of New York");
  });
});
