/**
 * Strict TypeScript ↔ Python contracts for the intelligence brain.
 *
 * Every brain call sends a typed request and receives the same structured
 * envelope, which we validate with Zod before trusting it (spec: "TypeScript
 * should validate every response before using it"). The Python side speaks
 * snake_case; we validate that shape and transform the *envelope* fields to
 * camelCase. Op-specific `result` payloads keep their Python field names and
 * are typed by the interfaces below.
 */

import { z } from "zod";

/** Must match intelligence/__init__.py PROTOCOL_VERSION. */
export const PROTOCOL_VERSION = 1;

export const RISK_LEVELS = ["none", "low", "medium", "high", "critical"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

/** Every op the Python registry exposes. Keep in sync with registry.py. */
export const BRAIN_OPS = [
  "embed",
  "semantic_search",
  "detect_duplicates",
  "score_quality",
  "assess_source",
  "detect_communion_risk",
  "compare_sources",
  "infer_relationships",
  "classify_failure",
  "diagnose_fetch",
  "self_inspect",
  "developer_requests",
  "iq_metrics",
  "plan",
  "prioritize",
  "analyze_graph",
  "scan_content",
  "classify_freshness",
] as const;
export type BrainOp = (typeof BRAIN_OPS)[number];

/** The validated, camelCased response envelope TypeScript works with. */
export interface BrainEnvelope<T = unknown> {
  ok: boolean;
  result: T | null;
  confidence: number;
  reasoning: string;
  evidence: string[];
  sourcesUsed: string[];
  riskLevel: RiskLevel;
  recommendedNextAction: string;
  safeToAutoExecute: boolean;
  error: string | null;
  op: string | null;
  protocolVersion: number;
  elapsedMs: number;
}

/**
 * Zod schema for the raw (snake_case) envelope the brain emits, transformed
 * into the camelCase {@link BrainEnvelope}. `result` stays `unknown` here and
 * is narrowed by the typed wrappers in `index.ts`.
 */
export const BrainEnvelopeSchema = z
  .object({
    ok: z.boolean(),
    result: z.unknown().nullable(),
    confidence: z.number(),
    reasoning: z.string(),
    evidence: z.array(z.string()),
    sources_used: z.array(z.string()),
    risk_level: z.enum(RISK_LEVELS),
    recommended_next_action: z.string(),
    safe_to_auto_execute: z.boolean(),
    error: z.string().nullable(),
    op: z.string().nullable().optional(),
    protocol_version: z.number().optional(),
    elapsed_ms: z.number().optional(),
  })
  .transform(
    (e): BrainEnvelope => ({
      ok: e.ok,
      result: e.result ?? null,
      confidence: Math.max(0, Math.min(1, e.confidence)),
      reasoning: e.reasoning,
      evidence: e.evidence,
      sourcesUsed: e.sources_used,
      riskLevel: e.risk_level,
      recommendedNextAction: e.recommended_next_action,
      safeToAutoExecute: e.safe_to_auto_execute,
      error: e.error,
      op: e.op ?? null,
      protocolVersion: e.protocol_version ?? 0,
      elapsedMs: e.elapsed_ms ?? 0,
    }),
  );

// ── Op-specific result payload types (Python field names) ─────────────

export interface DuplicateMatch {
  id: string | null;
  title?: string | null;
  score: number;
  verdict: "duplicate" | "likely-duplicate" | "possible-duplicate" | "distinct";
  signals: Record<string, number>;
}
export interface DuplicateResult {
  is_duplicate: boolean;
  best_match: DuplicateMatch | null;
  matches: DuplicateMatch[];
  duplicate_threshold: number;
}

export interface CommunionRiskResult {
  communion_risk: number;
  verdict: string;
  flags: string[];
  trust_signals: string[];
  official_domain: boolean;
  host: string | null;
}

export interface SourceAssessmentResult {
  overall_score: number;
  tier: string;
  subscores: Record<string, number>;
  communion: CommunionRiskResult;
}

export interface CompareSourcesResult {
  agreement: number | null;
  contradictions: Array<{
    a: string | null;
    b: string | null;
    similarity: number;
    a_values: string[];
    b_values: string[];
    summary: string;
  }>;
  ranked: Array<{ id: string | null; authority: string; rank_score: number }>;
  strongest_source?: string | null;
}

export interface QualityResult {
  content_type: string;
  overall: number;
  subscores: Record<string, number>;
  publish_gates_failed: string[];
  weak_dimensions: string[];
  sensitive: boolean;
}

export interface RelationshipRecommendation {
  id: string | null;
  title?: string | null;
  score: number;
  type_hint: string;
  signals: Record<string, number>;
  rationale: string;
}
export interface RelationshipResult {
  recommendations: RelationshipRecommendation[];
  strong_count: number;
}

export interface FailureClassification {
  category: string;
  likely_cause: string;
  ranked_fixes: string[];
  retryable: boolean;
  permanent: boolean;
  flags: Record<string, boolean>;
  recognised: boolean;
}

export interface FetchDiagnosis {
  issue: string;
  likely_cause: string;
  recommended_method: string;
  developer_request: { kind: string; title: string; detail: string } | null;
}

export interface DeveloperRequest {
  kind: "parser" | "schema" | "source" | "ui" | "safety" | "capability" | "code" | "data";
  title: string;
  detail: string;
  severity: "low" | "medium" | "high";
  evidence: string;
}
export interface SelfInspectResult {
  summary: Record<string, number>;
  failure_patterns: Array<{ pattern: string; count: number; recommendation: string }>;
  recommendations: string[];
  developer_requests: DeveloperRequest[];
}
export interface DeveloperRequestsResult {
  requests: DeveloperRequest[];
  count: number;
}

export interface IqResult {
  metrics: Record<string, number> & { iq_index: number };
}

export interface PlanStep {
  step: number;
  action: string;
  expected_value: number;
  cost: number;
  risk: number;
  score: number;
}
export interface PlanResult {
  plan: PlanStep[];
  next_best_action: PlanStep | null;
  principles: Array<{ claim: string; confidence: number; value: number; risk: number }>;
  memories_considered: number;
}

export interface PrioritizeResult {
  ranked: Array<{
    id: string | null;
    label?: string | null;
    score: number;
    drivers: Record<string, number>;
  }>;
  top: { id: string | null; label?: string | null; score: number } | null;
}

export interface GraphResult {
  node_count: number;
  edge_count: number;
  components: number;
  orphans: Array<string | number>;
  weakly_connected: Array<string | number>;
  hubs: Array<{ id: string | number; degree: number }>;
  missing_edges: Array<{
    source: string | number;
    target: string | number;
    reason: string;
    confidence: number;
  }>;
  duplicate_clusters: Array<Array<string | number>>;
}

export interface SecurityResult {
  verdict: "clean" | "low-risk" | "suspicious" | "malicious";
  suspicion: number;
  matches: string[];
  categories: string[];
}

export interface FreshnessResult {
  freshness_class:
    | "TIMELESS"
    | "YEARLY"
    | "SEASONAL"
    | "DAILY"
    | "FREQUENTLY_CHANGING"
    | "LOCATION_SPECIFIC"
    | "SOURCE_DEPENDENT";
  refresh_interval_days: number;
}

export interface SemanticSearchResult {
  matches: Array<{
    id: string | null;
    similarity: number;
    shared_terms: string[];
    preview: string;
    explanation: string;
  }>;
  query: string;
  considered: number;
}

export interface EmbedResult {
  vectors: Array<{ id: string | null; embedding_json: string; dims: number; term_count: number }>;
  dims: number;
  count: number;
}
