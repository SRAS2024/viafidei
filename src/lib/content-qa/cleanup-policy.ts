/**
 * Strict content QA cleanup policy.
 *
 * Three independent toggles control how the cleanup loop behaves:
 *
 *   - `deleteAllInvalid`     — when true, any row that fails its strict
 *                              package contract is deleted from the
 *                              catalog table + logged. There is no
 *                              "remove from public view but keep the
 *                              row" outcome; the only persisted states
 *                              after a sweep are "valid + render-ready"
 *                              or "deleted". Production runs with this
 *                              enabled.
 *   - `scanAllCatalogRows`   — when true, the cleanup loop scans every
 *                              row across every catalog table regardless
 *                              of status (PUBLISHED / REVIEW / DRAFT /
 *                              ARCHIVED) plus any row carrying stale
 *                              package flags or a stale contract
 *                              version. When false, the loop scans only
 *                              PUBLISHED + publicRenderReady=true rows.
 *   - `autoTriggerAfter*`    — when true, the queue worker auto-enqueues
 *                              a content_revalidate job after every
 *                              ingestion batch / catalog change.
 *
 * The cleanup outcome map under `deleteAllInvalid: true` is:
 *
 *   publish  → keep row, mark valid, mark render-ready, mark
 *              threshold-eligible.
 *   update   → keep row, update package fields, mark valid.
 *   skip     → keep row only if it is already valid and unchanged.
 *   reject   → delete row + write RejectedContentLog.
 *   delete   → delete row + write RejectedContentLog.
 *   archive  → only used for valid old content intentionally archived
 *              by an admin, NEVER for failed QA.
 *   review   → only allowed when an admin manually sends something to
 *              review; the automatic loop NEVER produces this outcome.
 */

import { appConfig } from "../config";
import { getEnv } from "../env";

export type CleanupMode = "public_only" | "all_catalog_rows";

export type CleanupPolicy = {
  /** When true, every invalid row is deleted + logged. */
  deleteAllInvalid: boolean;
  /** Sweep scope. `all_catalog_rows` includes REVIEW / DRAFT / ARCHIVED. */
  mode: CleanupMode;
  /**
   * Auto-trigger flag. When true the queue worker enqueues a
   * content_revalidate after every ingestion batch.
   */
  autoTriggerAfterIngestion: boolean;
  /** Contract version the catalog rows must match to be considered fresh. */
  packageContractVersion: string;
  /** Stale-after window for the cleanupHealth diagnostic. */
  staleAfterMs: number;
};

/**
 * Resolve the active cleanup policy. Environment overrides take
 * precedence over the hardcoded defaults in `appConfig.contentQA`. The
 * resulting policy is read by the cleanup loop, the admin dashboard,
 * and the diagnostic surface.
 */
export function resolveCleanupPolicy(): CleanupPolicy {
  const env = getEnv();
  const base = appConfig.contentQA;
  const deleteAllInvalid = readBool(env.CONTENT_QA_DELETE_ALL_INVALID, base.deleteAllInvalid);
  const scanAllCatalogRows = readBool(
    env.CONTENT_QA_SCAN_ALL_CATALOG_ROWS,
    base.scanAllCatalogRows,
  );
  return {
    deleteAllInvalid,
    mode: scanAllCatalogRows ? "all_catalog_rows" : "public_only",
    autoTriggerAfterIngestion: base.autoTriggerAfterIngestion,
    packageContractVersion: base.packageContractVersion,
    staleAfterMs: base.staleAfterMs,
  };
}

function readBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
}

/**
 * Human-readable label for the active policy. Surfaced on the admin
 * dashboard so the operator can see at a glance which mode the cleanup
 * loop is running in.
 */
export function describeCleanupPolicy(policy: CleanupPolicy): string {
  const sweepLabel = policy.mode === "all_catalog_rows" ? "All catalog rows" : "Public rows only";
  const deleteLabel = policy.deleteAllInvalid
    ? "Delete all invalid (strict)"
    : "Hide invalid from public view (legacy)";
  return `${sweepLabel} · ${deleteLabel}`;
}
