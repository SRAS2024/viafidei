/**
 * LiturgyPackage contract.
 *
 * Liturgy must contain formation, explanation, and structure related
 * to Catholic worship. It must NOT contain random Mass schedules,
 * livestreams, parish event posts, bulletins, or news articles.
 */

import { detectWrongContent, contentTypeMarkers } from "../wrong-content-detector";
import { isSourceApprovedFor, type SourcePurposeRecord } from "../source-purpose";
import type { CandidatePackage, ContractDecision, ContractValidationResult } from "../types";

const CONTRACT_NAME = "LiturgyPackage";
const CONTRACT_VERSION = "1.0.0";

export const VALID_LITURGY_KINDS = [
  "Mass structure",
  "Liturgical year",
  "Liturgical season",
  "Liturgical symbols",
  "Liturgical colors",
  "Marriage rite",
  "Funeral rite",
  "Ordination rite",
  "Sacramental rite explanation",
  "Glossary",
  "General liturgical formation",
] as const;

export type LiturgyKindLabel = (typeof VALID_LITURGY_KINDS)[number];

const LITURGY_KIND_LOOKUP = new Map<string, LiturgyKindLabel>(
  VALID_LITURGY_KINDS.map((t) => [t.toLowerCase(), t]),
);

export type LiturgyPackagePayload = {
  liturgyKind?: string | null;
  title?: string | null;
  summary?: string | null;
  body?: string | null;
};

export function validateLiturgyPackage(
  candidate: CandidatePackage & { payload: LiturgyPackagePayload },
  options: { sourcePurposes: SourcePurposeRecord },
): ContractValidationResult {
  const failedFields: string[] = [];
  const reasons: string[] = [];

  if (!isSourceApprovedFor(options.sourcePurposes, "Liturgy")) {
    return {
      decision: "reject",
      contractName: CONTRACT_NAME,
      contentType: "Liturgy",
      failedFields: ["sourceUrl"],
      reason: `Source '${candidate.sourceHost ?? "unknown"}' is not approved to ingest liturgy formation`,
      publicRenderReady: false,
      isThresholdEligible: false,
      contractVersion: CONTRACT_VERSION,
    };
  }

  const liturgyKind = candidate.payload.liturgyKind?.trim();
  const title = (candidate.payload.title ?? candidate.title ?? "").trim();
  const body = (candidate.payload.body ?? "").trim();

  if (!title) failedFields.push("title");
  if (!body) failedFields.push("body");
  if (!candidate.sourceUrl) failedFields.push("sourceUrl");
  if (!liturgyKind) failedFields.push("liturgyKind");
  else if (!LITURGY_KIND_LOOKUP.has(liturgyKind.toLowerCase())) {
    failedFields.push("liturgyKind");
    reasons.push(`liturgyKind '${liturgyKind}' is not in the allowed set`);
  }

  if (body && !contentTypeMarkers.liturgyFormation.test(body)) {
    failedFields.push("body");
    reasons.push("Liturgy body does not contain liturgical-formation vocabulary");
  }

  const wrong = detectWrongContent({ contentType: "Liturgy", title, body });
  if (wrong.delete) {
    return {
      decision: "delete",
      contractName: CONTRACT_NAME,
      contentType: "Liturgy",
      failedFields: ["body", ...failedFields].filter((v, i, a) => a.indexOf(v) === i),
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
      contentType: "Liturgy",
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
    contentType: "Liturgy",
    failedFields: [],
    reason: "All Liturgy contract requirements satisfied",
    publicRenderReady: true,
    isThresholdEligible: true,
    contractVersion: CONTRACT_VERSION,
  };
}

export const liturgyContractMeta = {
  name: CONTRACT_NAME,
  version: CONTRACT_VERSION,
  contentType: "Liturgy" as const,
  allowedKinds: VALID_LITURGY_KINDS,
};
