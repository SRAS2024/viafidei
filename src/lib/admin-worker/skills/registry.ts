/**
 * Certified skill registry. The single source of truth for "what the worker can
 * actually do." Skills are registered once at boot (see ./bootstrap). The
 * capability matrix and the Skill Planner read from here; if a skill is not
 * registered, the worker treats the task as MISSING and files a developer
 * request rather than pretending it can do it.
 */

import type { CertifiedSkill, SkillCategory } from "./types";

const REGISTRY = new Map<string, CertifiedSkill>();

/** Register one certified skill. Throws on duplicate names (parity guard). */
export function registerSkill(skill: CertifiedSkill): void {
  if (REGISTRY.has(skill.name)) {
    throw new Error(`Duplicate certified skill: ${skill.name}`);
  }
  REGISTRY.set(skill.name, skill);
}

export function registerSkills(skills: readonly CertifiedSkill[]): void {
  for (const s of skills) registerSkill(s);
}

export function getSkill(name: string): CertifiedSkill | null {
  return REGISTRY.get(name) ?? null;
}

export function isCertified(name: string): boolean {
  return REGISTRY.has(name);
}

export function listSkills(): CertifiedSkill[] {
  return [...REGISTRY.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function listByCategory(category: SkillCategory): CertifiedSkill[] {
  return listSkills().filter((s) => s.category === category);
}

/** Skills that declare support for a content type ("*" = type-agnostic). */
export function skillsForContentType(contentType: string): CertifiedSkill[] {
  return listSkills().filter(
    (s) => s.contentTypes.includes("*") || s.contentTypes.includes(contentType),
  );
}

/** Skills that declare support for a content subtype. */
export function skillsForContentSubtype(subtype: string): CertifiedSkill[] {
  return listSkills().filter(
    (s) => s.contentSubtypes.includes("*") || s.contentSubtypes.includes(subtype),
  );
}

export function registeredSkillCount(): number {
  return REGISTRY.size;
}

/** Test-only: reset the registry between tests. */
export function clearRegistry(): void {
  REGISTRY.clear();
}
