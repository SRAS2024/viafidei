/**
 * Source roles — what a source is *allowed* to do in the factory.
 *
 * The factory pipeline gates work by role:
 *
 *   primary_content_source — may originate package body fields.
 *                            Discovery + fetch + build + persist are
 *                            all allowed.
 *   validation_source       — may validate fields produced by another
 *                            approved source. May be queried by the
 *                            cross-source validator. MUST NOT produce
 *                            primary body text on its own.
 *   enrichment_source       — may fill enrichment slots only
 *                            (Catechism references, related prayers,
 *                            patronage backfill, etc.). MUST NOT
 *                            originate the primary text.
 *   discovery_only_source   — may surface candidate URLs only. A
 *                            candidate from such a source MUST be
 *                            validated by an approved source before
 *                            it can publish.
 *   rejected_source         — explicitly forbidden. The worker MUST
 *                            NOT enqueue any job for this source.
 *
 * Promotions and demotions are automatic — see promoteOrDemoteRole().
 */

export const SOURCE_ROLES = [
  "primary_content_source",
  "validation_source",
  "enrichment_source",
  "discovery_only_source",
  "rejected_source",
] as const;

export type SourceRole = (typeof SOURCE_ROLES)[number];

export function isSourceRole(value: string): value is SourceRole {
  return (SOURCE_ROLES as readonly string[]).includes(value);
}

/**
 * Can a source originate primary content body fields? Only
 * `primary_content_source` may.
 */
export function canProvidePrimaryContent(role: SourceRole): boolean {
  return role === "primary_content_source";
}

/**
 * Can a source validate fields produced by another source?
 * Both primary and validation sources qualify — a primary source is
 * implicitly also a valid validation reference because it has
 * already cleared the higher bar.
 */
export function canValidate(role: SourceRole): boolean {
  return role === "primary_content_source" || role === "validation_source";
}

/**
 * Can a source enrich a built package? Both primary and enrichment
 * sources qualify, for the same reason canValidate() admits primary
 * sources.
 */
export function canEnrich(role: SourceRole): boolean {
  return role === "primary_content_source" || role === "enrichment_source";
}

/**
 * Can the worker enqueue discovery / fetch / build jobs for this
 * source? Every role except `rejected_source` may at least be
 * discovered — `discovery_only_source` is explicitly allowed here,
 * because that is the only thing it does.
 */
export function isFactoryEligible(role: SourceRole): boolean {
  return role !== "rejected_source";
}

/**
 * Stats used to decide automatic role transitions. These come from
 * SourceQualityScore aggregated for a given source.
 */
export type SourceRoleStats = {
  /** Total build attempts (success + failure). */
  buildAttempts: number;
  /** Builder successes. */
  buildSuccesses: number;
  /** QA passes that produced a public row. */
  qaPasses: number;
  /** QA failures. */
  qaFailures: number;
  /** Wrong-content rejections — the worst kind of source defect. */
  wrongContent: number;
  /** Duplicate rejections — milder defect. */
  duplicates: number;
};

export type RoleTransition = {
  fromRole: SourceRole;
  toRole: SourceRole;
  reason: string;
};

/**
 * Decide whether the role should change based on rolling stats.
 *
 * Promotion rules:
 *   - discovery_only_source → validation_source: at least 10 build
 *     attempts AND validPackageRate ≥ 0.6 AND wrongContentRate ≤ 0.05.
 *   - validation_source → primary_content_source: at least 25 QA
 *     passes AND validPackageRate ≥ 0.8.
 *
 * Demotion rules:
 *   - primary_content_source → validation_source: wrongContentRate
 *     ≥ 0.2 or validPackageRate ≤ 0.3 after at least 20 attempts.
 *   - validation_source / enrichment_source → discovery_only_source:
 *     wrongContentRate ≥ 0.3.
 *   - any role → rejected_source: wrongContentRate ≥ 0.5 after at
 *     least 10 attempts.
 *
 * Returns null when no transition should occur.
 */
export function decideRoleTransition(
  currentRole: SourceRole,
  stats: SourceRoleStats,
): RoleTransition | null {
  const attempts = stats.buildAttempts;
  if (attempts < 10) return null;
  const validRate = stats.qaPasses / Math.max(attempts, 1);
  const wrongRate = stats.wrongContent / Math.max(attempts, 1);

  // Hard rejection — bad enough that we stop the source entirely.
  if (wrongRate >= 0.5) {
    return {
      fromRole: currentRole,
      toRole: "rejected_source",
      reason: `wrong-content rate ${(wrongRate * 100).toFixed(1)}% over ${attempts} attempts`,
    };
  }

  switch (currentRole) {
    case "primary_content_source":
      if (attempts >= 20 && (wrongRate >= 0.2 || validRate <= 0.3)) {
        return {
          fromRole: currentRole,
          toRole: "validation_source",
          reason: `validRate ${(validRate * 100).toFixed(1)}% / wrongRate ${(wrongRate * 100).toFixed(1)}%`,
        };
      }
      return null;
    case "validation_source":
      if (wrongRate >= 0.3) {
        return {
          fromRole: currentRole,
          toRole: "discovery_only_source",
          reason: `wrong-content rate ${(wrongRate * 100).toFixed(1)}% — demoted to discovery-only`,
        };
      }
      if (stats.qaPasses >= 25 && validRate >= 0.8) {
        return {
          fromRole: currentRole,
          toRole: "primary_content_source",
          reason: `validRate ${(validRate * 100).toFixed(1)}% over ${stats.qaPasses} QA passes — promoted`,
        };
      }
      return null;
    case "enrichment_source":
      if (wrongRate >= 0.3) {
        return {
          fromRole: currentRole,
          toRole: "discovery_only_source",
          reason: `wrong-content rate ${(wrongRate * 100).toFixed(1)}% — demoted to discovery-only`,
        };
      }
      return null;
    case "discovery_only_source":
      if (attempts >= 10 && validRate >= 0.6 && wrongRate <= 0.05) {
        return {
          fromRole: currentRole,
          toRole: "validation_source",
          reason: `validRate ${(validRate * 100).toFixed(1)}% over ${attempts} attempts — promoted to validation`,
        };
      }
      return null;
    case "rejected_source":
      // A rejected source stays rejected until an admin intervenes.
      return null;
  }
}
