import { describe, expect, it } from "vitest";
import { validateDevotionPackage } from "@/lib/content-qa/contracts/devotion";
import { staticPurposesForHost } from "@/lib/content-qa/source-purpose";

const EWTN = staticPurposesForHost("ewtn.com");

describe("DevotionPackage contract", () => {
  it("accepts an actual devotion", () => {
    const result = validateDevotionPackage(
      {
        contentType: "Devotion",
        slug: "sacred-heart",
        title: "Devotion to the Sacred Heart of Jesus",
        sourceUrl: "https://www.ewtn.com/devotion/sacred-heart",
        sourceHost: "ewtn.com",
        payload: {
          devotionType: "Sacred Heart",
          devotionName: "Devotion to the Sacred Heart of Jesus",
          background:
            "The Sacred Heart devotion is one of the most beloved devotions in the Catholic Church.",
          practiceInstructions:
            "To pray the Sacred Heart devotion: Step 1: Begin with the Sign of the Cross. Step 2: Recite the opening prayer. Step 3: Pray the Litany of the Sacred Heart.",
        },
      },
      { sourcePurposes: EWTN },
    );
    expect(result.decision).toBe("publish");
  });

  it("deletes an article about a devotion", () => {
    const result = validateDevotionPackage(
      {
        contentType: "Devotion",
        slug: "about-divine-mercy",
        title: "What is Divine Mercy?",
        sourceUrl: "https://www.ewtn.com/article",
        sourceHost: "ewtn.com",
        payload: {
          devotionType: "Divine Mercy",
          devotionName: "What is Divine Mercy?",
          background:
            "An article about the Divine Mercy devotion and how it came to be. Read more about the history.",
          practiceInstructions: "Read the article.",
        },
      },
      { sourcePurposes: EWTN },
    );
    // Should be flagged because practiceInstructions does not contain practice language.
    expect(["reject", "delete"]).toContain(result.decision);
  });

  it("rejects a devotion missing practice instructions", () => {
    const result = validateDevotionPackage(
      {
        contentType: "Devotion",
        slug: "no-practice",
        title: "Some Devotion",
        sourceUrl: "https://www.ewtn.com/devotion",
        sourceHost: "ewtn.com",
        payload: {
          devotionType: "Marian devotion",
          devotionName: "Some Devotion",
          background: "Background about this devotion.",
          practiceInstructions: "",
        },
      },
      { sourcePurposes: EWTN },
    );
    expect(result.decision).toBe("reject");
    expect(result.failedFields).toContain("practiceInstructions");
  });

  it("deletes a livestream devotion", () => {
    const result = validateDevotionPackage(
      {
        contentType: "Devotion",
        slug: "rosary-livestream",
        title: "Live Rosary Stream",
        sourceUrl: "https://www.ewtn.com/livestream",
        sourceHost: "ewtn.com",
        payload: {
          devotionType: "Rosary",
          devotionName: "Live Rosary Stream",
          background: "Watch our live Rosary stream every Sunday.",
          practiceInstructions: "Click here to watch live on YouTube.",
        },
      },
      { sourcePurposes: EWTN },
    );
    expect(result.decision).toBe("delete");
  });

  it("deletes an event announcement", () => {
    const result = validateDevotionPackage(
      {
        contentType: "Devotion",
        slug: "marian-retreat",
        title: "Marian Devotion Retreat 2026",
        sourceUrl: "https://www.ewtn.com/event",
        sourceHost: "ewtn.com",
        payload: {
          devotionType: "Marian devotion",
          devotionName: "Marian Devotion Retreat 2026",
          background: "Join us for our annual retreat. Register now! Tickets available.",
          practiceInstructions: "Sign up at the door.",
        },
      },
      { sourcePurposes: EWTN },
    );
    expect(result.decision).toBe("delete");
  });
});
