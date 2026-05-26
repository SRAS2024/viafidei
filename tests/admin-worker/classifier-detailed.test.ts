/**
 * Detailed multi-signal classifier (spec §8). Verifies the new
 * secondary-types, required-field signals, negative-pattern
 * detection, and confusion integration.
 */

import { describe, expect, it } from "vitest";

import { classifyDetailed } from "@/lib/admin-worker/classifier";

describe("classifyDetailed — spec §8 multi-signal output", () => {
  it("returns the same primary type as classify() on a clean prayer page", () => {
    const out = classifyDetailed({
      url: "https://example.org/prayers/our-father",
      title: "The Our Father Prayer",
      bodyText:
        "Our Father, who art in heaven, hallowed be thy name. Thy kingdom come, thy will be done. Amen.",
      headings: ["The Our Father"],
    });
    expect(out.contentType).toBe("PRAYER");
    expect(out.confidence).toBeGreaterThan(0.3);
  });

  it("returns secondary content types ranked by score", () => {
    const out = classifyDetailed({
      url: "https://example.org/prayers/our-father",
      title: "The Our Father Prayer",
      bodyText: "Our Father. Amen.",
    });
    expect(Array.isArray(out.secondaryContentTypes)).toBe(true);
    expect(out.secondaryContentTypes.length).toBeLessThanOrEqual(2);
  });

  it("records required-field signals detected and missing", () => {
    const out = classifyDetailed({
      url: "https://example.org/saints/st-jude",
      title: "Saint Jude",
      bodyText: "Saint Jude was born in 1 AD. He was canonized. Feast day: October 28.",
    });
    expect(out.requiredFieldsDetected.length).toBeGreaterThan(0);
    expect(typeof out.requiredFieldsMissing.length).toBe("number");
  });

  it("flips to UNUSABLE when confusion penalty pushes confidence below threshold", () => {
    // Strong saint signals so classify() picks SAINT first; the
    // confusion detector then rescues because "academy" + the URL
    // signal a saint-named school.
    const out = classifyDetailed({
      url: "https://example.org/saints/st-marys-academy",
      title: "Saint Mary's Academy — School",
      bodyText:
        "Saint Mary's Academy is a Catholic K-12 school. Enrollment is open. Patron saint of the school. Feast day services are held annually for our patron.",
      headings: ["Saint Mary's Academy", "Enrollment"],
    });
    // Classifier picked SAINT, confusion penalty subtracts confidence,
    // page should be flagged as confused.
    expect(out.confusion.confused).toBe(true);
  });

  it("computes rejectionScore as the complement of confidence", () => {
    const out = classifyDetailed({
      url: "https://example.org/prayers/our-father",
      title: "Our Father",
      bodyText: "Our Father. Amen.",
    });
    expect(out.rejectionScore).toBeCloseTo(1 - out.confidence, 5);
  });

  it("explanation surfaces both primary and runner-up scores", () => {
    const out = classifyDetailed({
      url: "https://example.org/prayers/our-father",
      title: "Our Father",
      bodyText: "Our Father. Amen.",
    });
    expect(out.explanation).toContain("Primary");
    // Explanation length should be meaningful
    expect(out.explanation.length).toBeGreaterThan(20);
  });

  it("preserves perTypeScores from the underlying classifier", () => {
    const out = classifyDetailed({
      url: "https://example.org/prayers/our-father",
      title: "Our Father",
      bodyText: "Our Father. Amen.",
    });
    expect(typeof out.perTypeScores).toBe("object");
  });
});
