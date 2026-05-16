/**
 * NovenaPackage contract.
 *
 * A Novena must be a complete devotional package — nine days (or
 * however many days the approved source explicitly defines, e.g. some
 * Divine Mercy novenas are 9, some saint novenas are 9 by tradition).
 * A novena must not be public unless every required day is present and
 * fully populated.
 *
 * Each day must contain a dayNumber, a dayTitle (if provided by the
 * source), and a dayPrayer; optional fields (intention, opening
 * prayer, scripture reading, reflection, closing prayer) must also
 * pass when present.
 */

import { detectWrongContent } from "../wrong-content-detector";
import { isSourceApprovedFor, type SourcePurposeRecord } from "../source-purpose";
import type { CandidatePackage, ContractDecision, ContractValidationResult } from "../types";

const CONTRACT_NAME = "NovenaPackage";
const CONTRACT_VERSION = "1.0.0";

export type NovenaDay = {
  dayNumber: number;
  dayTitle?: string;
  intention?: string;
  openingPrayer?: string;
  scriptureReading?: string;
  reflection?: string;
  dayPrayer?: string;
  closingPrayer?: string;
};

export type NovenaPackagePayload = {
  novenaName?: string | null;
  background?: string | null;
  purpose?: string | null;
  durationDays?: number | null;
  days?: NovenaDay[] | null;
};

const PLACEHOLDER_RE = /\b(?:tbd|placeholder|todo|coming\s+soon|to\s+be\s+(?:added|determined))\b/i;

export function validateNovenaPackage(
  candidate: CandidatePackage & { payload: NovenaPackagePayload },
  options: { sourcePurposes: SourcePurposeRecord },
): ContractValidationResult {
  const failedFields: string[] = [];
  const reasons: string[] = [];

  if (!isSourceApprovedFor(options.sourcePurposes, "Novena")) {
    return {
      decision: "reject",
      contractName: CONTRACT_NAME,
      contentType: "Novena",
      failedFields: ["sourceUrl"],
      reason: `Source '${candidate.sourceHost ?? "unknown"}' is not approved to ingest novenas`,
      publicRenderReady: false,
      isThresholdEligible: false,
      contractVersion: CONTRACT_VERSION,
    };
  }

  const novenaName = (candidate.payload.novenaName ?? candidate.title ?? "").trim();
  const background = (candidate.payload.background ?? "").trim();
  const purpose = (candidate.payload.purpose ?? "").trim();
  const days = Array.isArray(candidate.payload.days) ? candidate.payload.days : [];
  const durationDays = candidate.payload.durationDays ?? days.length;

  if (!novenaName) failedFields.push("novenaName");
  if (!background) failedFields.push("background");
  if (!purpose) failedFields.push("purpose");
  if (!candidate.sourceUrl) failedFields.push("sourceUrl");

  // ── Day completeness ──
  if (!durationDays || durationDays < 1) {
    failedFields.push("durationDays");
    reasons.push("durationDays must be >= 1");
  }

  if (days.length === 0) {
    failedFields.push("days");
    reasons.push("days array is empty — a novena must contain its days");
  } else {
    if (days.length !== durationDays) {
      failedFields.push("days");
      reasons.push(`days array length ${days.length} does not match durationDays ${durationDays}`);
    }
    // Sequential day numbers, no duplicates, no missing days.
    const seen = new Set<number>();
    for (let i = 0; i < days.length; i++) {
      const expected = i + 1;
      const d = days[i];
      if (!d || typeof d.dayNumber !== "number" || d.dayNumber !== expected) {
        failedFields.push(`days[${i}].dayNumber`);
        reasons.push(`Day at index ${i} must have dayNumber=${expected}`);
      }
      if (d && seen.has(d.dayNumber)) {
        failedFields.push(`days[${i}].dayNumber`);
        reasons.push(`Duplicate day number ${d.dayNumber}`);
      }
      if (d) seen.add(d.dayNumber);

      // Required: every day has a non-empty prayer.
      const prayer = (d?.dayPrayer ?? "").trim();
      if (!prayer) {
        failedFields.push(`days[${i}].dayPrayer`);
        reasons.push(`Day ${expected} is missing dayPrayer`);
      }

      // Placeholder text check.
      for (const field of [
        "intention",
        "openingPrayer",
        "scriptureReading",
        "reflection",
        "dayPrayer",
        "closingPrayer",
      ] as const) {
        const value = (d?.[field] ?? "").toString();
        if (value && PLACEHOLDER_RE.test(value)) {
          failedFields.push(`days[${i}].${field}`);
          reasons.push(`Day ${expected} contains placeholder text in ${field}`);
        }
      }
    }
  }

  const wrong = detectWrongContent({
    contentType: "Novena",
    title: novenaName,
    body: `${background}\n${purpose}`,
  });
  if (wrong.delete) {
    return {
      decision: "delete",
      contractName: CONTRACT_NAME,
      contentType: "Novena",
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
      contentType: "Novena",
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
    contentType: "Novena",
    failedFields: [],
    reason: "All Novena contract requirements satisfied",
    publicRenderReady: true,
    isThresholdEligible: true,
    contractVersion: CONTRACT_VERSION,
  };
}

export function isNovenaRenderReady(row: {
  title: string;
  background?: string | null;
  purpose?: string | null;
  packageMetadata?: unknown;
}): boolean {
  if (!row.title || row.title.trim().length < 2) return false;
  if (!row.background || row.background.trim().length === 0) return false;
  if (!row.purpose || row.purpose.trim().length === 0) return false;
  const meta = row.packageMetadata as { days?: NovenaDay[] } | null | undefined;
  if (!meta || !Array.isArray(meta.days) || meta.days.length === 0) return false;
  for (const d of meta.days) {
    if (!d.dayPrayer || d.dayPrayer.trim().length === 0) return false;
  }
  return true;
}

export const novenaContractMeta = {
  name: CONTRACT_NAME,
  version: CONTRACT_VERSION,
  contentType: "Novena" as const,
};
