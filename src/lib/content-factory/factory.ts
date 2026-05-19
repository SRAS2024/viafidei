/**
 * Content factory orchestrator.
 *
 * `runContentFactory()` is the single entry point that maps a
 * SourceDocument to a persisted (or rejected) content row. The
 * worker calls it once per fetched document; the seed script calls it
 * once per seed item; the manual admin "rebuild" action calls it
 * with `forceRebuild = true`.
 *
 * Flow:
 *
 *   1. Builder.build()           → BuildResult
 *      - non-success outcomes log to ContentPackageBuildLog and
 *        update SourceQualityScore counters
 *   2. normalize()               → in-place canonical values
 *   3. enrich()                  → fills missing fields from approved sources
 *   4. runStrictPipelineSync()   → ContractValidationResult
 *      - reject / delete decisions write to RejectedContentLog and stop
 *   5. persistBuiltPackage()     → public row written (created / updated)
 *
 * Every meaningful event updates SourceQualityScore so the planner
 * can auto-pause bad sources and prioritise good ones.
 */

import { logger } from "../observability/logger";
import { recordRejectedContentBatch } from "../content-qa/rejected-log";
import { runStrictPipelineSync } from "../content-qa/pipeline";
import { getSourcePurposes } from "../content-qa/source-purpose";
import type { CandidatePackage, ContractValidationResult } from "../content-qa/types";
import type { SourceRole } from "../ingestion/sources/roles";
import { isSourceRole } from "../ingestion/sources/roles";
import { getBuilder } from "./builders";
import { recordBuildLog } from "./build-log";
import { validateCrossSource, type EvidenceRecord } from "./cross-source-validation";
import {
  collectCrossSourceEvidence,
  findApprovedValidators,
  persistEvidenceBatch,
  type ValidatorCandidate,
} from "./cross-source-evidence-collector";
import { enrichPackage } from "./enrich";
import { normalizePackage } from "./normalize";
import { persistBuiltPackage, type PersistResult } from "./persist";
import { recordScoreEvent } from "./source-scoring";
import type { BuildResult, ContentTypeKey, SourceDocumentSnapshot } from "./types";

export type FactoryRunInput = {
  contentType: ContentTypeKey;
  document: SourceDocumentSnapshot;
  sourceId?: string | null;
  workerJobId?: string | null;
  ingestionBatchId?: string | null;
  triggeredBy?: "automatic" | "manual";
  actorUsername?: string | null;
  /**
   * Role of the source that produced this document. Defaults to
   * `discovery_only_source` when unset — the safe default that
   * forces cross-source validation before publication.
   */
  sourceRole?: SourceRole;
  /**
   * Evidence collected from approved validation sources for this
   * document. When omitted AND `validators` is supplied, the
   * orchestrator runs `collectCrossSourceEvidence()` itself. Tests
   * can pass evidence directly to skip the collector.
   */
  collectedEvidence?: ReadonlyArray<EvidenceRecord>;
  /**
   * Approved validator documents for the in-tick collector. When
   * omitted, the orchestrator looks up validators via
   * `findApprovedValidators()` (an Ingestion-source DB lookup). The
   * worker passes pre-hydrated validator bodies for performance.
   */
  validators?: ReadonlyArray<ValidatorCandidate>;
};

export type FactoryRunResult = {
  contentType: ContentTypeKey;
  sourceUrl: string;
  build: BuildResult;
  validation?: ContractValidationResult;
  persist?: PersistResult;
  decision:
    | "persisted-created"
    | "persisted-updated"
    | "persist-skipped"
    | "build-failed"
    | "wrong-content"
    | "source-not-allowed"
    | "duplicate"
    | "not-supported"
    | "source-exhausted"
    | "qa-rejected"
    | "qa-deleted"
    | "validation-evidence-missing";
};

export async function runContentFactory(input: FactoryRunInput): Promise<FactoryRunResult> {
  const builder = getBuilder(input.contentType);
  const buildResult = builder.build({
    document: input.document,
    sourceId: input.sourceId ?? null,
    workerJobId: input.workerJobId ?? null,
    ingestionBatchId: input.ingestionBatchId ?? null,
    sourcePurposes: input.document.sourcePurposes,
  });

  await recordBuildLog({
    result: buildResult,
    sourceDocumentId: input.document.id ?? null,
    sourceUrl: input.document.sourceUrl,
    sourceHost: input.document.sourceHost,
    workerJobId: input.workerJobId ?? null,
    ingestionBatchId: input.ingestionBatchId ?? null,
  });

  if (buildResult.outcome !== "built_complete_package") {
    if (input.sourceId) {
      await recordScoreEvent({
        kind: buildResult.outcome === "wrong_content" ? "wrong_content" : "build_failure",
        sourceId: input.sourceId,
        contentType: input.contentType,
        reason: buildResult.failureReason,
      });
    }
    return {
      contentType: input.contentType,
      sourceUrl: input.document.sourceUrl,
      build: buildResult,
      decision:
        buildResult.outcome === "wrong_content"
          ? "wrong-content"
          : buildResult.outcome === "source_not_allowed"
            ? "source-not-allowed"
            : buildResult.outcome === "duplicate"
              ? "duplicate"
              : buildResult.outcome === "not_supported_by_source"
                ? "not-supported"
                : buildResult.outcome === "source_exhausted"
                  ? "source-exhausted"
                  : "build-failed",
    };
  }

  if (input.sourceId) {
    await recordScoreEvent({
      kind: "build_success",
      sourceId: input.sourceId,
      contentType: input.contentType,
    });
  }

  // Normalize + enrich in the canonical order spec'd by the user.
  const pkg = buildResult.package;
  normalizePackage(pkg);
  enrichPackage(pkg, buildResult.builderVersion);

  // Cross-source validation. Sits between the builder and strict
  // QA. The wider goal is to grow volume by adding good sources +
  // good validation, NOT by lowering QA standards. A
  // primary_content_source bypasses this check; every other role
  // must produce `pass` evidence for the required fields of the
  // content type.
  const role: SourceRole = isSourceRole(input.sourceRole ?? "")
    ? (input.sourceRole as SourceRole)
    : "discovery_only_source";
  pkg.sourceRole = role;

  // Gather evidence. Caller-supplied evidence wins (tests). When
  // omitted and role !== primary_content_source, run the collector
  // against approved validators in the same tick (spec §17 — fold
  // into content_build).
  let collectedEvidence: ReadonlyArray<EvidenceRecord> = input.collectedEvidence ?? [];
  if (input.collectedEvidence === undefined && role !== "primary_content_source") {
    const validators: ReadonlyArray<ValidatorCandidate> =
      input.validators ??
      (await findApprovedValidators(pkg.contentType, {
        excludeHost: pkg.sourceHost,
      }).catch(() => []));
    if (validators.length > 0) {
      const collected = await collectCrossSourceEvidence({ pkg, validators }).catch((e) => {
        logger.warn("content-factory.collect_evidence_failed", {
          slug: pkg.slug,
          error: e instanceof Error ? e.message : String(e),
        });
        return { evidence: [], totalValidatorsQueried: 0 };
      });
      collectedEvidence = collected.evidence;
      // Persist for admin visibility — best-effort.
      await persistEvidenceBatch(collected.evidence, {
        candidateSlug: pkg.slug,
        contentType: pkg.contentType,
      }).catch(() => undefined);
    }
  }

  const crossSource = validateCrossSource({
    pkg,
    primarySourceRole: role,
    collectedEvidence,
  });
  if (crossSource.decision === "fail") {
    if (input.sourceId) {
      await recordScoreEvent({
        kind: "qa_fail",
        sourceId: input.sourceId,
        contentType: input.contentType,
        reason: crossSource.reason,
      });
    }
    await recordRejectedContentBatch([
      {
        contentType: pkg.contentType,
        slug: pkg.slug,
        originalTitle: pkg.title,
        sourceUrl: pkg.sourceUrl,
        sourceHost: pkg.sourceHost,
        rejectionReason: crossSource.reason,
        failedContractName: crossSource.contractName,
        failedFields: [...crossSource.missingEvidenceFields],
        decision: "reject",
        triggeredBy: input.triggeredBy ?? "automatic",
        actorUsername: input.actorUsername ?? null,
        workerJobId: input.workerJobId ?? null,
        ingestionBatchId: input.ingestionBatchId ?? null,
        packageVersion: null,
        validationDecision: "reject",
        failureCategory: "validation_evidence_missing",
        sweepReason: "factory",
        originalStatus: null,
        cleanupMode: null,
      },
    ]).catch((e) =>
      logger.warn("content-factory.cross_source_rejected_log_failed", {
        slug: pkg.slug,
        error: e instanceof Error ? e.message : String(e),
      }),
    );
    return {
      contentType: input.contentType,
      sourceUrl: input.document.sourceUrl,
      build: buildResult,
      decision: "validation-evidence-missing",
    };
  }

  // Strict QA — the pipeline dispatches the right contract by content
  // type. It returns publish/update on success, reject/delete on
  // failure, archive/review for special cases.
  const purposes = pkg.approvedSourcePurposes
    ? toPurposeRecord(pkg.approvedSourcePurposes)
    : await getSourcePurposes(pkg.sourceHost);
  const candidate: CandidatePackage = {
    contentType: pkg.contentType,
    slug: pkg.slug,
    title: pkg.title,
    sourceUrl: pkg.sourceUrl,
    sourceHost: pkg.sourceHost,
    payload: pkg.payload,
    approvedSourcePurposes: pkg.approvedSourcePurposes ?? [],
  };
  const validation = runStrictPipelineSync(candidate, purposes);

  if (input.sourceId) {
    await recordScoreEvent({
      kind:
        validation.decision === "publish" || validation.decision === "update"
          ? "qa_pass"
          : "qa_fail",
      sourceId: input.sourceId,
      contentType: input.contentType,
      reason: validation.reason,
    });
  }

  if (validation.decision !== "publish" && validation.decision !== "update") {
    // Only `reject` / `delete` / `archive` produce rejected-log rows;
    // `skip` / `review` are treated as informational and do not write
    // to that table.
    const loggable: "reject" | "delete" | "archive" | null =
      validation.decision === "reject"
        ? "reject"
        : validation.decision === "delete"
          ? "delete"
          : validation.decision === "archive"
            ? "archive"
            : null;
    if (loggable) {
      await recordRejectedContentBatch([
        {
          contentType: pkg.contentType,
          slug: pkg.slug,
          originalTitle: pkg.title,
          sourceUrl: pkg.sourceUrl,
          sourceHost: pkg.sourceHost,
          rejectionReason: validation.reason,
          failedContractName: validation.contractName,
          failedFields: validation.failedFields,
          decision: loggable,
          triggeredBy: input.triggeredBy ?? "automatic",
          actorUsername: input.actorUsername ?? null,
          workerJobId: input.workerJobId ?? null,
          ingestionBatchId: input.ingestionBatchId ?? null,
          packageVersion: validation.contractVersion,
          validationDecision: validation.decision,
          failureCategory: classifyFailureCategory(validation),
          sweepReason: "factory",
          originalStatus: null,
          cleanupMode: null,
        },
      ]).catch((e) =>
        logger.warn("content-factory.rejected_log_failed", {
          slug: pkg.slug,
          error: e instanceof Error ? e.message : String(e),
        }),
      );
    }
    if (input.sourceId) {
      await recordScoreEvent({
        kind: validation.decision === "delete" ? "deleted" : "qa_fail",
        sourceId: input.sourceId,
        contentType: input.contentType,
      });
    }
    return {
      contentType: input.contentType,
      sourceUrl: input.document.sourceUrl,
      build: buildResult,
      validation,
      decision: validation.decision === "delete" ? "qa-deleted" : "qa-rejected",
    };
  }

  const persistResult = await persistBuiltPackage({
    pkg,
    validation,
    workerJobId: input.workerJobId ?? null,
    ingestionBatchId: input.ingestionBatchId ?? null,
    triggeredBy: input.triggeredBy,
    actorUsername: input.actorUsername,
  });

  // Public display verification: after persistence, the strict public
  // query MUST be able to see the row. If it can't, we log a public-
  // gate-failure event and enqueue a render-gate revalidation so the
  // cleanup loop either fixes the flags or deletes the row with a
  // precise log entry. Skipped persists are exempt (the row was
  // already public before this run).
  if (persistResult.outcome === "created" || persistResult.outcome === "updated") {
    const { verifyPublicDisplayAndRepair } = await import("./public-display-verifier");
    await verifyPublicDisplayAndRepair({
      contentType: input.contentType,
      slug: pkg.slug,
    }).catch((e) =>
      logger.warn("content-factory.public_display_verify_failed", {
        slug: pkg.slug,
        error: e instanceof Error ? e.message : String(e),
      }),
    );
    // Search + sitemap verification: spec #17 / #26.10. After the
    // row is public, confirm both surfaces include it. Failures are
    // logged but do not roll back persistence — they trigger the
    // existing indexing-repair path.
    const { verifyIndexing } = await import("./search-sitemap-verifier");
    await verifyIndexing({
      contentType: input.contentType,
      slug: pkg.slug,
    }).catch((e) =>
      logger.warn("content-factory.indexing_verify_failed", {
        slug: pkg.slug,
        error: e instanceof Error ? e.message : String(e),
      }),
    );
    // Spec §19: revalidate the cache tags affected by this row.
    // Logged into the in-memory cache health snapshot so admin
    // diagnostics can prove the factory revalidated after persist.
    const { revalidateForRow } = await import("../cache/revalidate");
    await revalidateForRow({
      reason: persistResult.outcome === "created" ? "package_created" : "package_updated",
      contentType: input.contentType,
      slug: pkg.slug,
    }).catch((e) =>
      logger.warn("content-factory.cache_revalidate_failed", {
        slug: pkg.slug,
        error: e instanceof Error ? e.message : String(e),
      }),
    );
  }

  return {
    contentType: input.contentType,
    sourceUrl: input.document.sourceUrl,
    build: buildResult,
    validation,
    persist: persistResult,
    decision:
      persistResult.outcome === "created"
        ? "persisted-created"
        : persistResult.outcome === "updated"
          ? "persisted-updated"
          : "persist-skipped",
  };
}

function toPurposeRecord(purposes: ReadonlyArray<string>) {
  // Construct a SourcePurposeRecord-shaped object for runStrictPipelineSync.
  // Only the fields it inspects need to be present; missing ones default
  // to false in the contract validators.
  const set = new Set(purposes);
  return {
    canIngestPrayers: set.has("canIngestPrayers"),
    canIngestSaints: set.has("canIngestSaints"),
    canIngestApparitions: set.has("canIngestApparitions"),
    canIngestParishes: set.has("canIngestParishes"),
    canIngestDevotions: set.has("canIngestDevotions"),
    canIngestNovenas: set.has("canIngestNovenas"),
    canIngestSacraments: set.has("canIngestSacraments"),
    canIngestRosaryGuides: set.has("canIngestRosaryGuides"),
    canIngestConsecrations: set.has("canIngestConsecrations"),
    canIngestSpiritualGuides: set.has("canIngestSpiritualGuides"),
    canIngestLiturgy: set.has("canIngestLiturgy"),
    canIngestHistory: set.has("canIngestHistory"),
    canProvideScriptureText: set.has("canProvideScriptureText"),
  };
}

function classifyFailureCategory(v: ContractValidationResult): string {
  const reason = v.reason.toLowerCase();
  if (reason.includes("wrong content")) return "wrong_content";
  if (reason.includes("missing")) return "missing_required_field";
  if (reason.includes("source") || reason.includes("purpose")) return "source_purpose_mismatch";
  if (reason.includes("format")) return "format_invalid";
  if (reason.includes("render")) return "render_not_ready";
  if (reason.includes("duplicate")) return "duplicate";
  return "unknown";
}
