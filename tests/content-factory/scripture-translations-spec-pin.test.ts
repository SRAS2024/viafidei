/**
 * Spec-pin test for scripture-block invariants.
 *
 * The spec says:
 *   * Scripture blocks must use one approved Catholic Bible translation policy.
 *   * Scripture blocks must include: Scripture reference, Book, Chapter,
 *     Verse start, Verse end (when applicable), Scripture text (if
 *     legally displayed), Bible translation key, Scripture source,
 *     License status, Checksum, Provenance.
 *   * Do not scrape scripture text from random pages.
 *   * Do not mix Bible translations.
 *   * Do not label paraphrases as scripture.
 *   * If full scripture text cannot legally be displayed, show only
 *     the reference.
 *   * Block publishing if required scripture is missing.
 *
 * This test pins:
 *   * APPROVED_BIBLE_TRANSLATIONS — every Catholic-edition translation
 *     code we recognise. A future edit that adds a non-Catholic
 *     translation (or removes a real one) fails the build.
 *   * APPROVED_LICENSE_STATUSES — the three license stances scripture
 *     blocks may declare.
 *   * The contract validator is wired to both tuples.
 */

import { describe, expect, it } from "vitest";
import {
  APPROVED_BIBLE_TRANSLATIONS,
  APPROVED_LICENSE_STATUSES,
} from "@/lib/content-qa/contracts/scripture";

const SPEC_CATHOLIC_TRANSLATIONS = [
  "NABRE",
  "RSV-CE",
  "RSV-2CE",
  "DRA",
  "NRSV-CE",
  "NJB",
  "CEB-CE",
  "ESV-CE",
] as const;

const SPEC_LICENSE_STATUSES = [
  "public-domain",
  "licensed-display",
  "fair-use-reference-only",
] as const;

describe("APPROVED_BIBLE_TRANSLATIONS — only Catholic-edition codes", () => {
  it("contains every spec-listed Catholic translation", () => {
    for (const t of SPEC_CATHOLIC_TRANSLATIONS) {
      expect(APPROVED_BIBLE_TRANSLATIONS as readonly string[]).toContain(t);
    }
  });

  it("contains no extras beyond the spec set", () => {
    for (const t of APPROVED_BIBLE_TRANSLATIONS as readonly string[]) {
      expect(SPEC_CATHOLIC_TRANSLATIONS as readonly string[]).toContain(t);
    }
  });

  it("rejects any non-Catholic-edition codes (KJV, NIV, NLT, etc.)", () => {
    const nonCatholic = ["KJV", "NIV", "NLT", "ESV", "NASB", "MSG"];
    for (const t of nonCatholic) {
      expect(APPROVED_BIBLE_TRANSLATIONS as readonly string[]).not.toContain(t);
    }
  });

  it("NABRE (USCCB canonical) is in the approved set", () => {
    expect(APPROVED_BIBLE_TRANSLATIONS as readonly string[]).toContain("NABRE");
  });
});

describe("APPROVED_LICENSE_STATUSES — exactly the three the spec defines", () => {
  it("contains every spec-listed license status", () => {
    for (const s of SPEC_LICENSE_STATUSES) {
      expect(APPROVED_LICENSE_STATUSES as readonly string[]).toContain(s);
    }
  });

  it("contains no extras beyond the spec set", () => {
    for (const s of APPROVED_LICENSE_STATUSES as readonly string[]) {
      expect(SPEC_LICENSE_STATUSES as readonly string[]).toContain(s);
    }
  });

  it("has exactly 3 entries (public-domain / licensed-display / fair-use-reference-only)", () => {
    expect(APPROVED_LICENSE_STATUSES).toHaveLength(SPEC_LICENSE_STATUSES.length);
  });
});

describe("contract validator is wired to the runtime tuples", () => {
  it("rejects an unknown translation (e.g. NIV)", async () => {
    const { validateScriptureBlock } = await import("@/lib/content-qa/contracts/scripture");
    const result = validateScriptureBlock(
      {
        scriptureReference: "John 3:16",
        scriptureBook: "John",
        chapter: 3,
        verseStart: 16,
        bibleTranslationKey: "NIV",
        scriptureSource: "bible.usccb.org",
        licenseStatus: "public-domain",
        contentChecksum: "x",
      },
      { policyTranslation: "NABRE" },
    );
    expect(result.decision).not.toBe("publish");
    expect(result.failedFields).toContain("bibleTranslationKey");
  });

  it("rejects an unknown license status", async () => {
    const { validateScriptureBlock } = await import("@/lib/content-qa/contracts/scripture");
    const result = validateScriptureBlock(
      {
        scriptureReference: "John 3:16",
        scriptureBook: "John",
        chapter: 3,
        verseStart: 16,
        bibleTranslationKey: "NABRE",
        scriptureSource: "bible.usccb.org",
        licenseStatus: "totally-made-up",
        contentChecksum: "x",
      },
      { policyTranslation: "NABRE" },
    );
    expect(result.decision).not.toBe("publish");
    expect(result.failedFields).toContain("licenseStatus");
  });
});
