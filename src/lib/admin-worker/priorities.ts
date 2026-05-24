/**
 * Admin Worker priority ladder. The central loop walks this ladder in
 * order; the first priority with available work becomes the active
 * priority for the pass.
 *
 * Spec: section 2 "Admin Worker should prioritize tasks in this order".
 */

import type { AdminWorkerPriority } from "@prisma/client";

export const PRIORITY_ORDER: readonly AdminWorkerPriority[] = [
  "SECURITY_THREAT",
  "WORKER_HEALTH",
  "CONTENT_GOAL",
  "SOURCE_REPAIR",
  "CONTENT_BUILD",
  "CONTENT_VALIDATION",
  "CONTENT_PUBLISH",
  "HOMEPAGE",
  "DIAGNOSTICS",
  "CLEANUP",
  "MAINTENANCE",
] as const;

export function priorityRank(p: AdminWorkerPriority): number {
  const idx = PRIORITY_ORDER.indexOf(p);
  return idx < 0 ? PRIORITY_ORDER.length : idx;
}

export function comparePriority(a: AdminWorkerPriority, b: AdminWorkerPriority): number {
  return priorityRank(a) - priorityRank(b);
}

/**
 * Pick the highest priority from a candidate set. Returns null when
 * the set is empty.
 */
export function highestPriority(
  candidates: ReadonlyArray<AdminWorkerPriority>,
): AdminWorkerPriority | null {
  if (candidates.length === 0) return null;
  return [...candidates].sort(comparePriority)[0];
}
