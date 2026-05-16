import { describe, expect, it } from "vitest";
import { validateRosaryPackage } from "@/lib/content-qa/contracts/rosary";
import { staticPurposesForHost } from "@/lib/content-qa/source-purpose";

const EWTN = staticPurposesForHost("ewtn.com");

function fullMysteries() {
  const make = (name: string) => ({
    name,
    mysteries: Array.from({ length: 5 }).map((_, i) => ({
      name: `${name} ${i + 1}`,
      order: i + 1,
    })),
  });
  return [make("Joyful Mysteries"), make("Sorrowful Mysteries"), make("Glorious Mysteries")];
}

describe("RosaryPackage contract", () => {
  it("accepts a full Rosary structure", () => {
    const result = validateRosaryPackage(
      {
        contentType: "Rosary",
        slug: "how-to-pray-the-rosary",
        title: "How to Pray the Rosary",
        sourceUrl: "https://www.ewtn.com/rosary",
        sourceHost: "ewtn.com",
        payload: {
          title: "How to Pray the Rosary",
          background: "The Rosary is a Marian prayer that has been prayed for centuries.",
          howToPray:
            "Make the Sign of the Cross. Recite the Apostles' Creed. Pray the Our Father. Hail Mary three times. Glory Be. Hail Holy Queen at the end.",
          openingPrayers: [
            "Sign of the Cross",
            "Apostles' Creed",
            "Our Father",
            "Hail Mary",
            "Glory Be",
          ],
          mysterySets: fullMysteries(),
          decadeStructure: "Each decade: 1 Our Father, 10 Hail Marys, 1 Glory Be.",
          closingPrayers: ["Hail Holy Queen"],
        },
      },
      { sourcePurposes: EWTN },
    );
    expect(result.decision).toBe("publish");
  });

  it("rejects a Rosary missing mysteries", () => {
    const result = validateRosaryPackage(
      {
        contentType: "Rosary",
        slug: "incomplete-rosary",
        title: "Incomplete Rosary",
        sourceUrl: "https://www.ewtn.com/rosary",
        sourceHost: "ewtn.com",
        payload: {
          title: "Incomplete Rosary",
          background: "Background.",
          howToPray:
            "Make the Sign of the Cross. Recite the Apostles' Creed. Our Father. Hail Mary. Glory Be. Hail Holy Queen.",
          openingPrayers: [
            "Sign of the Cross",
            "Apostles' Creed",
            "Our Father",
            "Hail Mary",
            "Glory Be",
            "Hail Holy Queen",
          ],
          mysterySets: [],
          decadeStructure: "Each decade.",
          closingPrayers: [],
        },
      },
      { sourcePurposes: EWTN },
    );
    expect(result.decision).toBe("reject");
    expect(result.failedFields).toContain("mysterySets");
  });

  it("rejects a Rosary missing core prayers", () => {
    const result = validateRosaryPackage(
      {
        contentType: "Rosary",
        slug: "no-core",
        title: "No Core Prayers Rosary",
        sourceUrl: "https://www.ewtn.com/rosary",
        sourceHost: "ewtn.com",
        payload: {
          title: "No Core Prayers Rosary",
          background: "Background.",
          howToPray: "Just say things.",
          openingPrayers: [],
          mysterySets: fullMysteries(),
          decadeStructure: "Each decade.",
          closingPrayers: [],
        },
      },
      { sourcePurposes: EWTN },
    );
    expect(result.decision).toBe("reject");
  });

  it("deletes a Rosary livestream", () => {
    const result = validateRosaryPackage(
      {
        contentType: "Rosary",
        slug: "rosary-live",
        title: "Live Rosary on YouTube",
        sourceUrl: "https://www.ewtn.com/live",
        sourceHost: "ewtn.com",
        payload: {
          title: "Live Rosary on YouTube",
          background: "Watch live every Sunday. Stream from EWTN. Watch on YouTube.",
          howToPray: "Click here to watch live.",
          openingPrayers: [
            "Sign of the Cross",
            "Apostles' Creed",
            "Our Father",
            "Hail Mary",
            "Glory Be",
            "Hail Holy Queen",
          ],
          mysterySets: fullMysteries(),
          decadeStructure: "Each decade.",
          closingPrayers: [],
        },
      },
      { sourcePurposes: EWTN },
    );
    expect(result.decision).toBe("delete");
  });
});
