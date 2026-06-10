/**
 * Verification skill pack. Real verification gates over a content package: a
 * content item does not advance unless the relevant checks pass or route it to
 * human review. Each skill operates on the package the upstream skills produced
 * (extractor fields, citations, authority, claims, epistemic status, duplicate
 * signal, proof packet) plus real route/proof helpers — no item is reported
 * "verified" without the underlying condition actually holding.
 */

import { isProofRequired } from "../proof-publishing";
import { publicRouteFor } from "../public-routes";
import { getContentTypeProfile } from "../content-type-profiles";
import { catalogEntry } from "./catalog";
import { check } from "./verification";
import type { CertifiedSkill, SkillContext, SkillRiskLevel, VerificationDecision } from "./types";

const AUTHORITY_RANK: Record<string, number> = {
  VATICAN: 9,
  CATECHISM: 8,
  LITURGICAL: 7,
  USCCB: 6,
  DIOCESAN: 5,
  RELIGIOUS_ORDER: 4,
  TRUSTED_PUBLISHER: 3,
  ACADEMIC: 2,
  COMMUNITY: 1,
};

function authorityMeets(level: string | undefined, min: string): boolean {
  return (AUTHORITY_RANK[level ?? ""] ?? 0) >= (AUTHORITY_RANK[min] ?? 0);
}

interface VerifyDef {
  name: string;
  purpose: string;
  riskLevel?: SkillRiskLevel;
  brainOps?: readonly string[];
  humanReviewRequired?: boolean;
  requiresProofPacket?: boolean;
  /** The real check. Returns whether it passed + how to route a failure. */
  checkFn: (ctx: SkillContext) => { passed: boolean; detail?: string };
  onFail?: VerificationDecision;
}

function makeVerifySkill(def: VerifyDef): CertifiedSkill<{ passed: boolean; detail?: string }> {
  return {
    name: def.name,
    purpose: def.purpose,
    category: "VERIFICATION",
    version: "1",
    contentTypes: ["*"],
    contentSubtypes: [],
    inputs: ["package"],
    outputs: ["passed", "detail"],
    preconditions: ["a content package is present in the skill input"],
    requiredPermissions: ["read_package"],
    riskLevel: def.riskLevel ?? "low",
    idempotencyKey: (ctx) =>
      `${def.name}:${String((ctx.input as Record<string, unknown>).packageId ?? ctx.targetEntityId ?? (ctx.input as Record<string, unknown>).slug ?? "")}`,
    brainOps: def.brainOps ?? [],
    safetyGates: [def.name],
    humanReviewRequired: def.humanReviewRequired ?? false,
    requiresProofPacket: def.requiresProofPacket,
    allowedInSafeDegradedMode: false,
    failureClassifier: () => "NEEDS_REPAIR",
    retryPolicy: { maxAttempts: 1, backoff: "none", retryableClasses: [], routeToRepairAfter: 1 },
    successMetrics: ["passed"],
    testsRequired: [`verification: ${def.name}`],
    execute: async (ctx) => {
      const r = def.checkFn(ctx);
      return { status: "SUCCEEDED", output: r, evidence: { passed: r.passed, detail: r.detail } };
    },
    verify: async (_ctx, result) => {
      const passed = result.output?.passed === true;
      const checks = [check(def.name, passed, result.output?.detail)];
      if (passed) return { ok: true, decision: "PROCEED", checks };
      return {
        ok: false,
        decision: def.onFail ?? "REPAIR",
        checks,
        reason: result.output?.detail ?? `${def.name} failed`,
      };
    },
  };
}

function pkg(ctx: SkillContext): Record<string, unknown> {
  return ctx.input as Record<string, unknown>;
}

export const verificationSkills: readonly CertifiedSkill<{ passed: boolean; detail?: string }>[] = [
  makeVerifySkill({
    name: "verify_required_fields",
    purpose: "Confirm the package has every required field for its content type.",
    checkFn: (ctx) => {
      const missing = (pkg(ctx).missingFields as string[]) ?? [];
      return {
        passed: missing.length === 0,
        detail: missing.length ? `missing: ${missing.join(", ")}` : undefined,
      };
    },
    onFail: "REPAIR",
  }),
  makeVerifySkill({
    name: "verify_citations",
    purpose: "Confirm the package carries at least one source citation.",
    checkFn: (ctx) => {
      const citations = (pkg(ctx).citations as unknown[]) ?? [];
      return {
        passed: citations.length > 0,
        detail: citations.length ? undefined : "no citations",
      };
    },
    onFail: "REPAIR",
  }),
  makeVerifySkill({
    name: "verify_source_authority",
    purpose: "Confirm the source carries a recognized authority level.",
    checkFn: (ctx) => {
      const level = pkg(ctx).authorityLevel as string | undefined;
      return {
        passed: (AUTHORITY_RANK[level ?? ""] ?? 0) > 0,
        detail: level ?? "unknown authority",
      };
    },
    onFail: "HUMAN_REVIEW",
  }),
  makeVerifySkill({
    name: "verify_catholic_authority",
    purpose: "Confirm the source authority meets the content type's minimum.",
    brainOps: ["classify_source_authority"],
    checkFn: (ctx) => {
      const profile = getContentTypeProfile(ctx.contentType ?? "");
      const level = pkg(ctx).authorityLevel as string | undefined;
      const ok = authorityMeets(level, profile.minSourceAuthority);
      return { passed: ok, detail: `${level ?? "?"} vs min ${profile.minSourceAuthority}` };
    },
    onFail: "HUMAN_REVIEW",
  }),
  makeVerifySkill({
    name: "verify_claims",
    purpose: "Confirm no unresolved conflicting claims remain in the package.",
    brainOps: ["resolve_claim_with_authority"],
    checkFn: (ctx) => {
      const conflicts = (pkg(ctx).claimConflicts as unknown[]) ?? [];
      return {
        passed: conflicts.length === 0,
        detail: conflicts.length ? "unresolved claim conflicts" : undefined,
      };
    },
    onFail: "HUMAN_REVIEW",
  }),
  makeVerifySkill({
    name: "verify_epistemic_status",
    purpose: "Confirm the package's epistemic status is publishable (not blocked).",
    brainOps: ["grade_epistemic_status"],
    checkFn: (ctx) => {
      const status = (pkg(ctx).epistemicStatus as string | undefined) ?? "WELL_SUPPORTED";
      const bad =
        status === "BLOCKED" || status === "REQUIRES_HUMAN_REVIEW" || status === "CONFLICTING";
      return { passed: !bad, detail: status };
    },
    onFail: "HUMAN_REVIEW",
  }),
  makeVerifySkill({
    name: "verify_duplicate_safety",
    purpose: "Confirm the package is not a near-duplicate of existing content.",
    brainOps: ["detect_duplicates"],
    checkFn: (ctx) => {
      const dup = pkg(ctx).duplicateRisk === true;
      return { passed: !dup, detail: dup ? "duplicate risk" : undefined };
    },
    onFail: "REPAIR",
  }),
  makeVerifySkill({
    name: "verify_communion_risk",
    purpose: "Confirm the source is not flagged as out of communion with Rome.",
    brainOps: ["detect_communion_risk"],
    checkFn: (ctx) => {
      const risk = pkg(ctx).communionRisk === true;
      return { passed: !risk, detail: risk ? "communion risk flagged" : undefined };
    },
    onFail: "HUMAN_REVIEW",
  }),
  makeVerifySkill({
    name: "verify_public_route_support",
    purpose: "Confirm the content type maps to a real public route.",
    checkFn: (ctx) => {
      const slug = String(pkg(ctx).slug ?? "x");
      const route = publicRouteFor(ctx.contentType ?? "PRAYER", slug);
      return { passed: Boolean(route.slugPath), detail: route.slugPath };
    },
    onFail: "REPAIR",
  }),
  makeVerifySkill({
    name: "verify_schema_support",
    purpose: "Confirm the content type is known to the content catalog/schema.",
    checkFn: (ctx) => {
      const ok = catalogEntry(ctx.contentType ?? "") != null;
      return { passed: ok, detail: ctx.contentType ?? "unknown type" };
    },
    onFail: "REPAIR",
  }),
  makeVerifySkill({
    name: "verify_ui_support",
    purpose: "Confirm the content type renders under a public tab.",
    checkFn: (ctx) => {
      const route = publicRouteFor(ctx.contentType ?? "PRAYER", "x");
      return { passed: Boolean(route.tabPath), detail: route.tabPath };
    },
    onFail: "REPAIR",
  }),
  makeVerifySkill({
    name: "verify_ontology_links",
    purpose: "Confirm the package's Catholic ontology links are well-formed.",
    brainOps: ["link_catholic_ontology"],
    checkFn: (ctx) => {
      const links = (pkg(ctx).ontologyLinks as unknown[]) ?? [];
      // Advisory: ontology links are optional, but if present they must be non-empty objects.
      const ok = links.every((l) => l != null && typeof l === "object");
      return { passed: ok, detail: `${links.length} link(s)` };
    },
    onFail: "REPAIR",
  }),
  makeVerifySkill({
    name: "verify_sensitive_content_proof_packet",
    purpose: "For sensitive Catholic content, require a passing proof packet before publish.",
    requiresProofPacket: true,
    brainOps: ["build_proof_packet", "check_invariants"],
    checkFn: (ctx) => {
      const type = ctx.contentType ?? "";
      if (!isProofRequired(type)) return { passed: true, detail: "not a proof-required type" };
      const proven = pkg(ctx).proofPassed === true;
      return { passed: proven, detail: proven ? "proof packet passed" : "no passing proof packet" };
    },
    onFail: "HUMAN_REVIEW",
  }),
];
