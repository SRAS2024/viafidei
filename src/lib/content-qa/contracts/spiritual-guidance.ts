/**
 * SpiritualGuidancePackage contract.
 *
 * Spiritual Guidance contains practical Catholic guides — examination
 * of conscience, confession preparation, adoration guide, prayer
 * routine, etc. It must NOT be inspirational posts, vague articles,
 * event pages, or random scraped text.
 */

import { detectWrongContent } from "../wrong-content-detector";
import { isSourceApprovedFor, type SourcePurposeRecord } from "../source-purpose";
import type { CandidatePackage, ContractDecision, ContractValidationResult } from "../types";

const CONTRACT_NAME = "SpiritualGuidancePackage";
const CONTRACT_VERSION = "1.0.0";

export const VALID_GUIDE_TYPES = [
  "Examination of conscience",
  "Confession preparation",
  "Adoration guide",
  "Prayer routine",
  "Discernment guide",
  "Vocation guide",
  "Fasting guide",
  "Spiritual reading guide",
  "Lectio Divina guide",
  "Retreat at home guide",
  "Consecration guide",
  "Rosary guide",
] as const;

export type GuideType = (typeof VALID_GUIDE_TYPES)[number];

const GUIDE_TYPE_LOOKUP = new Map<string, GuideType>(
  VALID_GUIDE_TYPES.map((t) => [t.toLowerCase(), t]),
);

const CATHOLIC_FRAMING_RE =
  /\b(?:catholic|christ|jesus|holy\s+spirit|saint|sacrament|grace|prayer|scripture|gospel|church|magisterium|mass|liturgy|virtue|sin|repent|confess|examination)\b/i;

export type SpiritualGuidancePackagePayload = {
  guideType?: string | null;
  guideName?: string | null;
  background?: string | null;
  practicalPurpose?: string | null;
  steps?: Array<{ order: number; title: string; body: string }> | null;
  prayers?: string[] | null;
  scripture?: string[] | null;
};

export function validateSpiritualGuidancePackage(
  candidate: CandidatePackage & { payload: SpiritualGuidancePackagePayload },
  options: { sourcePurposes: SourcePurposeRecord },
): ContractValidationResult {
  const failedFields: string[] = [];
  const reasons: string[] = [];

  if (!isSourceApprovedFor(options.sourcePurposes, "SpiritualGuidance")) {
    return {
      decision: "reject",
      contractName: CONTRACT_NAME,
      contentType: "SpiritualGuidance",
      failedFields: ["sourceUrl"],
      reason: `Source '${candidate.sourceHost ?? "unknown"}' is not approved to ingest spiritual guidance`,
      publicRenderReady: false,
      isThresholdEligible: false,
      contractVersion: CONTRACT_VERSION,
    };
  }

  const guideType = candidate.payload.guideType?.trim();
  const guideName = (candidate.payload.guideName ?? candidate.title ?? "").trim();
  const background = (candidate.payload.background ?? "").trim();
  const purpose = (candidate.payload.practicalPurpose ?? "").trim();
  const steps = candidate.payload.steps ?? [];

  if (!guideName) failedFields.push("guideName");
  if (!guideType) failedFields.push("guideType");
  else if (!GUIDE_TYPE_LOOKUP.has(guideType.toLowerCase())) {
    failedFields.push("guideType");
    reasons.push(`guideType '${guideType}' is not in the allowed set`);
  }
  if (!background) failedFields.push("background");
  if (!purpose) failedFields.push("practicalPurpose");
  if (!candidate.sourceUrl) failedFields.push("sourceUrl");

  // Steps must exist, be ordered, and each have content.
  if (!Array.isArray(steps) || steps.length === 0) {
    failedFields.push("steps");
    reasons.push("Spiritual Guidance must contain ordered steps");
  } else {
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (typeof s.order !== "number" || s.order !== i + 1) {
        failedFields.push(`steps[${i}].order`);
        reasons.push(`Step ${i + 1} is missing or has incorrect order`);
      }
      if (!s.title || s.title.trim().length === 0) {
        failedFields.push(`steps[${i}].title`);
        reasons.push(`Step ${i + 1} is missing title`);
      }
      if (!s.body || s.body.trim().length === 0) {
        failedFields.push(`steps[${i}].body`);
        reasons.push(`Step ${i + 1} is missing body`);
      }
    }
  }

  const blob = `${background}\n${purpose}\n${steps.map((s) => `${s.title}\n${s.body}`).join("\n")}`;
  if (blob.trim() && !CATHOLIC_FRAMING_RE.test(blob)) {
    failedFields.push("background");
    reasons.push(
      "Spiritual Guidance lacks Catholic framing (no Catholic / Christ / sacrament / prayer vocabulary)",
    );
  }

  const wrong = detectWrongContent({
    contentType: "SpiritualGuidance",
    title: guideName,
    body: blob,
  });
  if (wrong.delete) {
    return {
      decision: "delete",
      contractName: CONTRACT_NAME,
      contentType: "SpiritualGuidance",
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
      contentType: "SpiritualGuidance",
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
    reason: "All Spiritual Guidance contract requirements satisfied",
    publicRenderReady: true,
    isThresholdEligible: true,
    contractVersion: CONTRACT_VERSION,
  };
}

export const spiritualGuidanceContractMeta = {
  name: CONTRACT_NAME,
  version: CONTRACT_VERSION,
  contentType: "SpiritualGuidance" as const,
  allowedTypes: VALID_GUIDE_TYPES,
};
