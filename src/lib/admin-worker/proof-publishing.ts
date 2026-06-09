/**
 * Proof-based publishing for sensitive Catholic content (spec: "Add proof based
 * publishing for sensitive Catholic content").
 *
 * Doctrinally / historically / liturgically / authority-sensitive categories
 * may not auto-publish on a confidence score alone: they require a passing
 * proof packet AND satisfied logic-rule invariants from the unified brain. This
 * is the enforcement layer the publish orchestrator consults; the brain
 * supplies the proof, TypeScript enforces the verdict.
 *
 * Safety-first defaults: a sensitive item is NEVER auto-published when the brain
 * is offline or the proof is incomplete — it routes to human review. Non-
 * sensitive content is unaffected and follows the normal gates.
 */

import type { PrismaClient } from "@prisma/client";

import { callBrain } from "./intelligence/client";
import { isBrainEnabled } from "./intelligence";
import { recordBrainCall } from "./intelligence/store";

/** Categories that require proof-based publishing (the spec's list). */
export const PROOF_REQUIRED_TYPES: ReadonlySet<string> = new Set([
  "DOCTRINE",
  "SACRAMENT",
  "CHURCH_DOCUMENT",
  "CATECHISM",
  "CANON_LAW",
  "PAPAL_DOCUMENT",
  "COUNCIL",
  "LITURGICAL",
  "LITURGICAL_CALENDAR",
  "APPARITION",
  "MARIAN_TITLE",
  "DEVOTION",
  "CHURCH_HISTORY",
  "SCHISM",
  "HERESY",
  "POPE",
]);

export interface SensitivePublishDecision {
  /** Is this content type subject to proof-based publishing? */
  proofRequired: boolean;
  /** May the worker auto-publish? */
  allow: boolean;
  /** "publish" | "review" | "block" */
  action: "publish" | "review" | "block";
  humanReviewRequired: boolean;
  reasons: string[];
}

export interface SensitivePublishInput {
  contentType: string;
  claim?: Record<string, unknown>;
  evidence?: {
    sources?: string[];
    authorities?: string[];
    citations?: string[];
    agreements?: number;
    conflicts?: string[];
  };
  /** Field state for the logic-rule invariant check (title, authority, …). */
  state?: Record<string, unknown>;
  passId?: string;
  contentId?: string;
}

export function isProofRequired(contentType: string): boolean {
  return PROOF_REQUIRED_TYPES.has(String(contentType || "").toUpperCase());
}

/**
 * Decide whether sensitive content may publish. Consults the brain's
 * build_proof_packet + check_invariants; both must pass for an auto-publish.
 */
export async function evaluateSensitivePublish(
  prisma: PrismaClient,
  input: SensitivePublishInput,
): Promise<SensitivePublishDecision> {
  const contentType = String(input.contentType || "").toUpperCase();
  if (!isProofRequired(contentType)) {
    return {
      proofRequired: false,
      allow: true,
      action: "publish",
      humanReviewRequired: false,
      reasons: ["content type is not proof-gated"],
    };
  }

  // Sensitive + brain offline → never auto-publish; route to human review.
  if (!isBrainEnabled()) {
    return {
      proofRequired: true,
      allow: false,
      action: "review",
      humanReviewRequired: true,
      reasons: ["proof required but the intelligence brain is offline — routing to review"],
    };
  }

  const reasons: string[] = [];

  const proof = await callBrain<{
    proven?: boolean;
    recommended_action?: string;
    human_review_required?: boolean;
    conditions_failed?: string[];
  }>("build_proof_packet", {
    claim: input.claim ?? { contentType },
    content_type: contentType,
    sensitive: true,
    evidence: input.evidence ?? {},
  }).catch(() => null);
  if (proof) {
    await recordBrainCall(prisma, "build_proof_packet", proof, {
      contentType,
      entityId: input.contentId ?? null,
      passId: input.passId ?? null,
    }).catch(() => undefined);
  }

  const invariants = await callBrain<{ all_pass?: boolean; failed?: Array<{ id: string }> }>(
    "check_invariants",
    { state: { contentType, sensitive: true, ...(input.state ?? {}) } },
  ).catch(() => null);
  if (invariants) {
    await recordBrainCall(prisma, "check_invariants", invariants, {
      contentType,
      entityId: input.contentId ?? null,
      passId: input.passId ?? null,
    }).catch(() => undefined);
  }

  // Fail-closed: missing proof or invariants → review (never auto-publish).
  if (!proof || !invariants) {
    return {
      proofRequired: true,
      allow: false,
      action: "review",
      humanReviewRequired: true,
      reasons: ["proof packet or invariant check unavailable — routing to review"],
    };
  }

  const proofAction = String(proof.result?.recommended_action ?? "review");
  const proven = Boolean(proof.result?.proven);
  const invariantsPass = Boolean(invariants.result?.all_pass);
  const reviewRequired = Boolean(proof.result?.human_review_required);

  if (proofAction === "block") {
    reasons.push("proof packet blocks publication", ...(proof.result?.conditions_failed ?? []));
    return {
      proofRequired: true,
      allow: false,
      action: "block",
      humanReviewRequired: true,
      reasons,
    };
  }
  if (!invariantsPass) {
    reasons.push(
      "logic-rule invariants failed",
      ...(invariants.result?.failed ?? []).map((f) => f.id),
    );
    return {
      proofRequired: true,
      allow: false,
      action: "review",
      humanReviewRequired: true,
      reasons,
    };
  }
  if (proven && !reviewRequired) {
    reasons.push("proof holds and all invariants pass");
    return {
      proofRequired: true,
      allow: true,
      action: "publish",
      humanReviewRequired: false,
      reasons,
    };
  }
  reasons.push("proof incomplete or sensitive type below Vatican authority — routing to review");
  return {
    proofRequired: true,
    allow: false,
    action: "review",
    humanReviewRequired: true,
    reasons,
  };
}
