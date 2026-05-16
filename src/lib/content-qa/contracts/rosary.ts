/**
 * RosaryPackage contract.
 *
 * The Rosary must be a strict structured devotion / spiritual guide.
 * It must not be a loose article about the Rosary. It must include
 * the core prayers, the mystery sets, the decade structure, and how
 * to pray it.
 */

import { detectWrongContent } from "../wrong-content-detector";
import { isSourceApprovedFor, type SourcePurposeRecord } from "../source-purpose";
import type { CandidatePackage, ContractDecision, ContractValidationResult } from "../types";

const CONTRACT_NAME = "RosaryPackage";
const CONTRACT_VERSION = "1.0.0";

export const REQUIRED_ROSARY_PRAYERS = [
  "Sign of the Cross",
  "Apostles' Creed",
  "Our Father",
  "Hail Mary",
  "Glory Be",
  "Hail Holy Queen",
] as const;

export const VALID_MYSTERY_SETS = [
  "Joyful Mysteries",
  "Sorrowful Mysteries",
  "Glorious Mysteries",
  "Luminous Mysteries",
] as const;

export type Mystery = {
  name: string;
  order: number;
  scriptureReference?: string;
  meditation?: string;
};

export type MysterySet = {
  name: (typeof VALID_MYSTERY_SETS)[number] | string;
  mysteries: Mystery[];
};

export type RosaryPackagePayload = {
  title?: string | null;
  background?: string | null;
  howToPray?: string | null;
  openingPrayers?: string[] | null;
  mysterySets?: MysterySet[] | null;
  decadeStructure?: string | null;
  closingPrayers?: string[] | null;
};

export function validateRosaryPackage(
  candidate: CandidatePackage & { payload: RosaryPackagePayload },
  options: { sourcePurposes: SourcePurposeRecord },
): ContractValidationResult {
  const failedFields: string[] = [];
  const reasons: string[] = [];

  if (!isSourceApprovedFor(options.sourcePurposes, "Rosary")) {
    return {
      decision: "reject",
      contractName: CONTRACT_NAME,
      contentType: "Rosary",
      failedFields: ["sourceUrl"],
      reason: `Source '${candidate.sourceHost ?? "unknown"}' is not approved to ingest Rosary guides`,
      publicRenderReady: false,
      isThresholdEligible: false,
      contractVersion: CONTRACT_VERSION,
    };
  }

  const title = (candidate.payload.title ?? candidate.title ?? "").trim();
  const background = (candidate.payload.background ?? "").trim();
  const howToPray = (candidate.payload.howToPray ?? "").trim();
  const openingPrayers = candidate.payload.openingPrayers ?? [];
  const mysterySets = candidate.payload.mysterySets ?? [];
  const decadeStructure = (candidate.payload.decadeStructure ?? "").trim();

  if (!title) failedFields.push("title");
  if (!background) failedFields.push("background");
  if (!howToPray) failedFields.push("howToPray");
  if (!decadeStructure) failedFields.push("decadeStructure");
  if (!candidate.sourceUrl) failedFields.push("sourceUrl");

  // Core prayers must be present somewhere in openingPrayers /
  // howToPray.
  const blob = `${howToPray}\n${openingPrayers.join("\n")}\n${(candidate.payload.closingPrayers ?? []).join("\n")}`;
  for (const required of REQUIRED_ROSARY_PRAYERS) {
    if (!new RegExp(required.replace(/'/g, "['’]?"), "i").test(blob)) {
      failedFields.push("openingPrayers");
      reasons.push(`Required Rosary prayer missing: ${required}`);
    }
  }

  // Mystery sets: need at least Joyful + Sorrowful + Glorious.
  const setNames = new Set(mysterySets.map((s) => s.name));
  for (const required of ["Joyful Mysteries", "Sorrowful Mysteries", "Glorious Mysteries"]) {
    if (!setNames.has(required)) {
      failedFields.push("mysterySets");
      reasons.push(`Required mystery set missing: ${required}`);
    }
  }
  // Each present mystery set must contain exactly five mysteries.
  for (const set of mysterySets) {
    if (!Array.isArray(set.mysteries) || set.mysteries.length !== 5) {
      failedFields.push("mysterySets");
      reasons.push(`Mystery set '${set.name}' must contain exactly 5 mysteries`);
    }
  }

  const wrong = detectWrongContent({
    contentType: "Rosary",
    title,
    body: `${background}\n${howToPray}`,
  });
  if (wrong.delete) {
    return {
      decision: "delete",
      contractName: CONTRACT_NAME,
      contentType: "Rosary",
      failedFields: ["howToPray", ...failedFields].filter((v, i, a) => a.indexOf(v) === i),
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
      contentType: "Rosary",
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
    contentType: "Rosary",
    failedFields: [],
    reason: "All Rosary contract requirements satisfied",
    publicRenderReady: true,
    isThresholdEligible: true,
    contractVersion: CONTRACT_VERSION,
  };
}

export const rosaryContractMeta = {
  name: CONTRACT_NAME,
  version: CONTRACT_VERSION,
  contentType: "Rosary" as const,
  requiredPrayers: REQUIRED_ROSARY_PRAYERS,
  validMysterySets: VALID_MYSTERY_SETS,
};
