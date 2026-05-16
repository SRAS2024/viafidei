/**
 * ParishPackage contract.
 *
 * A Parish must be an actual parish directory record — not a bulletin,
 * not a livestream page, not an event page, not a school page, not a
 * donation page, not a staff page, not a Mass schedule by itself.
 */

import { detectWrongContent } from "../wrong-content-detector";
import { isSourceApprovedFor, type SourcePurposeRecord } from "../source-purpose";
import type { CandidatePackage, ContractDecision, ContractValidationResult } from "../types";

const CONTRACT_NAME = "ParishPackage";
const CONTRACT_VERSION = "1.0.0";

const SCHOOL_RE = /\b(?:school|academy|college|university|kindergarten|nursery)\b/i;
const NON_CATHOLIC_RE =
  /\b(?:baptist|methodist|lutheran|presbyterian|orthodox|anglican|episcopal|protestant|mosque|synagogue|temple|hindu|buddhist|seventh[-\s]?day\s+adventist|mormon|lds)\b/i;
const BULLETIN_TITLE_RE =
  /\b(?:bulletin|newsletter|weekly\s+update|sunday\s+bulletin|parish\s+(?:bulletin|news))\b/i;

export type ParishPackagePayload = {
  parishName?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  diocese?: string | null;
  websiteUrl?: string | null;
};

export function validateParishPackage(
  candidate: CandidatePackage & { payload: ParishPackagePayload },
  options: { sourcePurposes: SourcePurposeRecord },
): ContractValidationResult {
  const failedFields: string[] = [];
  const reasons: string[] = [];

  if (!isSourceApprovedFor(options.sourcePurposes, "Parish")) {
    return {
      decision: "reject",
      contractName: CONTRACT_NAME,
      contentType: "Parish",
      failedFields: ["sourceUrl"],
      reason: `Source '${candidate.sourceHost ?? "unknown"}' is not approved to ingest parishes`,
      publicRenderReady: false,
      isThresholdEligible: false,
      contractVersion: CONTRACT_VERSION,
    };
  }

  const parishName = (candidate.payload.parishName ?? candidate.title ?? "").trim();
  const address = (candidate.payload.address ?? "").trim();
  const city = (candidate.payload.city ?? "").trim();
  const country = (candidate.payload.country ?? "").trim();

  if (!parishName) failedFields.push("parishName");
  if (!country) failedFields.push("country");
  if (!city && !address) failedFields.push("city");
  if (!candidate.sourceUrl) failedFields.push("sourceUrl");

  // Reject schools / non-Catholic places of worship.
  if (
    SCHOOL_RE.test(parishName) &&
    !/\b(?:parish|church|cathedral|basilica|chapel)\b/i.test(parishName)
  ) {
    return {
      decision: "delete",
      contractName: CONTRACT_NAME,
      contentType: "Parish",
      failedFields: ["parishName"],
      reason: "Parish candidate looks like a school, not a parish",
      publicRenderReady: false,
      isThresholdEligible: false,
      contractVersion: CONTRACT_VERSION,
    };
  }
  if (NON_CATHOLIC_RE.test(parishName)) {
    return {
      decision: "reject",
      contractName: CONTRACT_NAME,
      contentType: "Parish",
      failedFields: ["parishName"],
      reason: "Parish candidate looks non-Catholic",
      publicRenderReady: false,
      isThresholdEligible: false,
      contractVersion: CONTRACT_VERSION,
    };
  }
  if (BULLETIN_TITLE_RE.test(parishName)) {
    return {
      decision: "delete",
      contractName: CONTRACT_NAME,
      contentType: "Parish",
      failedFields: ["parishName"],
      reason: "Parish candidate is itself a bulletin / newsletter page, not a parish record",
      publicRenderReady: false,
      isThresholdEligible: false,
      contractVersion: CONTRACT_VERSION,
    };
  }

  const wrong = detectWrongContent({
    contentType: "Parish",
    title: parishName,
    body: `${address}\n${city}\n${country}`,
  });
  if (wrong.delete) {
    return {
      decision: "delete",
      contractName: CONTRACT_NAME,
      contentType: "Parish",
      failedFields: ["parishName", ...failedFields].filter((v, i, a) => a.indexOf(v) === i),
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
      contentType: "Parish",
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
    contentType: "Parish",
    failedFields: [],
    reason: "All Parish contract requirements satisfied",
    publicRenderReady: true,
    isThresholdEligible: true,
    contractVersion: CONTRACT_VERSION,
  };
}

export function isParishRenderReady(row: {
  name: string;
  city?: string | null;
  address?: string | null;
  country?: string | null;
}): boolean {
  if (!row.name || row.name.trim().length < 2) return false;
  if (!row.country || row.country.trim().length === 0) return false;
  if (!row.city && !row.address) return false;
  return true;
}

export const parishContractMeta = {
  name: CONTRACT_NAME,
  version: CONTRACT_VERSION,
  contentType: "Parish" as const,
};
