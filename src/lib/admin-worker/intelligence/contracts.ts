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
  "select_action",
  "analyze_graph",
  "scan_content",
  "classify_freshness",
  // liturgical calendar + lectionary
  "liturgical_day",
  "lectionary_readings",
  // Intelligence Laboratory — Causal Intelligence Core
  "build_causal_graph",
  "infer_causal_factors",
  "explain_root_cause",
  "detect_causal_chain",
  "rank_causal_factors",
  "update_causal_model",
  "explain_causal_model",
  // Counterfactual reasoning
  "run_counterfactual_analysis",
  "estimate_alternative_outcome",
  "explain_counterfactual_difference",
  "rank_counterfactual_paths",
  // Safe experiments
  "design_safe_experiment",
  "run_experiment_plan",
  "evaluate_experiment_result",
  "compare_experiment_groups",
  "extract_experiment_lesson",
  "recommend_experiment_followup",
  // Hypothesis engine
  "generate_hypothesis",
  "rank_hypotheses",
  "test_hypothesis",
  "evaluate_hypothesis_result",
  "accept_or_reject_hypothesis",
  "store_hypothesis_lesson",
  // Proof packets
  "build_proof_packet",
  "prove_claim_support",
  "prove_publish_eligibility",
  "prove_block_reason",
  "prove_review_requirement",
  "explain_failed_proof",
  // Formal logic rules
  "build_logic_rules",
  "check_invariants",
  "evaluate_logic_rule",
  "detect_rule_conflict",
  "prove_rule_satisfaction",
  "explain_rule_failure",
  // Epistemic status
  "assign_epistemic_status",
  "update_epistemic_status",
  "explain_uncertainty",
  "detect_overconfidence",
  "require_more_evidence",
  "rank_claim_certainty",
  // Formal Catholic ontology
  "build_catholic_ontology",
  "classify_entity",
  "link_entity_to_ontology",
  "validate_entity_relationship",
  "detect_ontology_gap",
  "explain_ontology_decision",
  "infer_ontology_relationships",
  // Strategy tournament
  "generate_candidate_strategies",
  "simulate_strategy",
  "run_strategy_tournament",
  "rank_strategy",
  "explain_winning_strategy",
  "store_strategy_result",
  // Benchmark arena + brain-version comparison
  "run_intelligence_benchmark",
  "rank_weakest_skills",
  "score_brain_version",
  "compare_brain_versions",
  "detect_intelligence_regression",
  "detect_brain_regression",
  "explain_brain_improvement",
  "recommend_brain_upgrade",
  "publish_benchmark_report",
  // Digital twin
  "create_worker_simulation",
  "replay_worker_history",
  "simulate_database_state",
  "simulate_source_failure",
  "simulate_publish_pipeline",
  "simulate_admin_feedback",
  "compare_simulated_vs_real_outcome",
  // Capability invention
  "invent_capability",
  "decompose_capability",
  "estimate_capability_gain",
  "design_capability_contract",
  "design_capability_tests",
  "rank_new_capabilities",
  "explain_capability_need",
  // Self-generated curriculum
  "generate_training_cases",
  "rank_training_difficulty",
  "run_curriculum",
  "score_skill_progress",
  "identify_skill_plateau",
  "recommend_training_focus",
  // Adversarial self-testing
  "generate_adversarial_case",
  "attack_decision",
  "find_reasoning_weakness",
  "harden_rule",
  "create_regression_from_attack",
  // Architecture governor
  "check_architecture_integrity",
  "detect_competing_paths",
  "detect_unowned_module",
  "detect_unverified_stage",
  "enforce_unified_brain_boundary",
  "generate_architecture_report",
  // Highest-leverage change ranking
  "rank_highest_leverage_change",
  "estimate_intervention_value",
  "compare_intervention_costs",
  "explain_highest_leverage_change",
  "extract_knowledge",
  "suggest_structure",
  "detect_variants",
  "detect_missing",
  "learn_from_outcome",
  "analyze_schema",
  "analyze_ui",
  // Unified self-model + deep code awareness (replaced summary-only analyze_code).
  "ingest_codebase",
  "build_self_model",
  "build_symbol_graph",
  "build_call_graph",
  "build_route_graph",
  "build_schema_graph",
  "build_test_coverage_graph",
  "explain_own_architecture",
  "find_weak_modules",
  "find_untested_modules",
  "find_orphaned_code",
  "find_duplicate_logic",
  "rank_self_upgrades",
  "detect_stuckness",
  // Catholic authority graph
  "build_catholic_authority_graph",
  "rank_catholic_source_authority",
  "resolve_authority_chain",
  "classify_document_authority",
  "classify_source_role",
  "explain_authority_decision",
  // claim-level verification
  "extract_claims",
  "normalize_claim",
  "compare_claims",
  "detect_date_conflict",
  "detect_entity_conflict",
  "detect_title_conflict",
  "detect_liturgical_conflict",
  "resolve_claim_with_authority",
  "build_claim_evidence_pack",
  // action simulation
  "simulate_action",
  "predict_action_outcome",
  "estimate_failure_modes",
  "estimate_repair_cost",
  "estimate_publish_risk",
  "compare_counterfactual_actions",
  // confidence calibration
  "calibrate_confidence",
  "measure_prediction_accuracy",
  "grade_brain_decision",
  "track_false_positive_risk",
  "track_false_negative_risk",
  "score_decision_quality",
  // stuckness detection
  "detect_action_loop",
  "detect_source_loop",
  "detect_repair_loop",
  "detect_no_growth",
  "explain_no_growth",
  "recommend_unblock_strategy",
  // mission control
  "build_mission_tree",
  "update_mission_progress",
  "detect_mission_blockers",
  "rank_subgoals",
  "recommend_next_mission_action",
  // self-explanation
  "explain_decision",
  "explain_rejected_alternatives",
  "explain_safety_gate",
  "explain_confidence",
  "explain_what_would_change_my_mind",
  // upgrade-request engine
  "rank_upgrade_requests",
  "explain_upgrade_request",
  "merge_duplicate_upgrade_requests",
  "detect_ignored_upgrade_requests",
  "estimate_upgrade_roi",
  // test-gap detection
  "detect_test_gap",
  "suggest_regression_test",
  "generate_test_fixture_plan",
  "propose_test_patch",
  "rank_missing_tests",
  // specialist reviewers
  "specialist_reviews",
  "combine_specialist_reviews",
  // multi-layer memory
  "consolidate_memories",
  "summarize_repeated_lessons",
  "merge_duplicate_memories",
  "detect_conflicting_memories",
  "retire_stale_memories",
  "rank_memory_importance",
  "retrieve_context_pack",
  "extract_upgrade_requests_from_memory",
  // hybrid retrieval
  "hybrid_search",
  "rank_memory_candidates",
  "rank_source_candidates",
  "rank_related_content",
  "explain_retrieval_result",
  "detect_memory_gap",
  // Catholic content extraction
  "identify_document_type",
  "extract_structured_catholic_document",
  "extract_liturgical_date",
  "extract_canon_law_reference",
  "extract_catechism_reference",
  "extract_papal_document_metadata",
  "extract_council_document_metadata",
  "extract_saint_metadata",
  "extract_parish_metadata",
  "extract_prayer_metadata",
  "extract_novena_metadata",
  "extract_litany_metadata",
  "build_church_history_timeline_entry",
  // review-gated self-improvement
  "propose_code_patch",
  "propose_schema_migration",
  "review_patch_risk",
  "generate_rollback_plan",
  "explain_patch_value",
  // replayability & resilience
  "replay_decision",
  "compare_decisions",
  "explain_decision_change",
  "detect_decision_drift",
  "recommend_circuit_break",
  "check_replay_integrity",
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
  kind:
    | "parser"
    | "schema"
    | "source"
    | "ui"
    | "safety"
    | "capability"
    | "code"
    | "data"
    | "process";
  title: string;
  detail: string;
  severity: "low" | "medium" | "high";
  evidence: string;
  /**
   * Full structured request (spec item 7: affected files/models/stages/ops/
   * routes, expected gain + user value, risk, difficulty, plan, tests,
   * migration, rollback, priority + confidence). Persisted to
   * AdminWorkerDeveloperRequest.metadata so the request is a complete,
   * actionable product-manager record, not just a title + detail string.
   */
  metadata?: Record<string, unknown> | null;
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

export interface ExtractKnowledgeResult {
  dates: string[];
  names: string[];
  citations: string[];
  sources: string[];
  summary: string;
  claims: string[];
  sections: string[];
  years: string[];
}

export interface StructureResult {
  content_type: string;
  suggested_sections: string[];
  missing_sections: string[];
  split_recommended: boolean;
  paragraphs: number;
}

export interface VariantsResult {
  candidate_variants: Array<{ form: string; kind: string; confidence: number }>;
  title: string;
}

export interface MissingResult {
  content_type: string;
  missing: Array<{ field: string; severity: "low" | "medium" | "high" | "critical"; note: string }>;
  missing_count: number;
  overall_completeness: number;
}

export interface LearningAdjustment {
  target: string;
  key: string;
  direction: "increase" | "decrease" | "hold";
  magnitude: number;
}
export interface LearningResult {
  lesson: string;
  adjustments: LearningAdjustment[];
  memory_key: string;
  memory_value: Record<string, unknown>;
  signal: number;
  outcome_class: "positive" | "negative" | "neutral";
}

export interface SchemaAnalysisResult {
  findings: {
    model_count: number;
    isolated_models: string[];
    under_indexed_models: string[];
    thin_models: string[];
  };
  developer_requests: DeveloperRequest[];
}

export interface UiAnalysisResult {
  findings: {
    public_route_count: number;
    admin_page_count: number;
    content_type_count: number;
    unexposed_content_types: string[];
  };
  developer_requests: DeveloperRequest[];
}

// ── Unified self-model + deep code awareness result types ─────────────
export interface SelfModelResult {
  file_count: number;
  source_file_count: number;
  test_file_count: number;
  total_lines: number;
  route_count: number;
  prisma_model_count: number;
  script_count: number;
  worker_stage_count: number;
  brain_op_count: number;
  test_coverage_ratio: number;
  largest_modules: Array<{ path: string; lines: number }>;
}

export interface WeakModule {
  path: string;
  lines: number;
  importers: number;
  why: string;
  suggested_split: string;
  refactor_risk: RiskLevel;
  suggested_tests: string;
}
export interface WeakModulesResult {
  weak_modules: WeakModule[];
  weak_count: number;
}

export interface UntestedModulesResult {
  untested_modules: Array<{ path: string; lines: number }>;
  untested_count: number;
}

export interface OrphanResult {
  orphan_candidates: Array<{ path: string; exports: string[] }>;
  orphan_count: number;
}

export interface DuplicateLogicResult {
  duplicate_pairs: Array<{ a: string; b: string; overlap: number }>;
  pair_count: number;
}

export interface CoverageGraphResult {
  source_modules: number;
  covered_modules: number;
  uncovered_modules: string[];
  coverage_ratio: number;
}

export interface SelfUpgrade {
  title: string;
  category: string;
  problem: string;
  evidence: string[];
  affected_files: string[];
  affected_models: string[];
  affected_worker_stages: string[];
  affected_brain_operations: string[];
  affected_public_routes: string[];
  affected_admin_routes: string[];
  expected_intelligence_gain: string;
  expected_user_value: string;
  risk_if_not_fixed: string;
  implementation_difficulty: string;
  suggested_implementation_plan: string;
  suggested_tests: string;
  suggested_migration: string;
  rollback_plan: string;
  priority_score: number;
  confidence_score: number;
}
export interface SelfUpgradesResult {
  upgrades: SelfUpgrade[];
  upgrade_count: number;
}

export interface ArchitectureResult {
  layers: string[];
  evidence_counts: Record<string, number>;
}

export interface StucknessResult {
  stuck: boolean;
  signals: string[];
  recommended_unblock: string;
}

/**
 * Strict Python-brain FINAL DECISION contract (snake_case from Python →
 * camelCase). The Python brain is the final action selector; TypeScript
 * validates this shape with `BrainFinalDecisionSchema` and refuses to
 * execute anything that does not parse (no silent fallback to a legacy
 * TS brain — an invalid shape routes to safe diagnostics/repair).
 */
const RejectedAlternativeSchema = z
  .object({
    mission_stage: z.string(),
    action_type: z.string().nullish(),
    final_score: z.number(),
    safe: z.boolean().default(true),
    rejected_reason: z.string().nullish(),
  })
  .transform((a) => ({
    missionStage: a.mission_stage,
    actionType: a.action_type ?? null,
    finalScore: a.final_score,
    safe: a.safe,
    rejectedReason: a.rejected_reason ?? null,
  }));

export const BrainFinalDecisionSchema = z
  .object({
    selected_action: z.string().min(1),
    mission_stage: z.string().min(1),
    action_type: z.string().nullish(),
    target_content_type: z.string().nullish(),
    target_source: z.string().nullish(),
    target_candidate_url: z.string().nullish(),
    target_package_artifact: z.string().nullish(),
    expected_result: z.string(),
    final_score: z.number(),
    confidence_score: z.number(),
    risk_score: z.number(),
    urgency_score: z.number(),
    source_score: z.number(),
    quality_expectation: z.number(),
    repair_likelihood: z.number(),
    fallback_action: z.string().nullish(),
    stop_condition: z.string().nullish(),
    rejected_alternatives: z.array(RejectedAlternativeSchema).default([]),
    reasoning: z.string().default(""),
    evidence_used: z.array(z.string()).default([]),
    memories_used: z.array(z.string()).default([]),
    source_reputation_used: z.array(z.string()).default([]),
    stage_outcomes_used: z.array(z.string()).default([]),
    safety_notes: z.array(z.string()).default([]),
  })
  .transform((d) => ({
    selectedAction: d.selected_action,
    missionStage: d.mission_stage,
    actionType: d.action_type ?? null,
    targetContentType: d.target_content_type ?? null,
    targetSource: d.target_source ?? null,
    targetCandidateUrl: d.target_candidate_url ?? null,
    targetPackageArtifact: d.target_package_artifact ?? null,
    expectedResult: d.expected_result,
    finalScore: d.final_score,
    confidenceScore: d.confidence_score,
    riskScore: d.risk_score,
    urgencyScore: d.urgency_score,
    sourceScore: d.source_score,
    qualityExpectation: d.quality_expectation,
    repairLikelihood: d.repair_likelihood,
    fallbackAction: d.fallback_action ?? null,
    stopCondition: d.stop_condition ?? null,
    rejectedAlternatives: d.rejected_alternatives,
    reasoning: d.reasoning,
    evidenceUsed: d.evidence_used,
    memoriesUsed: d.memories_used,
    sourceReputationUsed: d.source_reputation_used,
    stageOutcomesUsed: d.stage_outcomes_used,
    safetyNotes: d.safety_notes,
  }));

export type BrainFinalDecision = z.infer<typeof BrainFinalDecisionSchema>;
