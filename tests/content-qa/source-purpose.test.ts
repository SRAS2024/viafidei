import { describe, expect, it } from "vitest";
import {
  staticPurposesForHost,
  isSourceApprovedFor,
  purposeForContentType,
} from "@/lib/content-qa/source-purpose";

describe("source-purpose allowlist", () => {
  it("vatican.va is approved for prayers, saints, sacraments, history, liturgy", () => {
    const p = staticPurposesForHost("vatican.va");
    expect(p.canIngestPrayers).toBe(true);
    expect(p.canIngestSaints).toBe(true);
    expect(p.canIngestSacraments).toBe(true);
    expect(p.canIngestHistory).toBe(true);
    expect(p.canIngestLiturgy).toBe(true);
    expect(p.canIngestParishes).toBe(false);
  });

  it("parish directory sites are approved for parishes only", () => {
    const p = staticPurposesForHost("parishesonline.com");
    expect(p.canIngestParishes).toBe(true);
    expect(p.canIngestPrayers).toBe(false);
    expect(p.canIngestSaints).toBe(false);
    expect(p.canIngestApparitions).toBe(false);
  });

  it("a source approved for saints is NOT automatically approved for prayers", () => {
    const p = staticPurposesForHost("newadvent.org");
    expect(p.canIngestSaints).toBe(true);
    expect(p.canIngestPrayers).toBe(false);
  });

  it("a source approved for parish directory is NOT approved for prayer extraction", () => {
    const p = staticPurposesForHost("masstimes.org");
    expect(p.canIngestParishes).toBe(true);
    expect(p.canIngestPrayers).toBe(false);
    expect(p.canIngestDevotions).toBe(false);
  });

  it("isSourceApprovedFor returns false for unknown hosts", () => {
    const p = staticPurposesForHost("random-blog.com");
    expect(isSourceApprovedFor(p, "Prayer")).toBe(false);
    expect(isSourceApprovedFor(p, "Saint")).toBe(false);
    expect(isSourceApprovedFor(p, "Parish")).toBe(false);
  });

  it("purposeForContentType maps every public content type", () => {
    expect(purposeForContentType("Prayer")).toBe("canIngestPrayers");
    expect(purposeForContentType("Saint")).toBe("canIngestSaints");
    expect(purposeForContentType("MarianApparition")).toBe("canIngestApparitions");
    expect(purposeForContentType("Parish")).toBe("canIngestParishes");
    expect(purposeForContentType("Devotion")).toBe("canIngestDevotions");
    expect(purposeForContentType("Novena")).toBe("canIngestNovenas");
    expect(purposeForContentType("Sacrament")).toBe("canIngestSacraments");
    expect(purposeForContentType("Rosary")).toBe("canIngestRosaryGuides");
    expect(purposeForContentType("Consecration")).toBe("canIngestConsecrations");
    expect(purposeForContentType("SpiritualGuidance")).toBe("canIngestSpiritualGuides");
    expect(purposeForContentType("Liturgy")).toBe("canIngestLiturgy");
    expect(purposeForContentType("History")).toBe("canIngestHistory");
  });

  it("a source approved for history is NOT automatically approved for devotions", () => {
    const p = staticPurposesForHost("newadvent.org");
    expect(p.canIngestHistory).toBe(true);
    expect(p.canIngestDevotions).toBe(false);
  });

  it("a source approved for scripture references is NOT approved for scripture text", () => {
    const p = staticPurposesForHost("usccb.org");
    expect(p.canIngestLiturgy).toBe(true);
    // usccb.org is the bishop's conference site; bible.usccb.org is the
    // separate scripture text host.
    expect(p.canProvideScriptureText).toBe(false);
  });

  it("bible.usccb.org provides scripture text", () => {
    const p = staticPurposesForHost("bible.usccb.org");
    expect(p.canProvideScriptureText).toBe(true);
  });
});
