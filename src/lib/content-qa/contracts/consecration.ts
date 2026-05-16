/**
 * ConsecrationPackage contract.
 *
 * A Consecration must be a complete structured guide, usually multi-
 * day, with background, required prayers, daily structure, and a
 * final consecration prayer. It must not be a retreat advertisement,
 * an event announcement, or an article about consecration.
 */

import { detectWrongContent } from "../wrong-content-detector";
import { isSourceApprovedFor, type SourcePurposeRecord } from "../source-purpose";
import type { CandidatePackage, ContractDecision, ContractValidationResult } from "../types";

const CONTRACT_NAME = "ConsecrationPackage";
const CONTRACT_VERSION = "1.0.0";

export type ConsecrationDay = {
  dayNumber: number;
  prayers: string[];
  readings?: string[];
};

export type ConsecrationPackagePayload = {
  consecrationName?: string | null;
  background?: string | null;
  durationDays?: number | null;
  dailyStructure?: string | null;
  dailyPrayers?: ConsecrationDay[] | null;
  finalConsecrationPrayer?: string | null;
  scriptureReadings?: string[] | null;
};

export function validateConsecrationPackage(
  candidate: CandidatePackage & { payload: ConsecrationPackagePayload },
  options: { sourcePurposes: SourcePurposeRecord },
): ContractValidationResult {
  const failedFields: string[] = [];
  const reasons: string[] = [];

  if (!isSourceApprovedFor(options.sourcePurposes, "Consecration")) {
    return {
      decision: "reject",
      contractName: CONTRACT_NAME,
      contentType: "Consecration",
      failedFields: ["sourceUrl"],
      reason: `Source '${candidate.sourceHost ?? "unknown"}' is not approved to ingest consecrations`,
      publicRenderReady: false,
      isThresholdEligible: false,
      contractVersion: CONTRACT_VERSION,
    };
  }

  const name = (candidate.payload.consecrationName ?? candidate.title ?? "").trim();
  const background = (candidate.payload.background ?? "").trim();
  const durationDays = candidate.payload.durationDays ?? null;
  const days = candidate.payload.dailyPrayers ?? [];
  const finalPrayer = (candidate.payload.finalConsecrationPrayer ?? "").trim();

  if (!name) failedFields.push("consecrationName");
  if (!background) failedFields.push("background");
  if (!candidate.sourceUrl) failedFields.push("sourceUrl");
  if (!durationDays || durationDays < 1) failedFields.push("durationDays");
  if (!Array.isArray(days) || days.length === 0) failedFields.push("dailyPrayers");
  if (!finalPrayer) failedFields.push("finalConsecrationPrayer");

  if (Array.isArray(days) && durationDays && days.length !== durationDays) {
    failedFields.push("dailyPrayers");
    reasons.push(`dailyPrayers length ${days.length} does not match durationDays ${durationDays}`);
  }
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    if (!d || !Array.isArray(d.prayers) || d.prayers.length === 0) {
      failedFields.push(`dailyPrayers[${i}].prayers`);
      reasons.push(`Day ${i + 1} of consecration has no prayers`);
    }
  }

  const wrong = detectWrongContent({
    contentType: "Consecration",
    title: name,
    body: background,
  });
  if (wrong.delete) {
    return {
      decision: "delete",
      contractName: CONTRACT_NAME,
      contentType: "Consecration",
      failedFields: ["background", ...failedFields].filter((v, i, a) => a.indexOf(v) === i),
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
      contentType: "Consecration",
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
    contentType: "Consecration",
    failedFields: [],
    reason: "All Consecration contract requirements satisfied",
    publicRenderReady: true,
    isThresholdEligible: true,
    contractVersion: CONTRACT_VERSION,
  };
}

export const consecrationContractMeta = {
  name: CONTRACT_NAME,
  version: CONTRACT_VERSION,
  contentType: "Consecration" as const,
};
