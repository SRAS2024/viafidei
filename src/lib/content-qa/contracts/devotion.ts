/**
 * DevotionPackage contract.
 *
 * A Devotion must be the actual devotion and how to practice it. Not
 * an article about a devotion, not a livestream, not an event. It must
 * be usable by the reader.
 */

import { detectWrongContent, contentTypeMarkers } from "../wrong-content-detector";
import { isSourceApprovedFor, type SourcePurposeRecord } from "../source-purpose";
import type { CandidatePackage, ContractDecision, ContractValidationResult } from "../types";

const CONTRACT_NAME = "DevotionPackage";
const CONTRACT_VERSION = "1.0.0";

export const VALID_DEVOTION_TYPES = [
  "Sacred Heart",
  "Immaculate Heart",
  "Divine Mercy",
  "Eucharistic devotion",
  "Marian devotion",
  "Saint devotion",
  "Chaplet",
  "Litany",
  "First Friday",
  "First Saturday",
  "Rosary",
  "Novena",
  "Consecration",
  "Stations of the Cross",
  "Adoration devotion",
] as const;

export type DevotionType = (typeof VALID_DEVOTION_TYPES)[number];

const DEVOTION_TYPE_LOOKUP = new Map<string, DevotionType>(
  VALID_DEVOTION_TYPES.map((t) => [t.toLowerCase(), t]),
);

export type DevotionPackagePayload = {
  devotionType?: string | null;
  devotionName?: string | null;
  background?: string | null;
  practiceInstructions?: string | null;
  prayerStructure?: string | null;
  duration?: string | number | null;
};

export function validateDevotionPackage(
  candidate: CandidatePackage & { payload: DevotionPackagePayload },
  options: { sourcePurposes: SourcePurposeRecord },
): ContractValidationResult {
  const failedFields: string[] = [];
  const reasons: string[] = [];

  if (!isSourceApprovedFor(options.sourcePurposes, "Devotion")) {
    return {
      decision: "reject",
      contractName: CONTRACT_NAME,
      contentType: "Devotion",
      failedFields: ["sourceUrl"],
      reason: `Source '${candidate.sourceHost ?? "unknown"}' is not approved to ingest devotions`,
      publicRenderReady: false,
      isThresholdEligible: false,
      contractVersion: CONTRACT_VERSION,
    };
  }

  const devotionType = candidate.payload.devotionType?.trim();
  const devotionName = (candidate.payload.devotionName ?? candidate.title ?? "").trim();
  const background = (candidate.payload.background ?? "").trim();
  const practice = (candidate.payload.practiceInstructions ?? "").trim();

  if (!devotionName) failedFields.push("devotionName");
  if (!devotionType) failedFields.push("devotionType");
  else if (!DEVOTION_TYPE_LOOKUP.has(devotionType.toLowerCase())) {
    failedFields.push("devotionType");
    reasons.push(`devotionType '${devotionType}' is not in the allowed set`);
  }
  if (!background) failedFields.push("background");
  if (!practice) failedFields.push("practiceInstructions");

  // ── Practice instructions must include practice language ──
  if (practice && !contentTypeMarkers.devotionPractice.test(practice)) {
    failedFields.push("practiceInstructions");
    reasons.push("practiceInstructions lacks practice language (steps / day / pray / recite)");
  }

  const wrong = detectWrongContent({
    contentType: "Devotion",
    title: devotionName,
    body: `${background}\n${practice}`,
  });
  if (wrong.delete) {
    return {
      decision: "delete",
      contractName: CONTRACT_NAME,
      contentType: "Devotion",
      failedFields: ["practiceInstructions", ...failedFields].filter(
        (v, i, a) => a.indexOf(v) === i,
      ),
      reason: wrong.reasons.join("; "),
      publicRenderReady: false,
      isThresholdEligible: false,
      contractVersion: CONTRACT_VERSION,
    };
  }

  if (failedFields.length > 0) {
    const decision: ContractDecision = "reject";
    return {
      decision,
      contractName: CONTRACT_NAME,
      contentType: "Devotion",
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
    contentType: "Devotion",
    failedFields: [],
    reason: "All Devotion contract requirements satisfied",
    publicRenderReady: true,
    isThresholdEligible: true,
    contractVersion: CONTRACT_VERSION,
  };
}

export function isDevotionRenderReady(row: {
  devotionType?: string | null;
  title: string;
  background?: string | null;
  practiceInstructions?: string | null;
  summary: string;
}): boolean {
  if (!row.devotionType || !DEVOTION_TYPE_LOOKUP.has(row.devotionType.toLowerCase())) return false;
  if (!row.title || row.title.trim().length < 2) return false;
  const background = row.background ?? row.summary;
  if (!background || background.trim().length === 0) return false;
  if (!row.practiceInstructions || row.practiceInstructions.trim().length === 0) return false;
  return true;
}

export const devotionContractMeta = {
  name: CONTRACT_NAME,
  version: CONTRACT_VERSION,
  contentType: "Devotion" as const,
  allowedTypes: VALID_DEVOTION_TYPES,
};
