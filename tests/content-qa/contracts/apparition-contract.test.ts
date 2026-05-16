import { describe, expect, it } from "vitest";
import { validateApparitionPackage } from "@/lib/content-qa/contracts/apparition";
import { staticPurposesForHost } from "@/lib/content-qa/source-purpose";

const VATICAN = staticPurposesForHost("vatican.va");
const FATIMA = staticPurposesForHost("fatima.pt");

describe("MarianApparitionPackage contract", () => {
  it("accepts an actual apparition", () => {
    const result = validateApparitionPackage(
      {
        contentType: "MarianApparition",
        slug: "our-lady-of-fatima",
        title: "Our Lady of Fátima",
        sourceUrl: "https://www.fatima.pt/en",
        sourceHost: "fatima.pt",
        payload: {
          apparitionName: "Our Lady of Fátima",
          location: "Fátima",
          country: "Portugal",
          approvalStatus: "Approved",
          background:
            "Our Lady of Fátima appeared to three shepherd children — Lúcia, Francisco, and Jacinta — in Cova da Iria, Fátima, Portugal, beginning on May 13, 1917.",
          summary:
            "The Blessed Virgin Mary appeared six times between May and October 1917, leaving messages about prayer, penance, and the consecration of Russia.",
        },
      },
      { sourcePurposes: FATIMA },
    );
    expect(result.decision).toBe("publish");
  });

  it("deletes a travel page about visiting Lourdes", () => {
    const result = validateApparitionPackage(
      {
        contentType: "MarianApparition",
        slug: "visit-lourdes",
        title: "Visit Lourdes — Book Your Trip",
        sourceUrl: "https://www.vatican.va/travel",
        sourceHost: "vatican.va",
        payload: {
          apparitionName: "Visit Lourdes",
          location: "Lourdes",
          country: "France",
          approvalStatus: "Approved",
          background: "Book your trip to Lourdes today. Hotel deals available.",
          summary: "Plan your travel itinerary to the famous shrine.",
        },
      },
      { sourcePurposes: VATICAN },
    );
    expect(result.decision).toBe("delete");
  });

  it("deletes a tourism page", () => {
    const result = validateApparitionPackage(
      {
        contentType: "MarianApparition",
        slug: "guadalupe-tourism",
        title: "Tourism in Mexico City",
        sourceUrl: "https://www.vatican.va/tourism",
        sourceHost: "vatican.va",
        payload: {
          apparitionName: "Tourism Guide",
          location: "Mexico City",
          country: "Mexico",
          approvalStatus: "Approved",
          background:
            "Mexico City tourism guide. Book your tour package today. Many tourists visit Guadalupe.",
          summary: "Travel tips and tour packages for visiting the basilica.",
        },
      },
      { sourcePurposes: VATICAN },
    );
    expect(result.decision).toBe("delete");
  });

  it("deletes content that mentions Fatima but does not describe the apparition", () => {
    const result = validateApparitionPackage(
      {
        contentType: "MarianApparition",
        slug: "fatima-mention",
        title: "Some article",
        sourceUrl: "https://www.vatican.va/article",
        sourceHost: "vatican.va",
        payload: {
          apparitionName: "Some article mentioning Fatima",
          location: "Portugal",
          country: "Portugal",
          approvalStatus: "Approved",
          background:
            "The pope traveled to Fatima for an important visit in 2017 as part of his papal trip itinerary.",
          summary:
            "An article that briefly mentions Fatima as a destination but offers no actual content.",
        },
      },
      { sourcePurposes: VATICAN },
    );
    expect(result.decision).toBe("delete");
  });

  it("rejects an apparition missing location", () => {
    const result = validateApparitionPackage(
      {
        contentType: "MarianApparition",
        slug: "no-location",
        title: "Our Lady",
        sourceUrl: "https://www.vatican.va/our-lady",
        sourceHost: "vatican.va",
        payload: {
          apparitionName: "Our Lady",
          location: "",
          country: "Portugal",
          approvalStatus: "Approved",
          background: "Our Lady appeared and asked for prayer.",
          summary: "A Marian apparition.",
        },
      },
      { sourcePurposes: VATICAN },
    );
    expect(result.decision).toBe("reject");
    expect(result.failedFields).toContain("location");
  });

  it("rejects an apparition missing background", () => {
    const result = validateApparitionPackage(
      {
        contentType: "MarianApparition",
        slug: "no-bg",
        title: "Our Lady",
        sourceUrl: "https://www.vatican.va/our-lady",
        sourceHost: "vatican.va",
        payload: {
          apparitionName: "Our Lady",
          location: "Somewhere",
          country: "Country",
          approvalStatus: "Approved",
          background: "",
          summary: "Apparition summary placeholder.",
        },
      },
      { sourcePurposes: VATICAN },
    );
    expect(result.decision).toBe("reject");
    expect(result.failedFields).toContain("background");
  });
});
