/**
 * Per-item enrichment pass that wires strict validation, source-tier
 * routing, and confidence scoring into a single step the runner calls
 * before persisting. Returns the persistence decision (status to use)
 * and the scores / reason / tier that should be written onto the
 * content row.
 *
 *   1. Strict-validate the item (per-content-type rules).
 *      reject → caller skips persisting and writes REJECT log.
 *      review → caller persists with REVIEW + outcomeReason.
 *      accept → continue.
 *   2. Infer source tier from the item's externalSourceKey host.
 *   3. Route via tier + confidence → PUBLISHED or REVIEW.
 *   4. Return scores + reason for the persister to write.
 */

import type { IngestedItem } from "./types";
import { strictValidate, type StrictValidationOutcome } from "./strict-validate";
import { inferTierFromHost, routeByTier, type Tier } from "./source-tier";

export type EnrichedDecision = {
  /** "publish" | "review" | "reject" — caller honours this. */
  action: "publish" | "review" | "reject";
  /** Reason string written to outcomeReason on the persisted row. */
  outcomeReason: string;
  /** 0..1 confidence from the strict validator (about content shape). */
  sourceConfidence: number;
  /** 0..1 formatting confidence (heuristic: well-formed sentences). */
  formattingConfidence: number;
  /** 0..1 quality score — combined signal we surface in admin reports. */
  qualityScore: number;
  /** True when content should land in a human-review workflow. */
  theologicalReviewFlag: boolean;
  /** Inferred source tier (1 / 2 / 3). */
  sourceTier: Tier;
  /** Status the persister should write (when action ≠ "reject"). */
  status: "PUBLISHED" | "REVIEW";
};

const THEOLOGICAL_KINDS: ReadonlyArray<IngestedItem["kind"]> = ["saint", "liturgy", "guide"];

function hostFromExternalSourceKey(externalSourceKey: string | undefined): string {
  if (!externalSourceKey) return "";
  // External source keys look like "vatican.va:/path/..." or full URLs.
  const colon = externalSourceKey.indexOf(":");
  const sliced = colon > 0 ? externalSourceKey.slice(0, colon) : externalSourceKey;
  // Strip any URL scheme prefix if present.
  return sliced.replace(/^https?:\/\//, "").toLowerCase();
}

function formattingConfidenceFor(item: IngestedItem): number {
  const blob = [
    (item as { defaultTitle?: string }).defaultTitle,
    (item as { canonicalName?: string }).canonicalName,
    (item as { title?: string }).title,
    (item as { name?: string }).name,
    (item as { body?: string }).body,
    (item as { biography?: string }).biography,
    (item as { summary?: string }).summary,
    (item as { bodyText?: string }).bodyText,
  ]
    .filter(Boolean)
    .join("\n");
  if (!blob) return 0;
  let score = 0.4;
  if (/[.!?]\s/.test(blob)) score += 0.2;
  if (/\b(the|of|and|in|to|for)\b/i.test(blob)) score += 0.15;
  if (blob.length >= 200) score += 0.1;
  if (!/\s{4,}/.test(blob)) score += 0.1;
  if (!/[A-Z]{6,}/.test(blob)) score += 0.05;
  return Math.min(1, score);
}

function combinedQuality(strict: number, formatting: number, tier: Tier): number {
  const tierBoost = tier === 1 ? 0.1 : tier === 2 ? 0.05 : 0;
  return Math.min(1, strict * 0.6 + formatting * 0.3 + tierBoost);
}

export function enrichDecision(item: IngestedItem): EnrichedDecision {
  const validation: StrictValidationOutcome = strictValidate(item);
  const host = hostFromExternalSourceKey(item.externalSourceKey);
  const sourceTier = host ? inferTierFromHost(host) : 3;
  const formattingConfidence = formattingConfidenceFor(item);
  const theologicalReviewFlag = THEOLOGICAL_KINDS.includes(item.kind);

  if (validation.decision === "reject") {
    return {
      action: "reject",
      outcomeReason: validation.reason,
      sourceConfidence: 0,
      formattingConfidence,
      qualityScore: 0,
      theologicalReviewFlag,
      sourceTier,
      status: "REVIEW",
    };
  }

  if (validation.decision === "review") {
    const decision = routeByTier(sourceTier, {
      confidence: validation.confidence,
      theologicalReviewFlag,
      softFailed: true,
    });
    return {
      action: "review",
      outcomeReason: `${validation.reason}; routing: ${decision.reason}`,
      sourceConfidence: validation.confidence,
      formattingConfidence,
      qualityScore: combinedQuality(validation.confidence, formattingConfidence, sourceTier),
      theologicalReviewFlag,
      sourceTier,
      status: "REVIEW",
    };
  }

  // validation.decision === "accept"
  const decision = routeByTier(sourceTier, {
    confidence: validation.confidence,
    theologicalReviewFlag,
  });
  return {
    action: decision.status === "PUBLISHED" ? "publish" : "review",
    outcomeReason: decision.reason,
    sourceConfidence: validation.confidence,
    formattingConfidence,
    qualityScore: combinedQuality(validation.confidence, formattingConfidence, sourceTier),
    theologicalReviewFlag,
    sourceTier,
    status: decision.status,
  };
}
