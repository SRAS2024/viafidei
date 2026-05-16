import { describe, expect, it } from "vitest";
import { validateSpiritualGuidancePackage } from "@/lib/content-qa/contracts/spiritual-guidance";
import { staticPurposesForHost } from "@/lib/content-qa/source-purpose";

const EWTN = staticPurposesForHost("ewtn.com");

function buildSteps(count: number) {
  return Array.from({ length: count }).map((_, i) => ({
    order: i + 1,
    title: `Step ${i + 1}`,
    body: `Examine your conscience. Catholic teaching says to confess your sins. Pray for mercy.`,
  }));
}

describe("SpiritualGuidancePackage contract", () => {
  it("accepts an ordered practical Catholic guide", () => {
    const result = validateSpiritualGuidancePackage(
      {
        contentType: "SpiritualGuidance",
        slug: "examination-of-conscience",
        title: "Examination of Conscience",
        sourceUrl: "https://www.ewtn.com/examination",
        sourceHost: "ewtn.com",
        payload: {
          guideType: "Examination of conscience",
          guideName: "Examination of Conscience",
          background:
            "A guide for examining your conscience before going to confession. Christ calls us to repent.",
          practicalPurpose: "To prepare for the sacrament of Reconciliation.",
          steps: buildSteps(5),
        },
      },
      { sourcePurposes: EWTN },
    );
    expect(result.decision).toBe("publish");
  });

  it("rejects a motivational article-only piece (no steps)", () => {
    const result = validateSpiritualGuidancePackage(
      {
        contentType: "SpiritualGuidance",
        slug: "be-inspired",
        title: "Be Inspired",
        sourceUrl: "https://www.ewtn.com/inspired",
        sourceHost: "ewtn.com",
        payload: {
          guideType: "Prayer routine",
          guideName: "Be Inspired",
          background: "Catholic inspirational thoughts.",
          practicalPurpose: "To inspire you.",
          steps: [],
        },
      },
      { sourcePurposes: EWTN },
    );
    expect(result.decision).toBe("reject");
    expect(result.failedFields).toContain("steps");
  });

  it("rejects a guide with no steps", () => {
    const result = validateSpiritualGuidancePackage(
      {
        contentType: "SpiritualGuidance",
        slug: "no-steps",
        title: "Adoration Guide",
        sourceUrl: "https://www.ewtn.com/adoration",
        sourceHost: "ewtn.com",
        payload: {
          guideType: "Adoration guide",
          guideName: "Adoration Guide",
          background: "Catholic adoration of the Eucharist.",
          practicalPurpose: "To make a holy hour.",
          steps: [],
        },
      },
      { sourcePurposes: EWTN },
    );
    expect(result.decision).toBe("reject");
  });

  it("deletes a retreat advertisement", () => {
    const result = validateSpiritualGuidancePackage(
      {
        contentType: "SpiritualGuidance",
        slug: "spiritual-retreat-2026",
        title: "Spiritual Retreat 2026",
        sourceUrl: "https://www.ewtn.com/retreat",
        sourceHost: "ewtn.com",
        payload: {
          guideType: "Retreat at home guide",
          guideName: "Spiritual Retreat 2026",
          background:
            "Join us for our weekend retreat. Register now! Tickets available. Click here to RSVP.",
          practicalPurpose: "Advertise the retreat.",
          steps: buildSteps(3),
        },
      },
      { sourcePurposes: EWTN },
    );
    expect(result.decision).toBe("delete");
  });

  it("deletes a parish event", () => {
    const result = validateSpiritualGuidancePackage(
      {
        contentType: "SpiritualGuidance",
        slug: "parish-event",
        title: "Parish Spiritual Event",
        sourceUrl: "https://www.ewtn.com/event",
        sourceHost: "ewtn.com",
        payload: {
          guideType: "Prayer routine",
          guideName: "Parish Spiritual Event",
          background:
            "Join us for our parish event. Register now. Tickets available. Click here to RSVP to our event.",
          practicalPurpose: "Parish event.",
          steps: buildSteps(3),
        },
      },
      { sourcePurposes: EWTN },
    );
    expect(result.decision).toBe("delete");
  });
});
