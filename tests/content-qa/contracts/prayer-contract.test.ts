import { describe, expect, it } from "vitest";
import { validatePrayerPackage } from "@/lib/content-qa/contracts/prayer";
import { staticPurposesForHost } from "@/lib/content-qa/source-purpose";

const VATICAN_PURPOSES = staticPurposesForHost("vatican.va");
const PARISH_DIRECTORY_PURPOSES = staticPurposesForHost("parishesonline.com");

describe("PrayerPackage contract", () => {
  it("accepts an actual prayer", () => {
    const result = validatePrayerPackage(
      {
        contentType: "Prayer",
        slug: "hail-mary",
        title: "Hail Mary",
        sourceUrl: "https://www.vatican.va/prayers/hail-mary",
        sourceHost: "vatican.va",
        payload: {
          prayerType: "Marian prayer",
          prayerName: "Hail Mary",
          prayerText:
            "Hail Mary, full of grace, the Lord is with thee. Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.",
          category: "Marian",
          language: "en",
        },
      },
      { sourcePurposes: VATICAN_PURPOSES },
    );
    expect(result.decision).toBe("publish");
    expect(result.publicRenderReady).toBe(true);
    expect(result.isThresholdEligible).toBe(true);
  });

  it("deletes a livestream prayer page", () => {
    const result = validatePrayerPackage(
      {
        contentType: "Prayer",
        slug: "livestream-rosary",
        title: "Watch Live: Rosary",
        sourceUrl: "https://www.vatican.va/livestream",
        sourceHost: "vatican.va",
        payload: {
          prayerType: "Rosary prayer",
          prayerName: "Watch Live: Rosary",
          prayerText:
            "Join us live on Facebook Live for the Rosary tonight. Click here to register now for the livestream.",
          category: "Rosary",
          language: "en",
        },
      },
      { sourcePurposes: VATICAN_PURPOSES },
    );
    expect(result.decision).toBe("delete");
  });

  it("deletes a Newton-style livestream prayer page", () => {
    const result = validatePrayerPackage(
      {
        contentType: "Prayer",
        slug: "newton-prayer-livestream",
        title: "Livestream from Newton: Prayer Service",
        sourceUrl: "https://www.vatican.va/livestream",
        sourceHost: "vatican.va",
        payload: {
          prayerType: "Traditional Catholic prayer",
          prayerName: "Livestream from Newton",
          prayerText: "Watch our weekly prayer service streaming live on YouTube every Sunday.",
          category: "Traditional",
          language: "en",
        },
      },
      { sourcePurposes: VATICAN_PURPOSES },
    );
    expect(result.decision).toBe("delete");
  });

  it("rejects a prayer with missing prayer text", () => {
    const result = validatePrayerPackage(
      {
        contentType: "Prayer",
        slug: "no-text",
        title: "Empty Prayer",
        sourceUrl: "https://www.vatican.va/prayer",
        sourceHost: "vatican.va",
        payload: {
          prayerType: "Marian prayer",
          prayerName: "Empty Prayer",
          prayerText: "",
          category: "Marian",
          language: "en",
        },
      },
      { sourcePurposes: VATICAN_PURPOSES },
    );
    expect(result.decision).toBe("reject");
    expect(result.failedFields).toContain("prayerText");
  });

  it("rejects a prayer with missing prayerType", () => {
    const result = validatePrayerPackage(
      {
        contentType: "Prayer",
        slug: "no-type",
        title: "Some Prayer",
        sourceUrl: "https://www.vatican.va/prayer",
        sourceHost: "vatican.va",
        payload: {
          prayerType: "",
          prayerName: "Some Prayer",
          prayerText:
            "Lord, hear my prayer. O God, grant me peace. Amen. We beseech thee to look upon us in mercy.",
          category: "Daily",
          language: "en",
        },
      },
      { sourcePurposes: VATICAN_PURPOSES },
    );
    expect(result.decision).toBe("reject");
    expect(result.failedFields).toContain("prayerType");
  });

  it("rejects a prayer from a source not approved for prayers", () => {
    const result = validatePrayerPackage(
      {
        contentType: "Prayer",
        slug: "from-parish-directory",
        title: "Hail Mary",
        sourceUrl: "https://parishesonline.com/prayer",
        sourceHost: "parishesonline.com",
        payload: {
          prayerType: "Marian prayer",
          prayerName: "Hail Mary",
          prayerText:
            "Hail Mary, full of grace, the Lord is with thee. Blessed art thou amongst women. Amen.",
          category: "Marian",
          language: "en",
        },
      },
      { sourcePurposes: PARISH_DIRECTORY_PURPOSES },
    );
    expect(result.decision).toBe("reject");
    expect(result.reason).toMatch(/canIngestPrayers/);
  });

  it("rejects a prayer whose body is an article about prayer", () => {
    const result = validatePrayerPackage(
      {
        contentType: "Prayer",
        slug: "article",
        title: "What is the Rosary?",
        sourceUrl: "https://www.vatican.va/about/rosary",
        sourceHost: "vatican.va",
        payload: {
          prayerType: "Marian prayer",
          prayerName: "What is the Rosary?",
          prayerText:
            "The Rosary is one of the most important prayers in the Catholic Church. It dates back to the 13th century when Saint Dominic received it from the Virgin Mary. Catholics around the world pray the Rosary every day.",
          category: "Marian",
          language: "en",
        },
      },
      { sourcePurposes: VATICAN_PURPOSES },
    );
    // Body lacks prayer language → reject.
    expect(["reject", "delete"]).toContain(result.decision);
  });
});
