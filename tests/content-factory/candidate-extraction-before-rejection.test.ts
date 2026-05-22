/**
 * Candidate extraction before rejection.
 *
 * The factory isolates the real prayer / saint biography / devotion
 * practice from surrounding livestream / event / donation / navigation
 * noise BEFORE judging wrong-content, so a page that genuinely holds
 * valid content is no longer rejected for the chrome around it. A page
 * that is ONLY noise is still rejected, and the content type router
 * still narrows builds to strongly-signalled types.
 */

import { describe, expect, it } from "vitest";
import {
  PrayerBuilder,
  SaintBuilder,
  DevotionBuilder,
  routeContentTypes,
  type SourceDocumentSnapshot,
} from "@/lib/content-factory";

function snapshot(o: {
  url: string;
  host: string;
  title: string;
  body: string;
  purpose: string;
}): SourceDocumentSnapshot {
  return {
    sourceUrl: o.url,
    sourceHost: o.host,
    sourceTier: 1,
    sourceTitle: o.title,
    cleanedBody: o.body,
    rawBody: o.body,
    headings: [{ level: 1, text: o.title }],
    paragraphs: o.body.split(/\n{2,}/).map((p) => p.trim()),
    metadata: { language: "en" },
    sourcePurposes: { [o.purpose]: true },
    contentChecksum: `ck-${o.title}`,
    language: "en",
  };
}

describe("PrayerBuilder — candidate extraction before rejection", () => {
  it("builds a real prayer that sits under a livestream / event / donation noise paragraph", () => {
    const document = snapshot({
      url: "https://vatican.va/prayers/st-michael",
      host: "vatican.va",
      title: "Prayer to Saint Michael",
      purpose: "canIngestPrayers",
      body:
        "Watch our livestream every evening at 7pm and register now for the parish event. " +
        "Donate today to support our ministry.\n\n" +
        "Saint Michael the Archangel, defend us in battle. Be our protection against the " +
        "wickedness and snares of the devil. May God rebuke him, we humbly pray; and do thou, " +
        "O Prince of the heavenly host, by the power of God, cast into hell Satan and all the " +
        "evil spirits who prowl about the world seeking the ruin of souls. Amen.",
    });
    const result = PrayerBuilder.build({ document });
    expect(result.outcome).toBe("built_complete_package");
    if (result.outcome !== "built_complete_package") return;
    const prayerText = String(result.package.payload.prayerText);
    expect(prayerText).toMatch(/Saint Michael the Archangel/);
    // The donation / livestream chrome paragraph was dropped, not built in.
    expect(prayerText).not.toMatch(/livestream/i);
    expect(prayerText).not.toMatch(/Donate today/i);
  });

  it("still rejects a page that is only livestream / event / donation noise", () => {
    const document = snapshot({
      url: "https://vatican.va/parish/updates",
      host: "vatican.va",
      title: "Parish Updates",
      purpose: "canIngestPrayers",
      body:
        "Watch our livestream tonight. Register now for the parish event. " +
        "Donate today. Subscribe to our newsletter for weekly updates.",
    });
    const result = PrayerBuilder.build({ document });
    expect(result.outcome).not.toBe("built_complete_package");
  });
});

describe("SaintBuilder — candidate extraction before rejection", () => {
  it("builds a saint profile even when the page also carries a shrine-livestream callout", () => {
    const document = snapshot({
      url: "https://vatican.va/saints/catherine-of-siena",
      host: "vatican.va",
      title: "Saint Catherine of Siena",
      purpose: "canIngestSaints",
      body:
        "Watch the livestream from our parish shrine and register now for the pilgrimage. " +
        "Donate today to keep the shrine open.\n\n" +
        "Saint Catherine of Siena was a Dominican tertiary, mystic, and Doctor of the Church. " +
        "She was born in 1347 and died in 1380. Her feast day is April 29. She is the patron " +
        "saint of Italy and of nurses, remembered for her letters and her counsel to popes.",
    });
    const result = SaintBuilder.build({ document });
    expect(result.outcome).toBe("built_complete_package");
    if (result.outcome !== "built_complete_package") return;
    expect(result.package.payload.feastDay).toMatch(/April 29/);
    expect(String(result.package.payload.biography)).not.toMatch(/livestream/i);
  });
});

describe("DevotionBuilder — candidate extraction before rejection", () => {
  it("extracts the devotional practice when an event-registration paragraph wraps it", () => {
    const document = snapshot({
      url: "https://vatican.va/devotions/sacred-heart",
      host: "vatican.va",
      title: "Devotion to the Sacred Heart of Jesus",
      purpose: "canIngestDevotions",
      body:
        "Register now for our parish retreat event — tickets are available at the door.\n\n" +
        "The Devotion to the Sacred Heart of Jesus honors the physical heart of Christ as the " +
        "symbol of his redeeming love for all of humanity.\n\n" +
        "Practice: Begin with the Sign of the Cross. Recite the Litany of the Sacred Heart each " +
        "Friday. Conclude with an act of reparation to the Sacred Heart.",
    });
    const result = DevotionBuilder.build({ document });
    expect(result.outcome).toBe("built_complete_package");
    if (result.outcome !== "built_complete_package") return;
    expect(String(result.package.payload.practiceInstructions)).toMatch(/Sign of the Cross/);
  });
});

describe("content type router — only strongly-signalled types are selected", () => {
  it("selects only Prayer for a /prayers/ page even when the source also permits Saint and Devotion", () => {
    const decision = routeContentTypes({
      sourceUrl: "https://example.com/prayers/anima-christi",
      sourceHost: "example.com",
      title: "Anima Christi",
      sourcePurposes: {
        canIngestPrayers: true,
        canIngestSaints: true,
        canIngestDevotions: true,
      },
    });
    // The source permits three types, but only Prayer carries a strong
    // positive signal (the /prayers/ URL), so only Prayer is selected.
    expect(decision.selected.map((s) => s.contentType)).toEqual(["Prayer"]);
    // `ranked` still lists every permitted, non-rejected type.
    expect(decision.ranked.length).toBe(3);
  });
});
