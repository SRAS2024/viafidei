/**
 * MarianApparitionPackage contract.
 *
 * A Marian apparition must be the actual apparition profile — not a
 * travel page, not a tourism article, not a parish named after Our
 * Lady, not a news post that merely mentions an apparition.
 */

import { detectWrongContent } from "../wrong-content-detector";
import { isSourceApprovedFor, type SourcePurposeRecord } from "../source-purpose";
import type { CandidatePackage, ContractDecision, ContractValidationResult } from "../types";

const CONTRACT_NAME = "MarianApparitionPackage";
const CONTRACT_VERSION = "1.0.0";

export const VALID_APPROVAL_STATUSES = [
  "Approved",
  "Worthy of belief",
  "Not approved",
  "Under investigation",
  "Condemned",
  "No official approval found",
] as const;

export type ApparitionApprovalStatus = (typeof VALID_APPROVAL_STATUSES)[number];

const APPROVAL_LOOKUP = new Map<string, ApparitionApprovalStatus>(
  VALID_APPROVAL_STATUSES.map((s) => [s.toLowerCase(), s]),
);

const APPARITION_VOCAB_RE =
  /\b(?:our\s+lady|blessed\s+virgin|virgin\s+mary|madonna|theotokos|notre\s+dame|nuestra\s+señora|appear(?:ed|ance)|apparition|vision|seer|visionary|message)\b/i;

const TRAVEL_TOURISM_RE =
  /\b(?:travel\s+(?:guide|tips?|advice)|tourism|tour\s+package|hotel|flight|airfare|book\s+(?:your|a)\s+(?:trip|tour)|how\s+to\s+visit|things\s+to\s+do)\b/i;

const FAMOUS_NAMES_RE =
  /\b(?:fatima|lourdes|guadalupe|knock|la\s+salette|akita|kibeho|champion)\b/i;

export type ApparitionPackagePayload = {
  apparitionName?: string | null;
  location?: string | null;
  country?: string | null;
  approvalStatus?: string | null;
  background?: string | null;
  summary?: string | null;
};

export function normalizeApprovalStatus(
  value: string | null | undefined,
): ApparitionApprovalStatus | null {
  if (!value) return null;
  return APPROVAL_LOOKUP.get(value.trim().toLowerCase()) ?? null;
}

export function validateApparitionPackage(
  candidate: CandidatePackage & { payload: ApparitionPackagePayload },
  options: { sourcePurposes: SourcePurposeRecord },
): ContractValidationResult {
  const failedFields: string[] = [];
  const reasons: string[] = [];

  if (!isSourceApprovedFor(options.sourcePurposes, "MarianApparition")) {
    return {
      decision: "reject",
      contractName: CONTRACT_NAME,
      contentType: "MarianApparition",
      failedFields: ["sourceUrl"],
      reason: `Source '${candidate.sourceHost ?? "unknown"}' is not approved to ingest apparitions`,
      publicRenderReady: false,
      isThresholdEligible: false,
      contractVersion: CONTRACT_VERSION,
    };
  }

  const apparitionName = (candidate.payload.apparitionName ?? candidate.title ?? "").trim();
  const location = (candidate.payload.location ?? "").trim();
  const country = (candidate.payload.country ?? "").trim();
  const approvalRaw = (candidate.payload.approvalStatus ?? "").trim();
  const background = (candidate.payload.background ?? "").trim();
  const summary = (candidate.payload.summary ?? "").trim();

  if (!apparitionName) failedFields.push("apparitionName");
  if (!location) failedFields.push("location");
  if (!country) failedFields.push("country");
  if (!background) failedFields.push("background");
  if (!summary) failedFields.push("summary");
  const approval = normalizeApprovalStatus(approvalRaw);
  if (!approval) {
    failedFields.push("approvalStatus");
    reasons.push(
      `approvalStatus '${approvalRaw}' is not one of: ${VALID_APPROVAL_STATUSES.join(", ")}`,
    );
  }

  const blob = `${apparitionName}\n${background}\n${summary}`;

  if (TRAVEL_TOURISM_RE.test(blob)) {
    return {
      decision: "delete",
      contractName: CONTRACT_NAME,
      contentType: "MarianApparition",
      failedFields: ["background"],
      reason: "Apparition candidate is a travel / tourism / booking page",
      publicRenderReady: false,
      isThresholdEligible: false,
      contractVersion: CONTRACT_VERSION,
    };
  }

  // Mentions a famous apparition name but does not actually describe
  // the apparition (no Marian vocabulary, no seer, no message): delete.
  if (FAMOUS_NAMES_RE.test(blob) && !APPARITION_VOCAB_RE.test(blob)) {
    return {
      decision: "delete",
      contractName: CONTRACT_NAME,
      contentType: "MarianApparition",
      failedFields: ["background"],
      reason:
        "Apparition candidate mentions Fatima/Lourdes/Guadalupe etc. but does not describe the apparition itself",
      publicRenderReady: false,
      isThresholdEligible: false,
      contractVersion: CONTRACT_VERSION,
    };
  }

  if (background && !APPARITION_VOCAB_RE.test(blob)) {
    failedFields.push("background");
    reasons.push("background lacks Marian apparition vocabulary");
  }

  const wrong = detectWrongContent({
    contentType: "MarianApparition",
    title: apparitionName,
    body: `${summary}\n${background}`,
  });
  if (wrong.delete) {
    return {
      decision: "delete",
      contractName: CONTRACT_NAME,
      contentType: "MarianApparition",
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
      contentType: "MarianApparition",
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
    contentType: "MarianApparition",
    failedFields: [],
    reason: "All MarianApparition contract requirements satisfied",
    publicRenderReady: true,
    isThresholdEligible: true,
    contractVersion: CONTRACT_VERSION,
  };
}

export function isApparitionRenderReady(row: {
  title: string;
  location?: string | null;
  country?: string | null;
  approvedStatus?: string | null;
  background?: string | null;
  summary: string;
}): boolean {
  if (!row.title || row.title.trim().length < 2) return false;
  if (!row.location || row.location.trim().length === 0) return false;
  if (!row.country || row.country.trim().length === 0) return false;
  if (!row.summary || row.summary.trim().length < 60) return false;
  if (!normalizeApprovalStatus(row.approvedStatus ?? null)) return false;
  return true;
}

export const apparitionContractMeta = {
  name: CONTRACT_NAME,
  version: CONTRACT_VERSION,
  contentType: "MarianApparition" as const,
  allowedApprovals: VALID_APPROVAL_STATUSES,
};
