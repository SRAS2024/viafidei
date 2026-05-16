/**
 * PrayerPackage contract.
 *
 * A Prayer must be the actual prayer itself — not an article about a
 * prayer, not a livestream of a prayer service, not a parish prayer
 * event listing, not a reflection mentioning a prayer.
 *
 * Required:
 *   - contentType = Prayer
 *   - prayerType  — one of VALID_PRAYER_TYPES
 *   - prayerName  — the title of the prayer
 *   - prayerText  — the actual words of the prayer
 *   - category    — the category bucket (Marian / Eucharistic / etc.)
 *   - sourceUrl   — source page URL
 *   - sourceHost  — host of the source URL
 *   - language    — language code
 *   - contentChecksum
 *   - formattingStatus = valid
 *   - publicRenderReady = true
 *
 * Prayer text must contain at least one recognizable prayer-language
 * marker (Amen, O Lord, Hail Mary, Glory be, "Lord have mercy", "Pray
 * for us", "In the name of the Father", "I believe", etc.).
 *
 * Wrong-content signals (livestream / event / news / press / blog /
 * parish service listing) trigger immediate delete.
 */

import { detectWrongContent, contentTypeMarkers } from "../wrong-content-detector";
import { isSourceApprovedFor, type SourcePurposeRecord } from "../source-purpose";
import type { CandidatePackage, ContractDecision, ContractValidationResult } from "../types";

const CONTRACT_NAME = "PrayerPackage";
const CONTRACT_VERSION = "1.0.0";

export const VALID_PRAYER_TYPES = [
  "Marian prayer",
  "Eucharistic prayer",
  "Morning prayer",
  "Evening prayer",
  "Repentance prayer",
  "Saint intercession prayer",
  "Litany",
  "Rosary prayer",
  "Chaplet prayer",
  "Novena prayer",
  "Traditional Catholic prayer",
  "Devotional prayer",
  "Act of contrition",
  "Blessing",
  "Consecration prayer",
] as const;

export type PrayerType = (typeof VALID_PRAYER_TYPES)[number];

const PRAYER_TYPE_LOOKUP = new Map<string, PrayerType>(
  VALID_PRAYER_TYPES.map((t) => [t.toLowerCase(), t]),
);

/**
 * Allowed formatting characters (lines, paragraphs, sentence breaks).
 * Disallowed: navigation tokens, footer text, share buttons, author
 * biographies, livestream labels, video titles, event dates, register
 * links, donation links, HTML markup remnants.
 */
const FORMATTING_GARBAGE_RE: ReadonlyArray<RegExp> = [
  /<[^>]+>/, // raw HTML tags
  /\b(share\s+(?:this|on)|share\s+to|tweet\s+this|email\s+this|print\s+this)\b/i,
  /\b(?:register\s+(?:now|today|here)|donate\s+(?:now|today|here)|click\s+here)\b/i,
  /\b(?:author\s+biography|about\s+the\s+author|published\s+by|originally\s+(?:posted|published))\b/i,
  /\b(?:livestream|watch\s+live|youtube\s+link|video\s+(?:title|description))\b/i,
  /\b(?:event\s+date|mass\s+schedule|read\s+more|continue\s+reading)\b/i,
  /(?:^|\s)\[(?:edit|expand|collapse|hide)\]/i,
];

export type PrayerPackagePayload = {
  prayerType?: string | null;
  prayerName?: string | null;
  prayerText?: string | null;
  category?: string | null;
  language?: string | null;
  contentChecksum?: string | null;
};

/**
 * Validate a Prayer candidate against the contract. Returns the
 * decision the runner / janitor must honour.
 */
export function validatePrayerPackage(
  candidate: CandidatePackage & { payload: PrayerPackagePayload },
  options: { sourcePurposes: SourcePurposeRecord },
): ContractValidationResult {
  const failedFields: string[] = [];
  const reasons: string[] = [];

  // ── Source-purpose gate ──
  if (!isSourceApprovedFor(options.sourcePurposes, "Prayer")) {
    return {
      decision: "reject",
      contractName: CONTRACT_NAME,
      contentType: "Prayer",
      failedFields: ["sourceUrl"],
      reason: `Source '${candidate.sourceHost ?? "unknown"}' is not approved to ingest prayers (canIngestPrayers=false)`,
      publicRenderReady: false,
      isThresholdEligible: false,
      contractVersion: CONTRACT_VERSION,
    };
  }

  const prayerType = candidate.payload.prayerType?.trim();
  const prayerName = (candidate.payload.prayerName ?? candidate.title ?? "").trim();
  const prayerText = (candidate.payload.prayerText ?? "").trim();
  const category = (candidate.payload.category ?? "").trim();
  const language = (candidate.payload.language ?? "en").trim();
  const sourceUrl = candidate.sourceUrl?.trim();

  // ── Required fields ──
  if (!prayerName) failedFields.push("prayerName");
  if (!prayerType) failedFields.push("prayerType");
  if (!prayerText) failedFields.push("prayerText");
  if (!category) failedFields.push("category");
  if (!sourceUrl) failedFields.push("sourceUrl");
  if (!language) failedFields.push("language");

  // ── Allowed prayer type ──
  if (prayerType && !PRAYER_TYPE_LOOKUP.has(prayerType.toLowerCase())) {
    failedFields.push("prayerType");
    reasons.push(`prayerType '${prayerType}' is not in the allowed set`);
  }

  // ── Prayer text length ──
  if (prayerText && prayerText.length < 30) {
    failedFields.push("prayerText");
    reasons.push("prayerText is too short to be a real prayer");
  }

  // ── Body must contain prayer language ──
  if (prayerText && !contentTypeMarkers.prayer.test(prayerText)) {
    failedFields.push("prayerText");
    reasons.push("prayerText lacks recognisable prayer language (Amen, O Lord, Hail Mary, etc.)");
  }

  // ── Formatting garbage ──
  for (const re of FORMATTING_GARBAGE_RE) {
    if (re.test(prayerText)) {
      failedFields.push("formatting");
      reasons.push(`prayerText contains disallowed formatting (${re.source})`);
      break;
    }
  }

  // ── Wrong-content detector ──
  const wrong = detectWrongContent({
    contentType: "Prayer",
    title: prayerName,
    body: prayerText,
  });
  if (wrong.delete) {
    return {
      decision: "delete",
      contractName: CONTRACT_NAME,
      contentType: "Prayer",
      failedFields: ["prayerText", ...failedFields].filter((v, i, a) => a.indexOf(v) === i),
      reason: wrong.reasons.join("; "),
      publicRenderReady: false,
      isThresholdEligible: false,
      contractVersion: CONTRACT_VERSION,
    };
  }

  // ── Decision ──
  if (failedFields.length > 0) {
    const decision: ContractDecision = "reject";
    return {
      decision,
      contractName: CONTRACT_NAME,
      contentType: "Prayer",
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
    contentType: "Prayer",
    failedFields: [],
    reason: "All Prayer contract requirements satisfied",
    publicRenderReady: true,
    isThresholdEligible: true,
    contractVersion: CONTRACT_VERSION,
  };
}

/**
 * Render-readiness gate for the public Prayer page. Returns true only
 * when every required section can render. Called by the public-page
 * layer just before display, as a belt-and-suspenders backup to the
 * stored publicRenderReady flag.
 */
export function isPrayerRenderReady(row: {
  prayerType?: string | null;
  defaultTitle: string;
  body: string;
}): boolean {
  if (!row.prayerType || !PRAYER_TYPE_LOOKUP.has(row.prayerType.toLowerCase())) return false;
  if (!row.defaultTitle || row.defaultTitle.trim().length < 2) return false;
  if (!row.body || row.body.trim().length < 30) return false;
  if (!contentTypeMarkers.prayer.test(row.body)) return false;
  return true;
}

export const prayerContractMeta = {
  name: CONTRACT_NAME,
  version: CONTRACT_VERSION,
  contentType: "Prayer" as const,
  allowedTypes: VALID_PRAYER_TYPES,
};
