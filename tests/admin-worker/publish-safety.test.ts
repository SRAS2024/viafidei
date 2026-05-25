/**
 * Publish-safety pattern blockers — proves the worker refuses to
 * publish the spec's banned categories: incomplete prayers, articles
 * about prayers, saint-named institutions, livestreams, store/donation
 * pages, content without source evidence, scripture from an unapproved
 * translation source (spec section 15).
 */

import { describe, expect, it } from "vitest";

import { evaluatePublishSafety } from "@/lib/admin-worker/publish-safety";

const APPROVED_TRANSLATIONS = ["RSV-CE", "NABRE", "Douay-Rheims"];

describe("evaluatePublishSafety", () => {
  it("passes a complete prayer with all evidence", () => {
    const decision = evaluatePublishSafety({
      contentType: "PRAYER",
      title: "Our Father",
      bodyText:
        "Our Father, who art in heaven, hallowed be Thy name; Thy kingdom come; Thy will be done...",
      hasSourceEvidence: true,
      sourceUrl: "https://www.vatican.va/archive/catechism/p4s1c1a3.htm",
    });
    expect(decision.blocked).toBe(false);
  });

  it("blocks an incomplete prayer", () => {
    const decision = evaluatePublishSafety({
      contentType: "PRAYER",
      title: "Our Father",
      bodyText: "tbd",
      hasSourceEvidence: true,
      sourceUrl: "https://www.vatican.va/x",
    });
    expect(decision.blocked).toBe(true);
    expect(decision.reasons).toContain("incomplete_prayer");
  });

  it("blocks an article-about-prayer instead of the prayer itself", () => {
    const decision = evaluatePublishSafety({
      contentType: "PRAYER",
      title: "How to pray the Rosary",
      bodyText: "A long body explaining the prayer in detail with many words.",
      hasSourceEvidence: true,
      sourceUrl: "https://www.vatican.va/x",
    });
    expect(decision.blocked).toBe(true);
    expect(decision.reasons).toContain("article_about_prayer");
  });

  it("blocks a saint-named institution", () => {
    const decision = evaluatePublishSafety({
      contentType: "SAINT",
      title: "St. Joseph's Hospital",
      hasSourceEvidence: true,
      sourceUrl: "https://parish.example/x",
    });
    expect(decision.blocked).toBe(true);
    expect(decision.reasons).toContain("saint_named_institution");
  });

  it("blocks a livestream source URL", () => {
    const decision = evaluatePublishSafety({
      contentType: "PRAYER",
      title: "Some real prayer title",
      bodyText: "A proper body of prayer text long enough to clear the threshold for completeness.",
      hasSourceEvidence: true,
      sourceUrl: "https://parish.example/live/123",
    });
    expect(decision.blocked).toBe(true);
    expect(decision.reasons).toContain("livestream");
  });

  it("blocks a donation page source URL", () => {
    const decision = evaluatePublishSafety({
      contentType: "DEVOTION",
      title: "Sacred Heart Devotion",
      hasSourceEvidence: true,
      sourceUrl: "https://parish.example/donate",
    });
    expect(decision.blocked).toBe(true);
    expect(decision.reasons).toContain("donation_page");
  });

  it("blocks a publish when source evidence is missing", () => {
    const decision = evaluatePublishSafety({
      contentType: "PRAYER",
      title: "A prayer",
      bodyText: "Long enough body text to pass the completeness check threshold.",
      hasSourceEvidence: false,
    });
    expect(decision.blocked).toBe(true);
    expect(decision.reasons).toContain("no_source_evidence");
  });

  it("blocks an unapproved scripture translation", () => {
    const decision = evaluatePublishSafety({
      contentType: "PRAYER",
      title: "Scripture-rich prayer",
      bodyText: "A long enough body text to clear the completeness threshold check.",
      hasSourceEvidence: true,
      sourceUrl: "https://www.vatican.va/x",
      scriptureTranslation: "The Message",
      approvedTranslations: APPROVED_TRANSLATIONS,
    });
    expect(decision.blocked).toBe(true);
    expect(decision.reasons).toContain("unapproved_scripture_translation");
  });

  it("approves an approved scripture translation", () => {
    const decision = evaluatePublishSafety({
      contentType: "PRAYER",
      title: "Scripture-rich prayer",
      bodyText: "A long enough body text to clear the completeness threshold check.",
      hasSourceEvidence: true,
      sourceUrl: "https://www.vatican.va/x",
      scriptureTranslation: "RSV-CE",
      approvedTranslations: APPROVED_TRANSLATIONS,
    });
    expect(decision.blocked).toBe(false);
  });
});
