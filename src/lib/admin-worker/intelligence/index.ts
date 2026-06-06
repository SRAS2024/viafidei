/**
 * Typed wrappers around {@link callBrain} — one function per brain op.
 *
 * Each returns `Promise<BrainEnvelope<Result> | null>`. A `null` means the
 * brain was unavailable; callers should fall back to their existing
 * deterministic heuristics. The envelope's `safeToAutoExecute` and `riskLevel`
 * are advisory — TypeScript's policy/publish gates make the final decision.
 */

import { callBrain, CallOpts } from "./client";
import {
  BrainEnvelope,
  CommunionRiskResult,
  CompareSourcesResult,
  DeveloperRequestsResult,
  DuplicateResult,
  EmbedResult,
  FailureClassification,
  FetchDiagnosis,
  FreshnessResult,
  GraphResult,
  IqResult,
  PlanResult,
  PrioritizeResult,
  QualityResult,
  RelationshipResult,
  SecurityResult,
  SelfInspectResult,
  SemanticSearchResult,
  SourceAssessmentResult,
} from "./contracts";

export * from "./contracts";
export {
  callBrain,
  isBrainEnabled,
  probeBrain,
  brainStatus,
  resetBrainStatus,
  resolveBrainRoot,
  ensureBrainStarted,
  shutdownBrain,
} from "./client";
export type { CallOpts } from "./client";
export * from "./store";

// ── Semantic memory / vectors ─────────────────────────────────────────
export interface EmbedItem {
  id?: string | null;
  text?: string;
  title?: string;
}
export function embed(items: EmbedItem[], opts?: CallOpts & { dims?: number }) {
  return callBrain<EmbedResult>("embed", { items, dims: opts?.dims }, opts);
}

export interface SemanticCandidate {
  id?: string | null;
  text?: string;
  title?: string;
  embedding_json?: string;
}
export function semanticSearch(
  query: string,
  candidates: SemanticCandidate[],
  opts?: CallOpts & { k?: number; minSimilarity?: number },
) {
  return callBrain<SemanticSearchResult>(
    "semantic_search",
    { query, candidates, k: opts?.k, min_similarity: opts?.minSimilarity },
    opts,
  );
}

// ── Duplicate detection ───────────────────────────────────────────────
export interface DuplicateRecord {
  id?: string | null;
  title?: string;
  slug?: string;
  text?: string;
  summary?: string;
  aliases?: string[];
  sources?: string[];
  citations?: string[];
}
export function detectDuplicates(
  target: DuplicateRecord,
  candidates: DuplicateRecord[],
  opts?: CallOpts & { duplicateThreshold?: number; k?: number },
) {
  return callBrain<DuplicateResult>(
    "detect_duplicates",
    { target, candidates, duplicate_threshold: opts?.duplicateThreshold, k: opts?.k },
    opts,
  );
}

// ── Quality scoring ───────────────────────────────────────────────────
export interface QualityRecord {
  contentType: string;
  title?: string;
  summary?: string;
  body?: string;
  text?: string;
  slug?: string;
  sources?: Array<{ authorityLevel?: string } | string>;
  citations?: string[];
  relationships?: unknown[];
  translations?: unknown[];
  communionRisk?: number;
  duplicateScore?: number;
  freshnessClass?: string;
}
export function scoreQuality(record: QualityRecord, opts?: CallOpts) {
  return callBrain<QualityResult>("score_quality", { record }, opts);
}

// ── Source intelligence + communion / doctrine ────────────────────────
export interface SourceInput {
  url?: string;
  host?: string;
  name?: string;
  description?: string;
  text?: string;
  authorityLevel?: string;
  failureRate?: number;
  freshnessDays?: number;
  completeness?: number;
}
export function assessSource(source: SourceInput, opts?: CallOpts) {
  return callBrain<SourceAssessmentResult>("assess_source", { source }, opts);
}

export function detectCommunionRisk(
  input: { name?: string; description?: string; text?: string; url?: string },
  opts?: CallOpts,
) {
  return callBrain<CommunionRiskResult>("detect_communion_risk", input, opts);
}

export interface ComparableSource {
  id?: string | null;
  text?: string;
  url?: string;
  authorityLevel?: string;
}
export function compareSources(sources: ComparableSource[], opts?: CallOpts & { topic?: string }) {
  return callBrain<CompareSourcesResult>("compare_sources", { sources, topic: opts?.topic }, opts);
}

// ── Relationship inference ────────────────────────────────────────────
export interface RelationshipNode {
  id?: string | null;
  contentType?: string;
  title?: string;
  text?: string;
  summary?: string;
  dates?: string[];
  categories?: string[];
  names?: string[];
  citations?: string[];
  sources?: string[];
}
export function inferRelationships(
  record: RelationshipNode,
  candidates: RelationshipNode[],
  opts?: CallOpts & { max?: number },
) {
  return callBrain<RelationshipResult>(
    "infer_relationships",
    { record, candidates, max: opts?.max },
    opts,
  );
}

// ── Repair + fetch diagnosis ──────────────────────────────────────────
export interface FailureInput {
  stage?: string;
  error?: string;
  message?: string;
  context?: string;
  code?: string;
  httpStatus?: number;
  contentType?: string;
  host?: string;
}
export function classifyFailure(failure: FailureInput, opts?: CallOpts) {
  return callBrain<FailureClassification>("classify_failure", { failure }, opts);
}

export interface FetchInput {
  httpStatus?: number;
  contentLength?: number;
  renderedTextLength?: number;
  contentType?: string;
  htmlSnippet?: string;
  blocked?: boolean;
  url?: string;
}
export function diagnoseFetch(fetch: FetchInput, opts?: CallOpts) {
  return callBrain<FetchDiagnosis>("diagnose_fetch", { fetch }, opts);
}

// ── Self-inspection / developer requests / IQ ─────────────────────────
export function selfInspect(
  input: {
    failures?: unknown[];
    blocked?: unknown[];
    jobs?: unknown[];
    logs?: unknown[];
    metrics?: Record<string, unknown>;
  },
  opts?: CallOpts,
) {
  return callBrain<SelfInspectResult>("self_inspect", input, opts);
}

export function developerRequests(
  input: { limitations?: unknown[]; failurePatterns?: unknown[]; blocked?: unknown[] },
  opts?: CallOpts,
) {
  return callBrain<DeveloperRequestsResult>("developer_requests", input, opts);
}

export function iqMetrics(stats: Record<string, number>, opts?: CallOpts) {
  return callBrain<IqResult>("iq_metrics", { stats }, opts);
}

// ── Planning / priority ───────────────────────────────────────────────
export interface PlanInput {
  objective: string;
  memories?: Array<{ text: string } | string>;
  available_tools?: Array<{ name: string; cost?: number; risk?: number; expected_value?: number }>;
  budget?: {
    max_steps?: number;
    max_seconds?: number;
    max_tool_calls?: number;
    min_confidence?: number;
  };
}
export function plan(input: PlanInput, opts?: CallOpts) {
  return callBrain<PlanResult>("plan", input, opts);
}

export interface PriorityCandidate {
  id?: string | null;
  label?: string;
  title?: string;
  missionImportance?: number;
  weakness?: number;
  userValue?: number;
  sourceAvailability?: number;
  confidence?: number;
  risk?: number;
  publishReadiness?: number;
  dependencyDepth?: number;
  expectedImpact?: number;
}
export function prioritize(candidates: PriorityCandidate[], opts?: CallOpts) {
  return callBrain<PrioritizeResult>("prioritize", { candidates }, opts);
}

// ── Knowledge graph ───────────────────────────────────────────────────
export interface GraphNode {
  id: string | number;
  type?: string;
  label?: string;
  title?: string;
}
export interface GraphEdge {
  source: string | number;
  target: string | number;
  type?: string;
}
export function analyzeGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  opts?: CallOpts & { maxSuggestions?: number },
) {
  return callBrain<GraphResult>(
    "analyze_graph",
    { nodes, edges, max_suggestions: opts?.maxSuggestions },
    opts,
  );
}

// ── Security ──────────────────────────────────────────────────────────
export function scanContent(text: string, opts?: CallOpts & { context?: string }) {
  return callBrain<SecurityResult>("scan_content", { text, context: opts?.context }, opts);
}

// ── Freshness ─────────────────────────────────────────────────────────
export interface FreshnessRecord {
  contentType: string;
  title?: string;
  summary?: string;
  text?: string;
  slug?: string;
}
export function classifyFreshness(record: FreshnessRecord, opts?: CallOpts) {
  return callBrain<FreshnessResult>("classify_freshness", { record }, opts);
}

export type { BrainEnvelope };
