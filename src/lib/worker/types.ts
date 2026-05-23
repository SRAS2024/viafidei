/**
 * Shared types for the checklist-first worker pipeline.
 *
 * The worker is responsible for building complete, app-ready content from
 * admin-approved checklist items and their verified sources. Everything in
 * this module flows through the types declared here.
 */

import type {
  ChecklistApprovalStatus,
  ChecklistContentType,
  SourceAuthorityLevel,
  WorkerBuildStatus,
} from "@prisma/client";

export type {
  ChecklistApprovalStatus,
  ChecklistContentType,
  SourceAuthorityLevel,
  WorkerBuildStatus,
};

/// Ordering of authority levels for cross-source reconciliation. Lower index
/// wins when two sources disagree on the same field.
export const AUTHORITY_LEVEL_RANK: Record<SourceAuthorityLevel, number> = {
  VATICAN: 0,
  CATECHISM: 1,
  LITURGICAL_BOOK: 2,
  USCCB: 3,
  DIOCESAN: 4,
  RELIGIOUS_ORDER: 5,
  TRUSTED_PUBLISHER: 6,
  ACADEMIC: 7,
  COMMUNITY: 8,
};

export function compareAuthority(a: SourceAuthorityLevel, b: SourceAuthorityLevel): number {
  return AUTHORITY_LEVEL_RANK[a] - AUTHORITY_LEVEL_RANK[b];
}

export function isHigherAuthority(a: SourceAuthorityLevel, b: SourceAuthorityLevel): boolean {
  return AUTHORITY_LEVEL_RANK[a] < AUTHORITY_LEVEL_RANK[b];
}

/// One approved citation a worker can fetch.
export interface CitationInput {
  id: string;
  sourceUrl: string;
  sourceHost: string;
  authorityLevel: SourceAuthorityLevel;
  title: string | null;
  excerpt: string | null;
  validated: boolean;
}

/// A fetched source body the worker can extract from.
export interface FetchedSource {
  citationId: string;
  url: string;
  host: string;
  authorityLevel: SourceAuthorityLevel;
  status: number;
  body: string;
  checksum: string;
  title: string | null;
  fetchedAt: Date;
}

/// Provenance record stamped onto every generated field.
export interface FieldProvenance {
  sourceUrl: string;
  sourceHost: string;
  authorityLevel: SourceAuthorityLevel;
  confidence: number;
  notes?: string;
}

/// A single generated field with provenance and confidence.
export interface GeneratedField<T = unknown> {
  value: T;
  provenance: FieldProvenance[];
  confidence: number;
  warnings: string[];
}

/// A complete, app-ready content package emitted by the worker.
export interface BuiltContentPackage {
  contentType: ChecklistContentType;
  canonicalSlug: string;
  title: string;
  fields: Record<string, GeneratedField>;
  payload: Record<string, unknown>;
  authorityLevel: SourceAuthorityLevel;
  confidence: number;
  warnings: string[];
  citations: string[];
  needsHumanReview: boolean;
  humanReviewReason?: string;
}

/// Result of a single worker build attempt.
export interface BuildAttemptResult {
  ok: boolean;
  partial: boolean;
  package?: BuiltContentPackage;
  errorMessage?: string;
  warnings: string[];
  confidence: number;
}

/// Catholic-accuracy guards. The worker refuses to invent any of these.
export const FORBIDDEN_INVENTIONS = [
  "doctrine",
  "feast_day",
  "indulgence",
  "title",
  "apparition",
  "promise",
  "approval_status",
] as const;
export type ForbiddenInvention = (typeof FORBIDDEN_INVENTIONS)[number];

/// Quality dimensions QA scores.
export const QA_DIMENSIONS = [
  "completeness",
  "accuracy",
  "sourceCoverage",
  "formatting",
  "readability",
  "appCompat",
] as const;
export type QADimension = (typeof QA_DIMENSIONS)[number];
