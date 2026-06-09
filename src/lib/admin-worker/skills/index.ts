/**
 * Certified Admin Skill Runtime — public surface.
 *
 * The Admin Worker performs all autonomous operational work through certified
 * skills registered here. See ./types for the contract, ./registry for the
 * catalogue, ./executor for the lifecycle, and ./bootstrap for registration of
 * the real skill packs (source, extraction, verification, publishing, repair,
 * homepage, reporting, security, maintenance).
 */

export * from "./types";
export {
  registerSkill,
  registerSkills,
  getSkill,
  isCertified,
  listSkills,
  listByCategory,
  skillsForContentType,
  skillsForContentSubtype,
  registeredSkillCount,
  clearRegistry,
} from "./registry";
export { runPreflight } from "./preflight";
export { runVerification, check, decideFromChecks } from "./verification";
export { runRollback, requiresRollback } from "./rollback";
export { executeCertifiedSkill, noopSkillDeps, hashInput } from "./executor";
export { ensureSkillsRegistered, resetSkillsForTest } from "./bootstrap";
export {
  CONTENT_TYPE_CATALOG,
  allCatalogTypes,
  allCatalogSubtypes,
  catalogEntry,
  isSensitiveType,
} from "./catalog";
export {
  buildCapabilityRows,
  refreshCapabilityMatrix,
  collectSkillCapabilityData,
  emptySkillCapabilityData,
  type SkillCapabilityData,
  type CapabilityRow,
} from "./capability";
export { makeSkillRuntimeDeps } from "./store";
export {
  planForDecision,
  defaultBuildPlan,
  type SkillPlan,
  type SkillPlanStep,
  type PlanInput,
} from "./planner";
