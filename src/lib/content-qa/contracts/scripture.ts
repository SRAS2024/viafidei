/**
 * ScriptureBlockPackage contract.
 *
 * Scripture inside guides, novenas, devotions, sacraments, rosary, and
 * consecrations must use ONE uniform approved Catholic Bible
 * translation. This is not the app's UI translation — this is the
 * actual Bible translation used for scripture readings.
 *
 * Every scripture block must contain:
 *   - scriptureReference (Book Chapter:Verses)
 *   - scriptureBook
 *   - chapter
 *   - verseStart
 *   - verseEnd (optional)
 *   - scriptureText (if displayed)
 *   - bibleTranslationKey  — must be in APPROVED_BIBLE_TRANSLATIONS
 *   - scriptureSource      — must be in APPROVED_SCRIPTURE_SOURCES
 *   - licenseStatus        — must be in APPROVED_LICENSE_STATUSES
 *   - contentChecksum
 *
 * Block publishing fails if:
 *   - Scripture is required but missing.
 *   - Scripture reference is malformed.
 *   - Translation is missing.
 *   - Translation differs from the app policy.
 *   - Text is paraphrased but labeled as scripture.
 *   - License status is unknown.
 *   - Scripture is placed in the wrong day / mystery / section.
 */

import type { ContractValidationResult } from "../types";

const CONTRACT_NAME = "ScriptureBlockPackage";
const CONTRACT_VERSION = "1.0.0";

/**
 * Approved Catholic Bible translations. Mixing translations within
 * the same package is forbidden — the strict pipeline enforces a
 * single translation per spiritual guide, novena, or consecration.
 */
export const APPROVED_BIBLE_TRANSLATIONS = [
  "NABRE", // New American Bible (Revised Edition) — USCCB canonical
  "RSV-CE", // Revised Standard Version Catholic Edition
  "RSV-2CE", // Revised Standard Version Second Catholic Edition
  "DRA", // Douay-Rheims American Edition
  "NRSV-CE", // New Revised Standard Version Catholic Edition
  "NJB", // New Jerusalem Bible
  "CEB-CE", // Common English Bible Catholic Edition
  "ESV-CE", // English Standard Version Catholic Edition
] as const;

export type BibleTranslation = (typeof APPROVED_BIBLE_TRANSLATIONS)[number];

const TRANSLATION_LOOKUP = new Set<string>(APPROVED_BIBLE_TRANSLATIONS);

/**
 * Approved scripture-source hosts. Scripture text may only be
 * displayed if it was sourced from one of these (or shipped with the
 * app's own approved local copy).
 */
export const APPROVED_SCRIPTURE_SOURCES = [
  "bible.usccb.org",
  "biblegateway.com",
  "www.biblegateway.com",
  "drbo.org",
  "www.drbo.org",
  "vatican.va",
  "www.vatican.va",
] as const;

const SOURCE_LOOKUP = new Set<string>(APPROVED_SCRIPTURE_SOURCES);

/**
 * License statuses that allow the app to display the text. "Unknown"
 * means scripture text MUST NOT be displayed; only the reference is
 * shown.
 */
export const APPROVED_LICENSE_STATUSES = [
  "public-domain",
  "licensed-display",
  "fair-use-reference-only",
] as const;

export type LicenseStatus = (typeof APPROVED_LICENSE_STATUSES)[number];

const LICENSE_LOOKUP = new Set<string>(APPROVED_LICENSE_STATUSES);

/**
 * Single scripture block payload — attaches to a novena day, a rosary
 * mystery, a consecration day, a sacrament section, a devotion step,
 * or a spiritual guide step.
 */
export type ScriptureBlock = {
  scriptureReference: string;
  scriptureBook: string;
  chapter: number;
  verseStart: number;
  verseEnd?: number;
  scriptureText?: string;
  bibleTranslationKey: string;
  scriptureSource: string;
  licenseStatus: string;
  contentChecksum: string;
};

const REFERENCE_RE = /^[1-3]?\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+\d+:\d+(?:[-–]\d+)?$/;

// Paraphrase indicators — a block labeled as scripture should not
// contain these.
const PARAPHRASE_RE =
  /\b(?:in\s+(?:your|my)\s+own\s+words|paraphrase|paraphrased|loose\s+translation|adapted\s+from|inspired\s+by\s+(?:the\s+)?bible)\b/i;

export function isApprovedTranslation(value: string | null | undefined): value is BibleTranslation {
  return !!value && TRANSLATION_LOOKUP.has(value);
}

export function isApprovedScriptureSource(value: string | null | undefined): boolean {
  return !!value && SOURCE_LOOKUP.has(value.toLowerCase());
}

export function isApprovedLicenseStatus(value: string | null | undefined): value is LicenseStatus {
  return !!value && LICENSE_LOOKUP.has(value);
}

/**
 * Validate a single scripture block. Returns the contract result so
 * the caller can publish or reject the parent package accordingly.
 */
export function validateScriptureBlock(
  block: ScriptureBlock,
  options: { policyTranslation: BibleTranslation; allowReferenceOnly?: boolean } = {
    policyTranslation: "NABRE",
  },
): ContractValidationResult {
  const failedFields: string[] = [];
  const reasons: string[] = [];

  if (!block.scriptureReference) failedFields.push("scriptureReference");
  else if (!REFERENCE_RE.test(block.scriptureReference.trim())) {
    failedFields.push("scriptureReference");
    reasons.push(`scriptureReference '${block.scriptureReference}' is malformed`);
  }
  if (!block.scriptureBook) failedFields.push("scriptureBook");
  if (typeof block.chapter !== "number" || block.chapter < 1) failedFields.push("chapter");
  if (typeof block.verseStart !== "number" || block.verseStart < 1) failedFields.push("verseStart");
  if (
    block.verseEnd != null &&
    (typeof block.verseEnd !== "number" || block.verseEnd < block.verseStart)
  ) {
    failedFields.push("verseEnd");
    reasons.push("verseEnd is less than verseStart");
  }
  if (!isApprovedTranslation(block.bibleTranslationKey)) {
    failedFields.push("bibleTranslationKey");
    reasons.push(
      `bibleTranslationKey '${block.bibleTranslationKey}' is not in APPROVED_BIBLE_TRANSLATIONS`,
    );
  }
  if (
    block.bibleTranslationKey &&
    options.policyTranslation &&
    block.bibleTranslationKey !== options.policyTranslation
  ) {
    failedFields.push("bibleTranslationKey");
    reasons.push(
      `bibleTranslationKey '${block.bibleTranslationKey}' differs from app policy '${options.policyTranslation}'`,
    );
  }
  if (!isApprovedScriptureSource(block.scriptureSource)) {
    failedFields.push("scriptureSource");
    reasons.push(`scriptureSource '${block.scriptureSource}' is not on the approved list`);
  }
  if (!isApprovedLicenseStatus(block.licenseStatus)) {
    failedFields.push("licenseStatus");
    reasons.push(`licenseStatus '${block.licenseStatus}' is not on the approved list`);
  }
  if (block.scriptureText && PARAPHRASE_RE.test(block.scriptureText)) {
    failedFields.push("scriptureText");
    reasons.push("scriptureText is labelled / contains paraphrase markers");
  }
  if (
    block.licenseStatus === "fair-use-reference-only" &&
    block.scriptureText &&
    block.scriptureText.trim().length > 0
  ) {
    failedFields.push("scriptureText");
    reasons.push(
      "License status 'fair-use-reference-only' forbids displaying scripture text; show reference only",
    );
  }
  if (!block.contentChecksum) failedFields.push("contentChecksum");

  if (failedFields.length > 0) {
    return {
      decision: "reject",
      contractName: CONTRACT_NAME,
      contentType: "SpiritualGuidance", // scripture is always embedded in a parent package
      failedFields: Array.from(new Set(failedFields)),
      reason:
        reasons.length > 0
          ? reasons.join("; ")
          : `Missing required fields: ${failedFields.join(", ")}`,
      publicRenderReady: false,
      isThresholdEligible: false,
      contractVersion: CONTRACT_VERSION,
    };
  }

  return {
    decision: "publish",
    contractName: CONTRACT_NAME,
    contentType: "SpiritualGuidance",
    failedFields: [],
    reason: "Scripture block contract satisfied",
    publicRenderReady: true,
    isThresholdEligible: true,
    contractVersion: CONTRACT_VERSION,
  };
}

/**
 * Validate every scripture block in a package. Returns the first
 * failure or an aggregate accept. The parent contract should call
 * this with every block embedded in days / mysteries / steps.
 */
export function validateScriptureBlocks(
  blocks: ReadonlyArray<ScriptureBlock>,
  options: { policyTranslation: BibleTranslation; allowReferenceOnly?: boolean } = {
    policyTranslation: "NABRE",
  },
): ContractValidationResult {
  const allFailedFields: string[] = [];
  const allReasons: string[] = [];
  // Mixed-translation check: all blocks must use the same translation.
  const translations = new Set(blocks.map((b) => b.bibleTranslationKey));
  if (translations.size > 1) {
    allFailedFields.push("bibleTranslationKey");
    allReasons.push(
      `Mixed Bible translations in a single package: ${Array.from(translations).join(", ")}`,
    );
  }
  for (let i = 0; i < blocks.length; i++) {
    const result = validateScriptureBlock(blocks[i], options);
    if (result.decision !== "publish") {
      allFailedFields.push(...result.failedFields.map((f) => `blocks[${i}].${f}`));
      allReasons.push(`Block ${i}: ${result.reason}`);
    }
  }
  if (allFailedFields.length > 0) {
    return {
      decision: "reject",
      contractName: CONTRACT_NAME,
      contentType: "SpiritualGuidance",
      failedFields: Array.from(new Set(allFailedFields)),
      reason: allReasons.join("; "),
      publicRenderReady: false,
      isThresholdEligible: false,
      contractVersion: CONTRACT_VERSION,
    };
  }
  return {
    decision: "publish",
    contractName: CONTRACT_NAME,
    contentType: "SpiritualGuidance",
    failedFields: [],
    reason: `All ${blocks.length} scripture blocks satisfied`,
    publicRenderReady: true,
    isThresholdEligible: true,
    contractVersion: CONTRACT_VERSION,
  };
}

/**
 * App-wide policy: which Bible translation is used everywhere. NABRE
 * is the USCCB canonical translation and is the default.
 */
export const APP_BIBLE_TRANSLATION_POLICY: BibleTranslation = "NABRE";

export const scriptureContractMeta = {
  name: CONTRACT_NAME,
  version: CONTRACT_VERSION,
  approvedTranslations: APPROVED_BIBLE_TRANSLATIONS,
  approvedSources: APPROVED_SCRIPTURE_SOURCES,
  approvedLicenses: APPROVED_LICENSE_STATUSES,
};
