/**
 * Skill Planner — maps a Python-brain decision (mission stage + content type +
 * intended action) to an ordered plan of certified skills. The planner is the
 * enforcement point for the hard rule: the worker only performs autonomous
 * operational work through certified skills. If a required skill is missing,
 * uncertified, blocked, or unsafe, the plan is NOT executable — the worker does
 * not pretend it can do the task; it reports the gap so a developer request is
 * filed.
 */

import { catalogEntry } from "./catalog";
import { getSkill, isCertified } from "./registry";
import { ensureSkillsRegistered } from "./bootstrap";

export interface SkillPlanStep {
  skillName: string;
  certified: boolean;
  required: boolean;
  riskLevel: string | null;
  humanReviewRequired: boolean;
}

export interface SkillPlan {
  missionStage: string;
  contentType: string | null;
  contentSubtype: string | null;
  steps: SkillPlanStep[];
  /** True only when every required step is certified. */
  executable: boolean;
  missingSkills: string[];
  /** Why the plan can't run end-to-end yet (null when executable). */
  rejectedReason: string | null;
  requiresProofPacket: boolean;
}

/** The default certified-skill plan to take a content type from source to page. */
function buildPlan(contentType: string): string[] {
  const entry = catalogEntry(contentType);
  const base = [
    "fetch_static_html",
    "read_source_page",
    `extract_${contentType.toLowerCase()}`,
    "verify_required_fields",
    "verify_citations",
    "verify_duplicate_safety",
  ];
  // Sensitive Catholic content is proof-gated before publish.
  const sensitive = entry?.sensitive
    ? ["verify_catholic_authority", "verify_sensitive_content_proof_packet"]
    : [];
  const tail = [
    "run_strict_qa",
    "publish_content",
    "publish_content_subtitle",
    "verify_public_route",
    "verify_sitemap",
    "verify_cache",
  ];
  return [...base, ...sensitive, ...tail];
}

/** Mission stages whose work is a full content build for a content type. */
const CONTENT_BUILD_STAGES = new Set([
  "SOURCE_FETCH",
  "SOURCE_READ",
  "CLASSIFICATION",
  "EXTRACTION",
  "PACKAGE_BUILD",
  "CROSS_SOURCE_VERIFICATION",
  "STRICT_QA",
  "PERSISTENCE",
  "PUBLIC_PUBLISH",
]);

/** Single-skill plans for operational (non content-build) mission stages. */
const STAGE_SKILL: Record<string, string> = {
  DISCOVERY: "discover_from_sitemap",
  REPAIR: "repair_failed_public_route",
  HOMEPAGE_WORK: "create_homepage_draft",
  REPORTING: "generate_developer_report",
  SECURITY_DEFENSE: "run_security_defense",
  MAINTENANCE: "clean_stale_jobs",
  POST_PUBLISH_VERIFY: "verify_public_route",
  SEARCH_VERIFY: "verify_search_index",
  SITEMAP_VERIFY: "verify_sitemap",
  CACHE_REFRESH: "verify_cache",
};

function step(skillName: string, required: boolean): SkillPlanStep {
  const s = getSkill(skillName);
  return {
    skillName,
    certified: s != null,
    required,
    riskLevel: s?.riskLevel ?? null,
    humanReviewRequired: s?.humanReviewRequired ?? false,
  };
}

export interface PlanInput {
  missionStage: string;
  contentType?: string | null;
  contentSubtype?: string | null;
  /** The brain's intended skill, if it named one. */
  intendedSkill?: string | null;
}

/** Plan the certified skills for a brain decision. */
export function planForDecision(input: PlanInput): SkillPlan {
  ensureSkillsRegistered();
  const contentType = input.contentType ?? null;
  const subtype = input.contentSubtype ?? null;

  // Precedence: an explicit intended skill wins; otherwise a content-build
  // stage expands to the full source->page plan; otherwise the stage's default
  // operational skill.
  let names: string[];
  if (input.intendedSkill) {
    names = [input.intendedSkill];
  } else if (CONTENT_BUILD_STAGES.has(input.missionStage) && contentType) {
    names = buildPlan(contentType);
  } else {
    const mapped = STAGE_SKILL[input.missionStage];
    names = mapped ? [mapped] : [];
  }

  const steps = names.map((n) => step(n, true));
  const missingSkills = steps.filter((s) => s.required && !s.certified).map((s) => s.skillName);
  const requiresProofPacket = names.includes("verify_sensitive_content_proof_packet");

  let rejectedReason: string | null = null;
  if (names.length === 0) {
    rejectedReason = `no certified skill plan for mission stage ${input.missionStage}`;
  } else if (missingSkills.length > 0) {
    rejectedReason = `missing certified skills: ${missingSkills.join(", ")}`;
  }

  return {
    missionStage: input.missionStage,
    contentType,
    contentSubtype: subtype,
    steps,
    executable: rejectedReason == null,
    missingSkills,
    rejectedReason,
    requiresProofPacket,
  };
}

/** The default named build plan for a content type (for docs / dashboard). */
export function defaultBuildPlan(contentType: string): string[] {
  return buildPlan(contentType);
}

export { isCertified };
