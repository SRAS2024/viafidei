import { describe, expect, it } from "vitest";
import {
  validateScriptureBlock,
  validateScriptureBlocks,
  APP_BIBLE_TRANSLATION_POLICY,
} from "@/lib/content-qa/contracts/scripture";

describe("ScriptureBlockPackage contract", () => {
  const validBlock = {
    scriptureReference: "John 3:16",
    scriptureBook: "John",
    chapter: 3,
    verseStart: 16,
    verseEnd: 16,
    scriptureText: "For God so loved the world...",
    bibleTranslationKey: "NABRE",
    scriptureSource: "bible.usccb.org",
    licenseStatus: "public-domain",
    contentChecksum: "sha256-abc",
  };

  it("accepts an approved translation", () => {
    const result = validateScriptureBlock(validBlock);
    expect(result.decision).toBe("publish");
  });

  it("rejects an unknown translation", () => {
    const result = validateScriptureBlock({ ...validBlock, bibleTranslationKey: "KJV" });
    expect(result.decision).toBe("reject");
    expect(result.failedFields).toContain("bibleTranslationKey");
  });

  it("rejects a malformed reference", () => {
    const result = validateScriptureBlock({ ...validBlock, scriptureReference: "John 3" });
    expect(result.decision).toBe("reject");
    expect(result.failedFields).toContain("scriptureReference");
  });

  it("rejects an unknown license status", () => {
    const result = validateScriptureBlock({ ...validBlock, licenseStatus: "unknown" });
    expect(result.decision).toBe("reject");
    expect(result.failedFields).toContain("licenseStatus");
  });

  it("rejects a paraphrase labeled as scripture", () => {
    const result = validateScriptureBlock({
      ...validBlock,
      scriptureText: "In my own words, John 3:16 says...",
    });
    expect(result.decision).toBe("reject");
    expect(result.failedFields).toContain("scriptureText");
  });

  it("rejects mixed translations in a multi-block package", () => {
    const result = validateScriptureBlocks([
      { ...validBlock, bibleTranslationKey: "NABRE" },
      { ...validBlock, bibleTranslationKey: "RSV-CE" },
    ]);
    expect(result.decision).toBe("reject");
    expect(result.failedFields).toContain("bibleTranslationKey");
  });

  it("rejects blocks that differ from the app policy translation", () => {
    const result = validateScriptureBlock(
      { ...validBlock, bibleTranslationKey: "DRA" },
      { policyTranslation: "NABRE" },
    );
    expect(result.decision).toBe("reject");
  });

  it("default app policy translation is NABRE", () => {
    expect(APP_BIBLE_TRANSLATION_POLICY).toBe("NABRE");
  });

  it("blocks publishing when scripture text is displayed with reference-only license", () => {
    const result = validateScriptureBlock({
      ...validBlock,
      licenseStatus: "fair-use-reference-only",
      scriptureText: "For God so loved the world...",
    });
    expect(result.decision).toBe("reject");
    expect(result.failedFields).toContain("scriptureText");
  });
});
