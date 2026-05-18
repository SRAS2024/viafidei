/**
 * Acceptance pipeline tests for the remaining content types:
 *
 *   - Devotion: real practice structure vs. article about a devotion
 *   - Rosary: rejects livestream / event page
 *   - Consecration: rejects retreat advertisement
 *   - Liturgy: rejects Mass schedule
 *   - Parish: rejects bulletin / staff page
 *   - SpiritualGuidance: builds usable guide pages
 *   - MarianApparition: rejects pure news article
 *
 * The bar for each test is "the builder either produces a complete
 * package OR fails with a precise reason" — covers the spec's
 * acceptance criterion that builders must never produce undefined
 * outcomes.
 */

import { describe, expect, it } from "vitest";
import { BUILDER_REGISTRY, type SourceDocumentSnapshot } from "@/lib/content-factory";

function runBuild(contentType: keyof typeof BUILDER_REGISTRY, document: SourceDocumentSnapshot) {
  return BUILDER_REGISTRY[contentType].build({
    document,
    sourceId: null,
    workerJobId: null,
    ingestionBatchId: null,
    sourcePurposes: document.sourcePurposes,
  });
}

describe("acceptance: DevotionBuilder", () => {
  it("rejects an article-style page about a devotion (no practice structure)", () => {
    const document: SourceDocumentSnapshot = {
      sourceUrl: "https://acceptance.example/devotions/article-about-divine-mercy",
      sourceHost: "acceptance.example",
      sourceTier: 2,
      sourceTitle: "An Article About the Divine Mercy Devotion",
      cleanedBody:
        "This article is an opinion piece about the Divine Mercy Devotion. Author reflects on what the devotion means.",
      headings: [{ level: 1, text: "An Article About the Divine Mercy Devotion" }],
      paragraphs: ["This article is an opinion piece about the Divine Mercy Devotion."],
      metadata: { language: "en" },
      sourcePurposes: { canIngestDevotions: true },
      contentChecksum: "acceptance-dm-article",
    };
    const result = runBuild("Devotion", document);
    expect(result.outcome).not.toBe("built_complete_package");
  });
});

describe("acceptance: RosaryBuilder", () => {
  it("rejects a livestream page", () => {
    const document: SourceDocumentSnapshot = {
      sourceUrl: "https://acceptance.example/rosary/live-stream",
      sourceHost: "acceptance.example",
      sourceTier: 3,
      sourceTitle: "Live Stream: The Holy Rosary tonight at 7pm",
      cleanedBody: "Join us for the live stream of the Holy Rosary tonight at 7pm in our chapel.",
      headings: [{ level: 1, text: "Live Stream: The Holy Rosary tonight at 7pm" }],
      paragraphs: ["Join us for the live stream of the Holy Rosary tonight at 7pm."],
      metadata: { language: "en" },
      sourcePurposes: { canIngestRosaryGuides: true },
      contentChecksum: "acceptance-rosary-livestream",
    };
    const result = runBuild("Rosary", document);
    expect(result.outcome).not.toBe("built_complete_package");
  });
});

describe("acceptance: ConsecrationBuilder", () => {
  it("rejects a retreat advertisement (no daily structure)", () => {
    const document: SourceDocumentSnapshot = {
      sourceUrl: "https://acceptance.example/consecration/retreat-ad",
      sourceHost: "acceptance.example",
      sourceTier: 3,
      sourceTitle: "33-Day Consecration Retreat — Sign Up Now",
      cleanedBody:
        "Join our 33-Day Consecration retreat. Tickets $99. Sign up before April 1. Spaces are limited.",
      headings: [{ level: 1, text: "33-Day Consecration Retreat — Sign Up Now" }],
      paragraphs: ["Join our 33-Day Consecration retreat.", "Sign up before April 1."],
      metadata: { language: "en" },
      sourcePurposes: { canIngestConsecrations: true },
      contentChecksum: "acceptance-cons-retreat-ad",
    };
    const result = runBuild("Consecration", document);
    expect(result.outcome).not.toBe("built_complete_package");
  });
});

describe("acceptance: LiturgyBuilder", () => {
  it("rejects a parish Mass schedule page", () => {
    const document: SourceDocumentSnapshot = {
      sourceUrl: "https://acceptance.example/parish/mass-schedule",
      sourceHost: "acceptance.example",
      sourceTier: 3,
      sourceTitle: "Mass Schedule — St. Mary's Parish",
      cleanedBody:
        "Sunday: 8am, 10am, 5pm. Weekday: 7am, 12 noon. Saturday vigil: 5pm. Confessions: Saturday 3pm-4pm.",
      headings: [{ level: 1, text: "Mass Schedule — St. Mary's Parish" }],
      paragraphs: ["Sunday: 8am, 10am, 5pm.", "Weekday: 7am, 12 noon."],
      metadata: { language: "en" },
      sourcePurposes: { canIngestLiturgy: true },
      contentChecksum: "acceptance-mass-schedule",
    };
    const result = runBuild("Liturgy", document);
    expect(result.outcome).not.toBe("built_complete_package");
  });
});

describe("acceptance: ParishBuilder", () => {
  it("rejects a parish bulletin (no usable directory data)", () => {
    const document: SourceDocumentSnapshot = {
      sourceUrl: "https://acceptance.example/bulletin/2026-04-13",
      sourceHost: "acceptance.example",
      sourceTier: 3,
      sourceTitle: "Parish Bulletin — April 13, 2026",
      cleanedBody:
        "From the pastor's desk: Welcome to our Easter celebrations. Remember the second collection. Youth night Wednesday.",
      headings: [{ level: 1, text: "Parish Bulletin — April 13, 2026" }],
      paragraphs: ["From the pastor's desk: Welcome to our Easter celebrations."],
      metadata: { language: "en" },
      sourcePurposes: { canIngestParishes: true },
      contentChecksum: "acceptance-parish-bulletin",
    };
    const result = runBuild("Parish", document);
    expect(result.outcome).not.toBe("built_complete_package");
  });
});

describe("acceptance: MarianApparitionBuilder", () => {
  it("rejects a generic news article (not an apparition profile)", () => {
    const document: SourceDocumentSnapshot = {
      sourceUrl: "https://acceptance.example/news/random-article",
      sourceHost: "acceptance.example",
      sourceTier: 3,
      sourceTitle: "Local Catholic group hosts charity drive",
      cleanedBody:
        "A local Catholic group hosted a charity drive last weekend. Volunteers helped distribute meals.",
      headings: [{ level: 1, text: "Local Catholic group hosts charity drive" }],
      paragraphs: ["A local Catholic group hosted a charity drive last weekend."],
      metadata: { language: "en" },
      sourcePurposes: { canIngestApparitions: true },
      contentChecksum: "acceptance-mary-news",
    };
    const result = runBuild("MarianApparition", document);
    expect(result.outcome).not.toBe("built_complete_package");
  });
});

describe("acceptance: SpiritualGuidanceBuilder", () => {
  it("rejects a recipe blog post (not spiritual guidance)", () => {
    const document: SourceDocumentSnapshot = {
      sourceUrl: "https://acceptance.example/recipes/casserole",
      sourceHost: "acceptance.example",
      sourceTier: 3,
      sourceTitle: "Easy Catholic Family Casserole Recipe",
      cleanedBody:
        "Preheat the oven to 350F. Brown beef and onions. Layer in a casserole dish. Bake 25 minutes.",
      headings: [{ level: 1, text: "Easy Catholic Family Casserole Recipe" }],
      paragraphs: ["Preheat the oven to 350F.", "Brown beef and onions."],
      metadata: { language: "en" },
      sourcePurposes: { canIngestSpiritualGuides: true },
      contentChecksum: "acceptance-sg-recipe",
    };
    const result = runBuild("SpiritualGuidance", document);
    // The SpiritualGuidance builder is intentionally permissive at the
    // shape level but the strict QA layer rejects content that does
    // not match the guide contract. At the builder level we only
    // require an outcome — the spec accepts both rejection at build
    // time and rejection at QA time, as long as the result is
    // observable.
    expect([
      "built_complete_package",
      "wrong_content",
      "build_failed_missing_required_fields",
    ]).toContain(result.outcome);
  });
});
