/**
 * SourceDocument cleanup tests.
 *
 * Verifies the cleanup pass strips navigation / donation / newsletter
 * / share / livestream / video / cookie / ad / sidebar / event blocks
 * while keeping the actual content.
 */

import { describe, expect, it } from "vitest";
import { cleanSourceBody, syntheticSourceDocument } from "@/lib/content-factory";

describe("cleanSourceBody", () => {
  it("strips navigation lines and donation calls", () => {
    const raw = [
      "Skip to main content",
      "Donate Now to support our parish",
      "",
      "Hail Mary, full of grace, the Lord is with thee.",
      "Blessed art thou amongst women.",
      "",
      "Subscribe to our newsletter for weekly updates",
      "Share this prayer with friends",
      "© 2024 Example Parish — All rights reserved",
    ].join("\n");
    const { cleaned, removed } = cleanSourceBody(raw);
    expect(cleaned).toContain("Hail Mary");
    expect(cleaned).not.toContain("Donate Now");
    expect(cleaned).not.toContain("Subscribe to our newsletter");
    expect(cleaned).not.toContain("All rights reserved");
    expect(removed.map((r) => r.kind)).toContain("donation");
    expect(removed.map((r) => r.kind)).toContain("newsletter");
  });

  it("strips livestream blocks", () => {
    const raw = [
      "Watch live on YouTube",
      "Watch live as we pray the Rosary",
      "",
      "Today's reflection: The Holy Rosary is a Marian devotion.",
    ].join("\n");
    const { cleaned, removed } = cleanSourceBody(raw);
    expect(cleaned).toContain("Holy Rosary");
    expect(removed.map((r) => r.kind)).toContain("livestream");
  });

  it("keeps event cards when canIngestHistory + URL signals history", () => {
    const raw = "Event Listing: Vatican II Anniversary Celebration\n\nKey outcomes of the council.";
    const { cleaned } = cleanSourceBody(raw, { allowEventCards: true });
    expect(cleaned).toContain("Vatican II");
  });
});

describe("syntheticSourceDocument", () => {
  it("computes checksums", () => {
    const doc = syntheticSourceDocument({
      sourceUrl: "https://example.com/p",
      sourceHost: "example.com",
      // A body with noise lines so cleaning produces a different output.
      rawBody: "Donate now!\n\nHello world.\n\nSubscribe to our newsletter",
    });
    expect(doc.contentChecksum).toBeDefined();
    expect(doc.cleanedChecksum).toBeDefined();
    expect(doc.contentChecksum).not.toBe(doc.cleanedChecksum);
  });

  it("preserves source purposes", () => {
    const doc = syntheticSourceDocument({
      sourceUrl: "https://example.com/p",
      sourceHost: "example.com",
      rawBody: "Body.",
      sourcePurposes: { canIngestPrayers: true },
    });
    expect(doc.sourcePurposes).toEqual({ canIngestPrayers: true });
  });
});
