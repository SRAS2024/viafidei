/**
 * SacramentPackage contract.
 *
 * The only valid sacrament keys are the seven canonical sacraments.
 * Confession does NOT exist as a separate threshold; it collapses to
 * Reconciliation. Aliases normalize via `normalizeSacrament`.
 *
 * A Sacrament must contain Catholic sacramental explanation,
 * preparation guidance, and participation guidance. Plain registration
 * pages / parish schedules / school announcements / livestreams are
 * deleted.
 */

import { detectWrongContent, contentTypeMarkers } from "../wrong-content-detector";
import { isSourceApprovedFor, type SourcePurposeRecord } from "../source-purpose";
import {
  SACRAMENT_KEYS,
  SACRAMENT_LABELS,
  SACRAMENT_GROUPS,
  SACRAMENT_GROUP_BY_KEY,
  isCanonicalSacramentKey,
  normalizeSacrament,
  type SacramentKey,
  type SacramentGroup,
} from "../sacrament-normalize";
import type { CandidatePackage, ContractDecision, ContractValidationResult } from "../types";

const CONTRACT_NAME = "SacramentPackage";
const CONTRACT_VERSION = "1.0.0";

export type SacramentPackagePayload = {
  sacramentKey?: string | null;
  sacramentName?: string | null;
  sacramentGroup?: string | null;
  background?: string | null;
  catholicExplanation?: string | null;
  biblicalFoundation?: string | null;
  catechismReferences?: string[] | null;
  preparationGuide?: string | null;
  participationGuide?: string | null;
};

export function validateSacramentPackage(
  candidate: CandidatePackage & { payload: SacramentPackagePayload },
  options: { sourcePurposes: SourcePurposeRecord },
): ContractValidationResult {
  const failedFields: string[] = [];
  const reasons: string[] = [];

  if (!isSourceApprovedFor(options.sourcePurposes, "Sacrament")) {
    return {
      decision: "reject",
      contractName: CONTRACT_NAME,
      contentType: "Sacrament",
      failedFields: ["sourceUrl"],
      reason: `Source '${candidate.sourceHost ?? "unknown"}' is not approved to ingest sacraments`,
      publicRenderReady: false,
      isThresholdEligible: false,
      contractVersion: CONTRACT_VERSION,
    };
  }

  // ── Normalize / validate sacrament key ──
  const rawKey = (candidate.payload.sacramentKey ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  let sacramentKey: SacramentKey | null = null;
  if (isCanonicalSacramentKey(rawKey)) {
    sacramentKey = rawKey;
  } else {
    const normalized = normalizeSacrament({
      title: candidate.payload.sacramentName ?? candidate.title,
      body: `${candidate.payload.background ?? ""}\n${candidate.payload.catholicExplanation ?? ""}`,
    });
    sacramentKey = normalized.key;
  }
  if (!sacramentKey) {
    return {
      decision: "delete",
      contractName: CONTRACT_NAME,
      contentType: "Sacrament",
      failedFields: ["sacramentKey"],
      reason: "Sacrament candidate does not match any of the seven canonical sacraments",
      publicRenderReady: false,
      isThresholdEligible: false,
      contractVersion: CONTRACT_VERSION,
    };
  }

  const sacramentName = candidate.payload.sacramentName ?? SACRAMENT_LABELS[sacramentKey];
  // sacramentGroup is set by the persister using SACRAMENT_GROUP_BY_KEY[sacramentKey].
  const background = (candidate.payload.background ?? "").trim();
  const catholicExplanation = (candidate.payload.catholicExplanation ?? "").trim();
  const preparation = (candidate.payload.preparationGuide ?? "").trim();
  const participation = (candidate.payload.participationGuide ?? "").trim();

  if (!sacramentName) failedFields.push("sacramentName");
  if (!background) failedFields.push("background");
  if (!catholicExplanation) failedFields.push("catholicExplanation");
  if (!preparation) failedFields.push("preparationGuide");
  if (!participation) failedFields.push("participationGuide");

  // The body must read like sacramental formation.
  const blob = `${background}\n${catholicExplanation}\n${preparation}\n${participation}`;
  if (blob.trim() && !contentTypeMarkers.sacramentFormation.test(blob)) {
    failedFields.push("catholicExplanation");
    reasons.push("Sacrament body lacks sacramental-formation vocabulary");
  }

  const wrong = detectWrongContent({
    contentType: "Sacrament",
    title: sacramentName,
    body: blob,
  });
  if (wrong.delete) {
    return {
      decision: "delete",
      contractName: CONTRACT_NAME,
      contentType: "Sacrament",
      failedFields: ["catholicExplanation", ...failedFields].filter(
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
      contentType: "Sacrament",
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
    contentType: "Sacrament",
    failedFields: [],
    reason: "All Sacrament contract requirements satisfied",
    publicRenderReady: true,
    isThresholdEligible: true,
    contractVersion: CONTRACT_VERSION,
  };
}

export function isSacramentRenderReady(row: {
  sacramentKey?: string | null;
  sacramentGroup?: string | null;
  title: string;
  background?: string | null;
  bodyText?: string | null;
  summary?: string | null;
  packageMetadata?: unknown;
}): boolean {
  if (!isCanonicalSacramentKey(row.sacramentKey)) return false;
  if (
    !row.sacramentGroup ||
    !(SACRAMENT_GROUPS as ReadonlyArray<string>).includes(row.sacramentGroup)
  ) {
    return false;
  }
  if (!row.title || row.title.trim().length < 2) return false;
  const body = row.bodyText ?? row.summary ?? "";
  if (!body || body.trim().length === 0) return false;
  return true;
}

export const sacramentContractMeta = {
  name: CONTRACT_NAME,
  version: CONTRACT_VERSION,
  contentType: "Sacrament" as const,
  validKeys: SACRAMENT_KEYS,
};

export {
  SACRAMENT_KEYS,
  SACRAMENT_LABELS,
  SACRAMENT_GROUPS,
  SACRAMENT_GROUP_BY_KEY,
  isCanonicalSacramentKey,
  normalizeSacrament,
};
export type { SacramentKey, SacramentGroup };
