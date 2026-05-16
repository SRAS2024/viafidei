/**
 * Core strict content QA types.
 *
 * The strict content QA system replaces the loose "REVIEW-by-default"
 * pipeline. Every public content type owns a contract that defines:
 *
 *   - Content type identity
 *   - Allowed subtypes
 *   - Required fields and required sections
 *   - Formatting rules
 *   - Source purpose rules (the source must be approved for this kind)
 *   - Render readiness rules (the public page must have every required
 *     section filled)
 *   - Delete rules (signals that mean "delete from the database")
 *   - Threshold counting rules (rows that count toward content goals)
 *
 * The contract is the single source of truth: if a row does not pass
 * its contract, it must not be public, must not satisfy thresholds,
 * and must be deleted or rejected from the database with a row in
 * `RejectedContentLog`.
 */

/**
 * One of the public content types governed by a strict package
 * contract. New types must add a matching contract module under
 * `./contracts/`.
 */
export type ContentTypeKey =
  | "Prayer"
  | "Saint"
  | "MarianApparition"
  | "Devotion"
  | "Novena"
  | "Sacrament"
  | "Rosary"
  | "Consecration"
  | "SpiritualGuidance"
  | "Liturgy"
  | "History"
  | "Parish";

/**
 * Final outcome of a contract validation pass. Every other status the
 * old loose pipeline produced (REVIEW-by-default, "imperfect but
 * possibly real") collapses into one of these six.
 *
 *   - `publish` — persist with status = PUBLISHED, publicRenderReady =
 *                 true, isThresholdEligible = true. Visible everywhere.
 *   - `update`  — same as publish but applied to an existing row;
 *                 the persister rewrites it in place + snapshots the
 *                 previous version into ContentVersion.
 *   - `skip`    — exact duplicate (matching checksum). Already in the
 *                 catalog; do nothing.
 *   - `reject`  — structurally invalid or contract-failed; do NOT
 *                 persist. Log to RejectedContentLog and walk away.
 *   - `delete`  — the item exists in the database but fails its
 *                 contract; hard-delete it and log.
 *   - `archive` — valid but historical (e.g. older version superseded
 *                 by a more authoritative copy). Removed from public
 *                 view, kept in the table for audit.
 *   - `review`  — *optional* admin holding area. NEVER public, NEVER
 *                 counted in thresholds. Only used when an admin
 *                 explicitly requested inspection.
 */
export type ContractDecision =
  | "publish"
  | "update"
  | "skip"
  | "reject"
  | "delete"
  | "archive"
  | "review";

/**
 * Result of running a contract on a candidate package.
 *
 *   - When `decision` is `publish` / `update`, the validator has
 *     confirmed every required field, section, and source-purpose
 *     check. `publicRenderReady` is true and `isThresholdEligible` is
 *     true. The persister flips both flags on the persisted row.
 *   - When `decision` is `reject` or `delete`, `failedFields` lists
 *     which contract requirements were unmet. Every failure is logged
 *     to RejectedContentLog.
 */
export type ContractValidationResult = {
  decision: ContractDecision;
  /** Stable identifier for the contract that produced this result. */
  contractName: string;
  /** Public content type the contract enforces. */
  contentType: ContentTypeKey;
  /** Required fields / sections that failed. Empty on accept. */
  failedFields: string[];
  /** Human-readable reason — surfaced in admin logs + rejection log. */
  reason: string;
  /** True when the row is OK to render as a complete public page. */
  publicRenderReady: boolean;
  /** True when the row should count toward content thresholds. */
  isThresholdEligible: boolean;
  /** Version of the contract that ran. Bumped on every spec change. */
  contractVersion: string;
};

/**
 * Minimal candidate shape a contract receives. Each contract narrows
 * it to its own typed package internally, but the pipeline orchestrator
 * uses this base shape to route candidates uniformly.
 */
export type CandidatePackage = {
  contentType: ContentTypeKey;
  slug?: string;
  title?: string;
  sourceUrl?: string;
  sourceHost?: string;
  /** Free-form package payload — each contract destructures its own keys. */
  payload: Record<string, unknown>;
  /** Optional adapter context for source-purpose checks. */
  approvedSourcePurposes?: ReadonlyArray<string>;
};

/**
 * Public-page readiness gate. A row that does not pass `isPublicVisible`
 * MUST be filtered out of every public list, search response, and tab
 * page. Threshold counters call `isCountableForThreshold` to decide
 * whether the row contributes to backlog progress.
 */
export type PackageVisibilityFlags = {
  status: string;
  publicRenderReady: boolean;
  isThresholdEligible: boolean;
  archivedAt: Date | null;
};

export function isPublicVisible(flags: PackageVisibilityFlags): boolean {
  return (
    flags.status === "PUBLISHED" &&
    flags.publicRenderReady === true &&
    flags.isThresholdEligible === true &&
    flags.archivedAt === null
  );
}

export function isCountableForThreshold(flags: PackageVisibilityFlags): boolean {
  return isPublicVisible(flags);
}
