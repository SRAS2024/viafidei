import { describe, expect, it } from "vitest";
import { sanitize, validateItem, looksLikeNonContent } from "@/lib/ingestion/validate";
import type { IngestedItem } from "@/lib/ingestion/types";

const validPrayer: IngestedItem = {
  kind: "prayer",
  slug: "our-father",
  defaultTitle: "Our Father",
  category: "Dominical",
  body: "Our Father, who art in heaven, hallowed be thy name; thy kingdom come; thy will be done on earth as it is in heaven. Amen.",
};

const validSaint: IngestedItem = {
  kind: "saint",
  slug: "francis-of-assisi",
  canonicalName: "Saint Francis of Assisi",
  patronages: ["animals", "ecology"],
  biography:
    "Saint Francis was born in Assisi in 1181, embraced radical poverty after a conversion in 1206, and founded the Order of Friars Minor. He preached evangelical poverty and received the stigmata two years before his death in 1226.",
};

describe("validateItem", () => {
  it("accepts a well-formed prayer", () => {
    expect(validateItem(validPrayer)).toBeNull();
  });

  it("rejects a prayer without a body", () => {
    expect(validateItem({ ...validPrayer, body: "" })).toMatch(/body/);
  });

  it("rejects a prayer body that's too short", () => {
    expect(validateItem({ ...validPrayer, body: "short" })).toMatch(/too short/);
  });

  it("rejects a prayer body that does not contain prayer language", () => {
    expect(
      validateItem({
        ...validPrayer,
        body: "This is a Catholic website maintained by a publishing house and updated daily.",
      }),
    ).toMatch(/prayer language/);
  });

  it("rejects a saint biography that's too short", () => {
    expect(validateItem({ ...validSaint, biography: "Short biography." })).toMatch(/too short/);
  });

  it("rejects a saint biography that reads like a TV listing", () => {
    expect(
      validateItem({
        ...validSaint,
        biography:
          "EWTN is the largest religious media network in the world, transmitting via television, radio, online streaming, and other digital programs to households worldwide every single day.",
      }),
    ).toMatch(/TV program|source summary|biography/);
  });

  it("rejects an apparition missing approvedStatus", () => {
    expect(
      validateItem({
        kind: "apparition",
        slug: "lourdes",
        title: "Our Lady of Lourdes",
        summary:
          "In 1858 the Blessed Virgin appeared to Saint Bernadette Soubirous eighteen times at Massabielle.",
        approvedStatus: "",
      }),
    ).toMatch(/approvedStatus/);
  });

  it("rejects an apparition with an unrecognised approval status", () => {
    expect(
      validateItem({
        kind: "apparition",
        slug: "place",
        title: "Reported apparitions in some place",
        summary:
          "In 2024 the Blessed Virgin reportedly appeared and Our Lady spoke to several seers.",
        approvedStatus: "unverified-blog-claim",
      }),
    ).toMatch(/canonical status/);
  });

  it("rejects an apparition that does not mention Marian language", () => {
    expect(
      validateItem({
        kind: "apparition",
        slug: "x",
        title: "Some chapel that exists",
        summary:
          "This is a building in a small town that has been operating since the eighteenth century.",
        approvedStatus: "Approved",
      }),
    ).toMatch(/Marian/);
  });

  it("rejects a parish website that isn't a real URL", () => {
    expect(
      validateItem({
        kind: "parish",
        slug: "st-mary",
        name: "St. Mary",
        websiteUrl: "javascript:alert(1)",
      }),
    ).toMatch(/websiteUrl/);
  });

  it("rejects a devotion with non-positive duration", () => {
    expect(
      validateItem({
        kind: "devotion",
        slug: "rosary",
        title: "Rosary",
        summary:
          "The recitation of the Holy Rosary, a devotion that meditates on the mysteries of Christ.",
        durationMinutes: -1,
      }),
    ).toMatch(/durationMinutes/);
  });

  it("rejects a devotion that reads like a newsletter blurb", () => {
    expect(
      validateItem({
        kind: "devotion",
        slug: "x",
        title: "Subscribe to our newsletter",
        summary:
          "Sign up for our monthly newsletter and receive Catholic updates from our editors.",
      }),
    ).toMatch(/source summary|newsletter|Catholic devotional/);
  });

  it("rejects an externalSourceKey from a non-approved host", () => {
    expect(
      validateItem({
        ...validPrayer,
        externalSourceKey: "https://random-blog.example.com/page",
      }),
    ).toMatch(/not from a Vatican-approved host/);
  });

  it("refuses to ingest user-generated kinds (defense in depth)", () => {
    const sneaky = { kind: "journal" } as unknown as IngestedItem;
    expect(validateItem(sneaky)).toMatch(/protected user-generated content/);
  });

  it("accepts a well-formed liturgy entry", () => {
    expect(
      validateItem({
        kind: "liturgy",
        slug: "council-of-nicaea",
        liturgyKind: "COUNCIL_TIMELINE",
        title: "First Council of Nicaea",
        body: "Convoked in 325 AD by the Emperor Constantine to address the teaching of the priest Arius, the First Council of Nicaea produced the Nicene Creed and defined Christ as consubstantial with the Father.",
      }),
    ).toBeNull();
  });

  it("rejects a liturgy entry with an unknown LiturgyKind", () => {
    expect(
      validateItem({
        kind: "liturgy",
        slug: "x",
        liturgyKind: "NOT_A_THING" as never,
        title: "x",
        body: "Some body that is sufficiently long to satisfy the length validator on liturgy bodies, comfortably above eighty characters.",
      }),
    ).toMatch(/not a recognised LiturgyKind/);
  });

  it("accepts a well-formed spiritual-life guide", () => {
    expect(
      validateItem({
        kind: "guide",
        slug: "how-to-pray-the-rosary",
        guideKind: "ROSARY",
        title: "How to Pray the Rosary",
        summary:
          "A step-by-step guide to praying the Holy Rosary in five decades, with the Apostles' Creed, Our Father, Hail Mary, and the Glory Be.",
        steps: [
          {
            order: 1,
            title: "Sign of the Cross",
            body: "Begin with the Sign of the Cross.",
          },
        ],
      }),
    ).toBeNull();
  });

  it("rejects a guide with an unknown SpiritualLifeKind", () => {
    expect(
      validateItem({
        kind: "guide",
        slug: "x",
        guideKind: "NOT_A_KIND" as never,
        title: "x",
        summary: "An ordinary summary that is long enough to pass the length floor.",
      }),
    ).toMatch(/not a recognised SpiritualLifeKind/);
  });

  it("rejects a guide with non-positive durationDays", () => {
    expect(
      validateItem({
        kind: "guide",
        slug: "x",
        guideKind: "GENERAL",
        title: "Some genuine guide",
        summary: "An ordinary summary that is long enough to satisfy the validator.",
        durationDays: -3,
      }),
    ).toMatch(/durationDays/);
  });
});

describe("looksLikeNonContent", () => {
  it("flags broadcast / TV programming copy", () => {
    expect(looksLikeNonContent("EWTN live television programming runs around the clock.")).toBe(
      true,
    );
  });

  it("flags subscribe-to-newsletter copy", () => {
    expect(looksLikeNonContent("Subscribe to our newsletter for weekly Catholic news.")).toBe(true);
  });

  it("flags source bylines like 'Catholic Australia, a work of'", () => {
    expect(
      looksLikeNonContent(
        "Catholic Australia, a work of the Australian Catholic Bishops Conference.",
      ),
    ).toBe(true);
  });

  it("does not flag real prayer text", () => {
    expect(
      looksLikeNonContent(
        "Our Father, who art in heaven, hallowed be thy name; thy kingdom come; thy will be done.",
      ),
    ).toBe(false);
  });
});

describe("sanitize", () => {
  it("normalizes slugs and partitions into valid + review + rejected", () => {
    const result = sanitize([
      { ...validPrayer, slug: "Our_Father!!" },
      { ...validPrayer, slug: "second-prayer", body: "" },
      validSaint,
    ]);
    expect(result.valid).toHaveLength(2);
    expect(result.rejected).toHaveLength(1);
    expect(result.review).toHaveLength(0);
    expect(result.valid[0].slug).toBe("our-father");
    expect(result.rejected[0].reason).toMatch(/body/);
  });

  it("never throws on an empty input", () => {
    expect(sanitize([])).toEqual({ valid: [], review: [], rejected: [] });
  });

  it("diverts soft (category-heuristic) failures into the review bucket", () => {
    // Prayer body that is structurally valid (long enough, has a category)
    // but contains no prayer-language markers. The validator returns a
    // "prayer language" reason, which classifies as soft.
    const blurb = {
      kind: "prayer" as const,
      slug: "blurb",
      defaultTitle: "Some Ordinary Title",
      category: "Daily",
      body: "This site is maintained by the Australian Catholic Bishops Conference and updated regularly with new posts.",
    };
    const result = sanitize([blurb]);
    expect(result.valid).toHaveLength(0);
    expect(result.review).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
    expect(result.review[0].reason).toMatch(/prayer language|source summary/i);
  });

  it("hard-rejects items missing required fields", () => {
    const result = sanitize([
      {
        kind: "saint" as const,
        slug: "",
        canonicalName: "",
        patronages: [],
        biography: "",
      },
    ]);
    expect(result.rejected).toHaveLength(1);
    expect(result.review).toHaveLength(0);
  });
});
