/**
 * Cross-source comparison.
 *
 * When building a content package, the worker collects candidate values for
 * each field from every approved source it fetched. This module decides
 * which value to use:
 *   1. Higher authority always wins (Vatican > USCCB > Diocesan > Publisher).
 *   2. If multiple sources at the same level agree, confidence rises.
 *   3. If two equal-authority sources disagree, the field is flagged for
 *      human review and the highest-authority value is kept with a warning.
 */

import type { SourceAuthorityLevel } from "@prisma/client";

import { compareAuthority } from "../types";
import type { FieldProvenance } from "../types";

export interface FieldCandidate<T = unknown> {
  value: T;
  authorityLevel: SourceAuthorityLevel;
  sourceUrl: string;
  sourceHost: string;
  notes?: string;
}

export interface ReconciledField<T = unknown> {
  value: T;
  confidence: number;
  provenance: FieldProvenance[];
  warnings: string[];
  needsHumanReview: boolean;
}

/**
 * Pick the best value from a list of candidates. Ties at the same
 * authority level raise confidence; conflicts at the same authority
 * level emit a warning and flag for human review.
 */
export function reconcileField<T>(
  fieldName: string,
  candidates: FieldCandidate<T>[],
  options: { compare?: (a: T, b: T) => boolean } = {}
): ReconciledField<T> | null {
  if (candidates.length === 0) return null;
  const eq =
    options.compare ?? ((a: T, b: T) => JSON.stringify(a) === JSON.stringify(b));

  const sorted = [...candidates].sort((a, b) =>
    compareAuthority(a.authorityLevel, b.authorityLevel)
  );
  const top = sorted[0];
  const sameTier = sorted.filter(
    (c) => c.authorityLevel === top.authorityLevel
  );

  const agreeAtTopTier = sameTier.filter((c) => eq(c.value, top.value));
  const disagreeAtTopTier = sameTier.filter((c) => !eq(c.value, top.value));

  const provenance: FieldProvenance[] = sameTier.map((c) => ({
    sourceUrl: c.sourceUrl,
    sourceHost: c.sourceHost,
    authorityLevel: c.authorityLevel,
    confidence: eq(c.value, top.value) ? 0.95 : 0.4,
    notes: c.notes,
  }));

  let confidence = 0.7;
  const warnings: string[] = [];
  let needsHumanReview = false;

  if (agreeAtTopTier.length > 1) {
    confidence = Math.min(
      0.99,
      0.8 + 0.05 * Math.min(agreeAtTopTier.length - 1, 4)
    );
  } else if (sorted.length > 1) {
    confidence = 0.85;
  }

  if (disagreeAtTopTier.length > 0) {
    needsHumanReview = true;
    confidence = Math.min(confidence, 0.6);
    warnings.push(
      `Field "${fieldName}" has conflicting values at authority level ${top.authorityLevel} (${
        disagreeAtTopTier.length + 1
      } distinct values). Keeping the first; admin review required.`
    );
  }

  if (sorted.length === 1) {
    if (top.authorityLevel === "COMMUNITY" || top.authorityLevel === "ACADEMIC") {
      confidence = Math.min(confidence, 0.6);
      warnings.push(
        `Field "${fieldName}" sourced from a single ${top.authorityLevel} source. Consider cross-checking with a higher-authority source.`
      );
    }
  }

  return {
    value: top.value,
    confidence,
    provenance,
    warnings,
    needsHumanReview,
  };
}

/**
 * Reconcile a whole record of fields. Returns the reconciled record, an
 * aggregate confidence, all warnings, and an overall human-review flag.
 */
export function reconcileFields(
  fields: Record<string, FieldCandidate<unknown>[]>
): {
  values: Record<string, unknown>;
  confidence: number;
  warnings: string[];
  needsHumanReview: boolean;
  provenance: Record<string, FieldProvenance[]>;
} {
  const values: Record<string, unknown> = {};
  const provenance: Record<string, FieldProvenance[]> = {};
  const warnings: string[] = [];
  let needsHumanReview = false;
  const confidences: number[] = [];

  for (const [fieldName, candidates] of Object.entries(fields)) {
    const result = reconcileField(fieldName, candidates);
    if (!result) continue;
    values[fieldName] = result.value;
    provenance[fieldName] = result.provenance;
    warnings.push(...result.warnings);
    if (result.needsHumanReview) needsHumanReview = true;
    confidences.push(result.confidence);
  }

  const confidence =
    confidences.length === 0
      ? 0
      : confidences.reduce((a, b) => a + b, 0) / confidences.length;

  return { values, confidence, warnings, needsHumanReview, provenance };
}
