/**
 * Strict content QA pipeline orchestrator.
 *
 * Every ingested item passes through this exact sequence before
 * persistence:
 *
 *   1. Fetch the source page or record.
 *   2. Strip page chrome (already done by `clean.ts` / `format.ts`).
 *   3. Classify the content into exactly one content type. If the
 *      classifier cannot decide, reject the item.
 *   4. Build a typed content package.
 *   5. Run wrong-content detection.
 *   6. Run source-purpose validation.
 *   7. Run required-field validation.
 *   8. Run formatting validation.
 *   9. Run render-readiness validation.
 *  10. Run duplicate / checksum validation (handled by persisters).
 *  11. Publish only if every contract passes; otherwise delete or reject.
 *
 * The pipeline never persists a loosely typed scraped page as public
 * content. It never persists bad content with status = REVIEW just
 * because the system is unsure — REVIEW is an *optional* admin holding
 * area, not the default outcome.
 */

import type { CandidatePackage, ContentTypeKey, ContractValidationResult } from "./types";
import { getSourcePurposes, type SourcePurposeRecord } from "./source-purpose";
import { detectWrongContent } from "./wrong-content-detector";
import { validatePrayerPackage } from "./contracts/prayer";
import { validateSaintPackage } from "./contracts/saint";
import { validateApparitionPackage } from "./contracts/apparition";
import { validateDevotionPackage } from "./contracts/devotion";
import { validateNovenaPackage } from "./contracts/novena";
import { validateSacramentPackage } from "./contracts/sacrament";
import { validateRosaryPackage } from "./contracts/rosary";
import { validateConsecrationPackage } from "./contracts/consecration";
import { validateSpiritualGuidancePackage } from "./contracts/spiritual-guidance";
import { validateLiturgyPackage } from "./contracts/liturgy";
import { validateHistoryPackage } from "./contracts/history";
import { validateParishPackage } from "./contracts/parish";

/**
 * Dispatch table: contract validator per content type.
 */
function dispatchContract(
  contentType: ContentTypeKey,
  candidate: CandidatePackage,
  options: { sourcePurposes: SourcePurposeRecord },
): ContractValidationResult {
  switch (contentType) {
    case "Prayer":
      return validatePrayerPackage(
        candidate as CandidatePackage & {
          payload: Parameters<typeof validatePrayerPackage>[0]["payload"];
        },
        options,
      );
    case "Saint":
      return validateSaintPackage(
        candidate as CandidatePackage & {
          payload: Parameters<typeof validateSaintPackage>[0]["payload"];
        },
        options,
      );
    case "MarianApparition":
      return validateApparitionPackage(
        candidate as CandidatePackage & {
          payload: Parameters<typeof validateApparitionPackage>[0]["payload"];
        },
        options,
      );
    case "Devotion":
      return validateDevotionPackage(
        candidate as CandidatePackage & {
          payload: Parameters<typeof validateDevotionPackage>[0]["payload"];
        },
        options,
      );
    case "Novena":
      return validateNovenaPackage(
        candidate as CandidatePackage & {
          payload: Parameters<typeof validateNovenaPackage>[0]["payload"];
        },
        options,
      );
    case "Sacrament":
      return validateSacramentPackage(
        candidate as CandidatePackage & {
          payload: Parameters<typeof validateSacramentPackage>[0]["payload"];
        },
        options,
      );
    case "Rosary":
      return validateRosaryPackage(
        candidate as CandidatePackage & {
          payload: Parameters<typeof validateRosaryPackage>[0]["payload"];
        },
        options,
      );
    case "Consecration":
      return validateConsecrationPackage(
        candidate as CandidatePackage & {
          payload: Parameters<typeof validateConsecrationPackage>[0]["payload"];
        },
        options,
      );
    case "SpiritualGuidance":
      return validateSpiritualGuidancePackage(
        candidate as CandidatePackage & {
          payload: Parameters<typeof validateSpiritualGuidancePackage>[0]["payload"];
        },
        options,
      );
    case "Liturgy":
      return validateLiturgyPackage(
        candidate as CandidatePackage & {
          payload: Parameters<typeof validateLiturgyPackage>[0]["payload"];
        },
        options,
      );
    case "History":
      return validateHistoryPackage(
        candidate as CandidatePackage & {
          payload: Parameters<typeof validateHistoryPackage>[0]["payload"];
        },
        options,
      );
    case "Parish":
      return validateParishPackage(
        candidate as CandidatePackage & {
          payload: Parameters<typeof validateParishPackage>[0]["payload"];
        },
        options,
      );
  }
}

export type PipelineOptions = {
  /** Pre-loaded source purposes; when omitted the pipeline loads them by host. */
  sourcePurposes?: SourcePurposeRecord;
};

/**
 * Run one candidate through the strict content QA pipeline. Returns
 * the contract validation result. The caller (runner, janitor,
 * cleanup) honours the result's `decision` field.
 */
export async function runStrictPipeline(
  candidate: CandidatePackage,
  options: PipelineOptions = {},
): Promise<ContractValidationResult> {
  // 1. Source-purpose lookup.
  const sourcePurposes =
    options.sourcePurposes ?? (await getSourcePurposes(candidate.sourceHost ?? null));

  // 2. Belt-and-suspenders wrong-content detector before any contract
  //    runs. Catches anything the per-contract detector might miss.
  const title = candidate.title ?? extractTitle(candidate);
  const body = extractBody(candidate);
  const wrong = detectWrongContent({
    contentType: candidate.contentType,
    title,
    body,
  });
  if (wrong.delete) {
    return {
      decision: "delete",
      contractName: "WrongContentDetector",
      contentType: candidate.contentType,
      failedFields: ["body"],
      reason: wrong.reasons.join("; "),
      publicRenderReady: false,
      isThresholdEligible: false,
      contractVersion: "1.0.0",
    };
  }

  // 3. Dispatch to the typed contract.
  return dispatchContract(candidate.contentType, candidate, { sourcePurposes });
}

/**
 * Synchronous variant for tests and code paths that already have the
 * source purposes loaded.
 */
export function runStrictPipelineSync(
  candidate: CandidatePackage,
  sourcePurposes: SourcePurposeRecord,
): ContractValidationResult {
  const title = candidate.title ?? extractTitle(candidate);
  const body = extractBody(candidate);
  const wrong = detectWrongContent({
    contentType: candidate.contentType,
    title,
    body,
  });
  if (wrong.delete) {
    return {
      decision: "delete",
      contractName: "WrongContentDetector",
      contentType: candidate.contentType,
      failedFields: ["body"],
      reason: wrong.reasons.join("; "),
      publicRenderReady: false,
      isThresholdEligible: false,
      contractVersion: "1.0.0",
    };
  }
  return dispatchContract(candidate.contentType, candidate, { sourcePurposes });
}

function extractTitle(candidate: CandidatePackage): string {
  const p = candidate.payload as Record<string, unknown>;
  const found =
    p.prayerName ??
    p.saintName ??
    p.apparitionName ??
    p.devotionName ??
    p.novenaName ??
    p.sacramentName ??
    p.consecrationName ??
    p.guideName ??
    p.parishName ??
    p.title;
  return typeof found === "string" ? found : "";
}

function extractBody(candidate: CandidatePackage): string {
  const p = candidate.payload as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of [
    "prayerText",
    "background",
    "summary",
    "body",
    "biography",
    "practiceInstructions",
    "catholicExplanation",
    "preparationGuide",
    "participationGuide",
    "howToPray",
    "practicalPurpose",
    "purpose",
  ]) {
    const v = p[key];
    if (typeof v === "string" && v.trim().length > 0) parts.push(v);
  }
  if (Array.isArray(p.steps)) {
    for (const step of p.steps as Array<{ title?: string; body?: string }>) {
      if (step.title) parts.push(step.title);
      if (step.body) parts.push(step.body);
    }
  }
  return parts.join("\n");
}
