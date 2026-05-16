import { describe, expect, it } from "vitest";
import {
  classifySeverity,
  looksLikeLandingPage,
  looksLikeMetaDescription,
  sanitize,
} from "@/lib/ingestion/validate";
import type { IngestedItem } from "@/lib/ingestion/types";

describe("looksLikeLandingPage", () => {
  it("flags '… & More | EWTN' aggregator titles", () => {
    expect(looksLikeLandingPage("Catholic Prayers - Prayer to Jesus, Marian, & More | EWTN")).toBe(
      true,
    );
  });

  it("flags 'Catholic Faith, Beliefs, & Prayers' generic enumerations", () => {
    expect(looksLikeLandingPage("Catholic Faith, Beliefs, & Prayers | Catholic Answers")).toBe(
      true,
    );
  });

  it("flags 'Catholic Prayers | EWTN' bare-plural-with-brand titles", () => {
    expect(looksLikeLandingPage("Catholic Prayers | EWTN")).toBe(true);
    expect(looksLikeLandingPage("Catholic Devotions | USCCB")).toBe(true);
  });

  it("flags 'Prayers and Devotions' enumeration titles", () => {
    expect(looksLikeLandingPage("Prayers and Devotions")).toBe(true);
  });

  it("flags 'Index of', 'Directory of', 'List of' pages", () => {
    expect(looksLikeLandingPage("Index of Catholic Prayers")).toBe(true);
    expect(looksLikeLandingPage("Directory of Saints")).toBe(true);
    expect(looksLikeLandingPage("List of Marian Apparitions")).toBe(true);
  });

  it("does NOT flag real prayer / saint / apparition titles", () => {
    expect(looksLikeLandingPage("Hail Mary")).toBe(false);
    expect(looksLikeLandingPage("Ave Maria")).toBe(false);
    expect(looksLikeLandingPage("Saint Padre Pio")).toBe(false);
    expect(looksLikeLandingPage("Our Lady of Lourdes")).toBe(false);
    expect(looksLikeLandingPage("Anima Christi")).toBe(false);
  });
});

describe("looksLikeMetaDescription", () => {
  it("flags 'Devotions are manifestations of …' meta openers", () => {
    expect(
      looksLikeMetaDescription(
        "Devotions are manifestations of our profound love of God, rooted in worship and service to his Holy Name.",
      ),
    ).toBe(true);
  });

  it("flags 'Prayers are …' bodies", () => {
    expect(
      looksLikeMetaDescription("Prayers are a form of communication between the soul and God."),
    ).toBe(true);
  });

  it("flags 'Catholic Answers is a media company …' source descriptions", () => {
    expect(
      looksLikeMetaDescription(
        "Catholic Answers is a media company dedicated to sharing the Catholic faith.",
      ),
    ).toBe(true);
  });

  it("flags 'Skip to main content' navigation cruft", () => {
    expect(
      looksLikeMetaDescription(
        "Skip to main content Accessibility feedback Latest Content Read, Listen, or Watch",
      ),
    ).toBe(true);
  });

  it("does NOT flag actual prayer text", () => {
    expect(
      looksLikeMetaDescription(
        "Hail Mary, full of grace, the Lord is with thee. Blessed art thou amongst women. Amen.",
      ),
    ).toBe(false);
  });

  it("does NOT flag actual saint biographies", () => {
    expect(
      looksLikeMetaDescription(
        "Saint Francis of Assisi was born in 1181. He founded the Franciscan order in 1209 after a profound conversion.",
      ),
    ).toBe(false);
  });
});

describe("classifySeverity: noise vs hard vs soft", () => {
  it("classifies landing-page rejections as noise", () => {
    expect(
      classifySeverity("Prayer title looks like a landing or index page, not a single prayer"),
    ).toBe("noise");
  });

  it("classifies meta-description rejections as noise", () => {
    expect(
      classifySeverity(
        "Prayer body reads as meta-description or navigation cruft, not an actual prayer",
      ),
    ).toBe("noise");
  });

  it("classifies 'looks like source summary' as noise", () => {
    expect(
      classifySeverity("Prayer looks like a source summary / navigation page, not a real prayer"),
    ).toBe("noise");
  });

  it("classifies missing-slug rejections as hard", () => {
    expect(classifySeverity("Prayer slug is required")).toBe("hard");
  });

  it("classifies length-floor and category-vocab failures as soft", () => {
    expect(classifySeverity("Prayer body looks too short")).toBe("soft");
    expect(classifySeverity("Saint biography does not read like a saint biography")).toBe("soft");
  });
});

describe("sanitize: brand-landing-page rejection (regression)", () => {
  it("routes 'Catholic Prayers - Prayer to Jesus, Marian, & More | EWTN' to noise (hard delete)", () => {
    const item: IngestedItem = {
      kind: "prayer",
      slug: "catholic-prayers-ewtn",
      defaultTitle: "Catholic Prayers - Prayer to Jesus, Marian, & More | EWTN",
      category: "Marian",
      body: "Devotions Devotions are manifestations of our profound love of God, rooted in worship and service to his Holy Name. As Catholics, it is our readiness to give honor and glory to God, whether in public or private prayer.",
      externalSourceKey: "https://www.ewtn.com/catholicism/prayers",
    };
    const { valid, review, noise, rejected } = sanitize([item]);
    expect(valid).toHaveLength(0);
    expect(review).toHaveLength(0);
    expect(noise).toHaveLength(1);
    expect(rejected).toHaveLength(0);
  });

  it("routes 'Catholic Faith, Beliefs, & Prayers | Catholic Answers' with nav body to noise", () => {
    const item: IngestedItem = {
      kind: "prayer",
      slug: "catholic-faith-beliefs-answers",
      defaultTitle: "Catholic Faith, Beliefs, & Prayers | Catholic Answers",
      category: "Marian",
      body: "Skip to main contentAccessibility feedback Latest Content Read, Listen, or Watch Catholic Faith Resources Honest Answers to Questions About Catholic Faith & Beliefs Catholic Answers is a media company.",
      externalSourceKey: "https://www.catholic.com/prayers",
    };
    const { valid, noise } = sanitize([item]);
    expect(valid).toHaveLength(0);
    expect(noise).toHaveLength(1);
  });

  it("still passes a real prayer cleanly", () => {
    const item: IngestedItem = {
      kind: "prayer",
      slug: "hail-mary",
      defaultTitle: "Hail Mary",
      category: "Marian",
      body: "Hail Mary, full of grace, the Lord is with thee. Blessed art thou amongst women and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.",
      externalSourceKey: "https://www.usccb.org/prayers/hail-mary",
    };
    const { valid, review, noise, rejected } = sanitize([item]);
    expect(valid).toHaveLength(1);
    expect(review).toHaveLength(0);
    expect(noise).toHaveLength(0);
    expect(rejected).toHaveLength(0);
  });
});
