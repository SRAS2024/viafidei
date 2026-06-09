/**
 * Skill registration. Registers every certified skill pack exactly once. The
 * worker calls ensureSkillsRegistered() at boot; the capability matrix, planner,
 * and dashboard all read the resulting registry.
 *
 * As new packs are added (source, verification, publishing, repair, homepage,
 * reporting, security, maintenance) they are registered here.
 */

import { registerSkills, clearRegistry } from "./registry";
import { extractionSkills } from "./extraction-skills";
import { verificationSkills } from "./verification-skills";
import { sourceSkills } from "./source-skills";
import { discoverySkills } from "./discovery-skills";
import { pdfSkills } from "./pdf-skills";
import { publishingSkills } from "./publishing-skills";
import { subtitleSkills } from "./subtitle-skills";
import { repairSkills } from "./repair-skills";
import { homepageSkills } from "./homepage-skills";
import { securitySkills } from "./security-skills";
import type { CertifiedSkill } from "./types";

let registered = false;

export function ensureSkillsRegistered(): void {
  if (registered) return;
  // Heterogeneous registry: each pack is authored with a concrete output type;
  // the registry + executor treat the output as unknown (verify/rollback read it
  // structurally), so we erase the output type at the registration boundary.
  registerSkills(extractionSkills as unknown as CertifiedSkill[]);
  registerSkills(verificationSkills as unknown as CertifiedSkill[]);
  registerSkills(sourceSkills);
  registerSkills(discoverySkills);
  registerSkills(pdfSkills);
  registerSkills(publishingSkills);
  registerSkills(subtitleSkills);
  registerSkills(repairSkills);
  registerSkills(homepageSkills);
  registerSkills(securitySkills);
  registered = true;
}

/** Test-only: clear the registry and allow re-registration. */
export function resetSkillsForTest(): void {
  clearRegistry();
  registered = false;
}
