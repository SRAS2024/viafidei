/**
 * Content factory shared types.
 *
 * The content factory is the layer between source fetching and strict
 * QA. The flow is:
 *
 *   Source discovery
 *   → Source fetch          → SourceDocument
 *   → Source document clean → SourceDocument (cleaned)
 *   → Candidate detection
 *   → Package building      → ContentPackage  (one builder per type)
 *   → Package normalization → ContentPackage  (typed shape, normalized values)
 *   → Package enrichment    → ContentPackage  (filled from approved sources)
 *   → Strict QA             → ContractValidationResult
 *   → Persistence           → public Prayer / Saint / ... row
 *   → Public render gate    → publicRenderReady = true
 *   → Monitoring            → SourceQualityScore + ContentPackageBuildLog
 *
 * No part of the application persists "uncertain" content as public,
 * "failed" content as review, or "raw rows" as progress. Only
 * complete validated packages flow through `persistBuiltPackage()`.
 */

import type { ContentTypeKey, ContractValidationResult } from "../content-qa/types";

export type { ContentTypeKey };

/**
 * Final outcome of a builder pass. Only `built_complete_package`
 * advances to strict QA. Every other outcome is logged to
 * `ContentPackageBuildLog` with the failure reason.
 *
 * The full set matches the user-facing spec one-to-one.
 */
export type BuildOutcomeKind =
  | "built_complete_package"
  | "build_failed_missing_required_fields"
  | "wrong_content"
  | "source_not_allowed"
  | "duplicate"
  | "not_supported_by_source"
  | "source_exhausted";

/**
 * Where one field in a built package came from. Builders attach a
 * provenance record to every required field so an admin can trace
 * back to the exact source snippet that produced the value.
 *
 * "Deterministic" extraction methods (slug normalization, sacrament
 * group mapping, ISO date parse) skip the snippet hash, but still
 * carry an explanation string.
 */
export type FieldProvenance = {
  sourceUrl: string;
  sourceHost: string;
  sourceDocumentId?: string | null;
  sourceHeading?: string | null;
  sourceSection?: string | null;
  /** Hash of the originating text snippet. Skipped for deterministic rules. */
  snippetHash?: string | null;
  /** How the value was produced ("regex", "json-ld", "deterministic", ...). */
  extractionMethod: string;
  /** Builder version that produced the value. */
  extractorVersion: string;
  /** 0..1 confidence. Deterministic rules use 1.0. */
  confidence: number;
  timestamp: string;
};

export type PackageProvenance = Record<string, FieldProvenance>;

/**
 * SourceDocument as the factory sees it. The persisted row carries
 * the same fields (plus IDs / timestamps), but builders work off the
 * structured shape here.
 */
export type SourceDocumentSnapshot = {
  id?: string;
  sourceUrl: string;
  sourceHost: string;
  sourceTier?: number | null;
  sourceTitle?: string | null;
  cleanedBody?: string | null;
  rawBody?: string | null;
  headings?: ReadonlyArray<{ level: number; text: string }>;
  paragraphs?: ReadonlyArray<string>;
  lists?: ReadonlyArray<{ ordered: boolean; items: ReadonlyArray<string> }>;
  tables?: ReadonlyArray<{ rows: ReadonlyArray<ReadonlyArray<string>> }>;
  links?: ReadonlyArray<{ url: string; text: string }>;
  metadata?: Record<string, string | undefined>;
  /** Source purpose flags (canIngestPrayers, canIngestSaints, ...). */
  sourcePurposes?: Record<string, boolean>;
  fetchStatus?: string;
  httpStatus?: number | null;
  etag?: string | null;
  lastModifiedHeader?: string | null;
  contentChecksum?: string | null;
  cleanedChecksum?: string | null;
  language?: string | null;
};

/**
 * The complete content package a builder emits when its outcome is
 * `built_complete_package`. The shape is intentionally broad —
 * each content type fills the subset of fields it needs. Normalisation
 * and enrichment may add fields; strict QA validates against the
 * content-qa contract for the type. Persistence pulls from this same
 * structure.
 */
export type ContentPackage = {
  contentType: ContentTypeKey;
  slug: string;
  title: string;
  language?: string;
  sourceUrl: string;
  sourceHost: string;
  sourceTier?: number | null;
  contentChecksum?: string | null;
  /** Typed payload for the content type. Builders narrow this internally. */
  payload: Record<string, unknown>;
  /** Per-field provenance map. Required fields must have an entry. */
  provenance: PackageProvenance;
  /** Optional package metadata for renderers (e.g. novena days, rosary mysteries). */
  packageMetadata?: Record<string, unknown>;
  /** Approved source purposes for this source — passed through to QA. */
  approvedSourcePurposes?: ReadonlyArray<string>;
  /**
   * Role of the source that produced this package. Drives the
   * cross-source validator: only `primary_content_source` may
   * originate required body fields without external evidence.
   * Optional so existing fixtures don't break; defaults to
   * `discovery_only_source` when unset.
   */
  sourceRole?: string;
};

/**
 * Result returned by every builder.
 */
export type BuildResult =
  | {
      outcome: "built_complete_package";
      contentType: ContentTypeKey;
      package: ContentPackage;
      builderName: string;
      builderVersion: string;
      missingFields: ReadonlyArray<string>;
    }
  | {
      outcome: Exclude<BuildOutcomeKind, "built_complete_package">;
      contentType: ContentTypeKey;
      builderName: string;
      builderVersion: string;
      failureReason: string;
      missingFields: ReadonlyArray<string>;
      candidateSlug?: string;
      candidateTitle?: string;
      partialPayload?: Record<string, unknown>;
    };

/**
 * Builder context shared by every builder call.
 */
export type BuilderContext = {
  document: SourceDocumentSnapshot;
  /** Source ID this document came from (when known). */
  sourceId?: string | null;
  /** Queue row id that triggered the build. */
  workerJobId?: string | null;
  /** Ingestion batch id this build is part of. */
  ingestionBatchId?: string | null;
  /** Source purposes the source is approved for. */
  sourcePurposes?: Record<string, boolean>;
};

/**
 * Shape every builder implements.
 */
export type Builder = {
  contentType: ContentTypeKey;
  builderName: string;
  builderVersion: string;
  build(ctx: BuilderContext): BuildResult;
};

/**
 * Strict QA decision routed back through the factory orchestrator,
 * carrying the originating ContentPackage so persistence has access
 * to provenance and metadata.
 */
export type FactoryStage =
  | "discovery"
  | "fetch"
  | "build"
  | "validate"
  | "persist"
  | "render_gate"
  | "monitor";

export type FactoryEvent =
  | { stage: "build"; outcome: BuildOutcomeKind; contentType: ContentTypeKey; sourceUrl: string }
  | {
      stage: "validate";
      decision: ContractValidationResult["decision"];
      contentType: ContentTypeKey;
      sourceUrl: string;
    }
  | { stage: "persist"; result: "created" | "updated" | "skipped" | "failed"; sourceUrl: string };
