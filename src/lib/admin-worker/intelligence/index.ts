/**
 * Typed wrappers around {@link callBrain} — one function per brain op.
 *
 * Each returns `Promise<BrainEnvelope<Result> | null>`. A `null` means the
 * brain was unavailable for that op: for the final-action op (select_action)
 * this puts the worker into safe degraded mode (it never falls back to a
 * TypeScript final-decision path); for supplementary ops the caller simply
 * skips that analysis. The envelope's `safeToAutoExecute` and `riskLevel` are
 * inputs to TypeScript's safety validation — TypeScript validates the brain's
 * selected action and enforces every safety/policy/publish gate (and may
 * reject an unsafe choice) before executing it.
 */

import { callBrain, CallOpts } from "./client";
import {
  BrainEnvelope,
  CommunionRiskResult,
  CompareSourcesResult,
  DeveloperRequestsResult,
  DuplicateResult,
  EmbedResult,
  ExtractKnowledgeResult,
  FailureClassification,
  FetchDiagnosis,
  FreshnessResult,
  GraphResult,
  IqResult,
  LearningResult,
  MissingResult,
  PlanResult,
  PrioritizeResult,
  QualityResult,
  RelationshipResult,
  SchemaAnalysisResult,
  SecurityResult,
  SelfInspectResult,
  SemanticSearchResult,
  SourceAssessmentResult,
  StructureResult,
  UiAnalysisResult,
  VariantsResult,
  // Unified self-model + deep code awareness
  SelfModelResult,
  WeakModulesResult,
  UntestedModulesResult,
  OrphanResult,
  DuplicateLogicResult,
  CoverageGraphResult,
  SelfUpgradesResult,
  ArchitectureResult,
  StucknessResult,
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

// ── Final action selection (the Python brain is the final brain) ──────
export interface FinalActionCandidate {
  missionStage: string;
  actionType?: string | null;
  contentType?: string | null;
  sourceTarget?: string | null;
  candidateUrl?: string | null;
  packageArtifactId?: string | null;
  expectedOutput?: string;
  finalScore: number;
  confidenceScore?: number;
  riskScore?: number;
  urgencyScore?: number;
  sourceScore?: number;
  qualityExpectation?: number;
  repairScore?: number;
  fallbackAction?: string | null;
  stopCondition?: string | null;
  safe: boolean;
  rejectionReason?: string | null;
}
export interface SelectActionInput {
  candidates: FinalActionCandidate[];
  world?: Record<string, unknown>;
  stageOutcomes?: Array<Record<string, unknown>>;
  actionHistory?: Array<{ missionStage: string; contentType?: string | null }>;
  sourceReputation?: Array<{ host: string; tier: string }>;
  sourceFatigue?: Record<string, number>;
  contentTypeProfiles?: Array<Record<string, unknown>>;
  repairState?: Record<string, unknown>;
}
/** Ask the Python brain to select the final action. The result is parsed
 *  with `BrainFinalDecisionSchema` by the caller (final-brain.ts). */
export function selectAction(input: SelectActionInput, opts?: CallOpts) {
  return callBrain<unknown>("select_action", input, opts);
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

// ── Liturgical calendar + lectionary ──────────────────────────────────
export interface LiturgicalDayResult {
  date: string;
  season: string;
  seasonLabel: string;
  color: string;
  sundayCycle: string;
  weekdayCycle: string;
  dayOfWeek: number;
  isSunday: boolean;
  weekOfSeason: number;
  rank: string;
  celebration: string;
  lectionaryKey: string;
}
export interface LectionaryReadingsResult {
  date: string;
  lectionaryKey: string;
  celebration: string;
  sundayCycle: string;
  weekdayCycle: string;
  covered: boolean;
  sections: Array<{ kind: string; label: string; citation: string }>;
}
/** The brain's precise liturgical day (General Roman Calendar) for an ISO date. */
export function liturgicalDay(date: string, opts?: CallOpts) {
  return callBrain<LiturgicalDayResult>("liturgical_day", { date }, opts);
}
/** The brain's Mass-reading citations for an ISO date (the body resolves text). */
export function lectionaryReadings(date: string, opts?: CallOpts) {
  return callBrain<LectionaryReadingsResult>("lectionary_readings", { date }, opts);
}

// ── Intelligence Laboratory (typed wrappers over the lab ops) ──────────────
type Lab = Record<string, unknown>;

/** Causal: trace a symptom to its root cause + the breaking intervention. */
export function explainRootCause(
  symptom: string,
  signals?: Record<string, number>,
  opts?: CallOpts,
) {
  return callBrain<Lab>("explain_root_cause", { symptom, signals: signals ?? {} }, opts);
}
export function buildCausalGraph(signals?: Record<string, number>, opts?: CallOpts) {
  return callBrain<Lab>("build_causal_graph", { signals: signals ?? {} }, opts);
}
/** Counterfactual: estimate the alternatives to what happened. */
export function runCounterfactualAnalysis(payload: Lab, opts?: CallOpts) {
  return callBrain<Lab>("run_counterfactual_analysis", payload, opts);
}
/** Proof: build a proof packet / check publish eligibility. */
export function buildProofPacket(payload: Lab, opts?: CallOpts) {
  return callBrain<Lab>("build_proof_packet", payload, opts);
}
export function checkInvariants(state: Lab, opts?: CallOpts) {
  return callBrain<Lab>("check_invariants", { state }, opts);
}
/** Epistemic: assign a claim its epistemic status. */
export function assignEpistemicStatus(claim: Lab, opts?: CallOpts) {
  return callBrain<Lab>("assign_epistemic_status", { claim }, opts);
}
/** Strategy / benchmark / leverage / architecture / capability. */
export function runStrategyTournament(payload: Lab, opts?: CallOpts) {
  return callBrain<Lab>("run_strategy_tournament", payload, opts);
}
export function runIntelligenceBenchmark(results: Record<string, number>, opts?: CallOpts) {
  return callBrain<Lab>("run_intelligence_benchmark", { results }, opts);
}
export function compareBrainVersions(payload: Lab, opts?: CallOpts) {
  return callBrain<Lab>("compare_brain_versions", payload, opts);
}
export function rankHighestLeverageChange(payload?: Lab, opts?: CallOpts) {
  return callBrain<Lab>("rank_highest_leverage_change", payload ?? {}, opts);
}
export function generateArchitectureReport(report: Lab, opts?: CallOpts) {
  return callBrain<Lab>("generate_architecture_report", { report }, opts);
}
export function inventCapability(payload: Lab, opts?: CallOpts) {
  return callBrain<Lab>("invent_capability", payload, opts);
}

// ── Knowledge extraction / structure / variants ───────────────────────
export function extractKnowledge(text: string, opts?: CallOpts & { maxItems?: number }) {
  return callBrain<ExtractKnowledgeResult>(
    "extract_knowledge",
    { text, max_items: opts?.maxItems },
    opts,
  );
}

export function suggestStructure(
  record: { contentType: string; body?: string; text?: string; sections?: unknown[] },
  opts?: CallOpts,
) {
  return callBrain<StructureResult>("suggest_structure", { record }, opts);
}

export function detectVariants(
  input: { title: string; knownVariants?: string[] },
  opts?: CallOpts,
) {
  return callBrain<VariantsResult>("detect_variants", input, opts);
}

// ── Missing-information detection ──────────────────────────────────────
export interface MissingRecord {
  contentType: string;
  title?: string;
  summary?: string;
  body?: string;
  text?: string;
  slug?: string;
  sources?: unknown[];
  citations?: unknown[];
  relationships?: unknown[];
  translations?: unknown[];
  dates?: unknown[];
}
export function detectMissing(record: MissingRecord, opts?: CallOpts) {
  return callBrain<MissingResult>("detect_missing", { record }, opts);
}

// ── Learning from outcomes (incl. admin feedback) ─────────────────────
export interface OutcomeInput {
  type: string;
  contentType?: string;
  sourceHost?: string;
  detail?: string;
  confidence?: number;
}
export function learnFromOutcome(outcome: OutcomeInput, opts?: CallOpts) {
  return callBrain<LearningResult>("learn_from_outcome", { outcome }, opts);
}

// ── Schema / UI awareness ─────────────────────────────────────────────
export interface SchemaModelSummary {
  name: string;
  fields: number;
  relations: number;
  indexes: number;
}
export function analyzeSchema(models: SchemaModelSummary[], opts?: CallOpts) {
  return callBrain<SchemaAnalysisResult>("analyze_schema", { models }, opts);
}

export function analyzeUi(
  input: { public_routes: string[]; admin_pages: string[]; content_types: string[] },
  opts?: CallOpts,
) {
  return callBrain<UiAnalysisResult>("analyze_ui", input, opts);
}

// ── Unified self-model + deep code awareness (replaces analyze_code) ───
/** One ingested module: TypeScript reads the file (it owns the filesystem). */
export interface SelfModelFile {
  path: string;
  lines: number;
  exports: string[];
  imports: string[];
  isTest?: boolean;
  referencedByTests?: boolean;
}
export interface SelfModelCorpus {
  files: SelfModelFile[];
  routes: Array<{ path: string; file?: string }>;
  models: Array<{ name: string; usedByFiles: number }>;
  scripts: string[];
  stages: string[];
  brain_ops: string[];
}

export function ingestCodebase(corpus: SelfModelCorpus, opts?: CallOpts) {
  return callBrain("ingest_codebase", corpus, opts);
}
export function buildSelfModel(corpus: SelfModelCorpus, opts?: CallOpts) {
  return callBrain<SelfModelResult>("build_self_model", corpus, opts);
}
export function buildSymbolGraph(files: SelfModelFile[], opts?: CallOpts) {
  return callBrain("build_symbol_graph", { files }, opts);
}
export function buildCallGraph(files: SelfModelFile[], opts?: CallOpts) {
  return callBrain("build_call_graph", { files }, opts);
}
export function buildRouteGraph(routes: SelfModelCorpus["routes"], opts?: CallOpts) {
  return callBrain("build_route_graph", { routes }, opts);
}
export function buildSchemaGraph(models: SelfModelCorpus["models"], opts?: CallOpts) {
  return callBrain("build_schema_graph", { models }, opts);
}
export function buildTestCoverageGraph(files: SelfModelFile[], opts?: CallOpts) {
  return callBrain<CoverageGraphResult>("build_test_coverage_graph", { files }, opts);
}
export function explainOwnArchitecture(model: SelfModelResult, opts?: CallOpts) {
  return callBrain<ArchitectureResult>("explain_own_architecture", { model }, opts);
}
export function findWeakModules(
  files: SelfModelFile[],
  opts?: CallOpts & { oversizedThreshold?: number },
) {
  return callBrain<WeakModulesResult>(
    "find_weak_modules",
    { files, oversized_threshold: opts?.oversizedThreshold },
    opts,
  );
}
export function findUntestedModules(files: SelfModelFile[], opts?: CallOpts) {
  return callBrain<UntestedModulesResult>("find_untested_modules", { files }, opts);
}
export function findOrphanedCode(files: SelfModelFile[], opts?: CallOpts) {
  return callBrain<OrphanResult>("find_orphaned_code", { files }, opts);
}
export function findDuplicateLogic(files: SelfModelFile[], opts?: CallOpts) {
  return callBrain<DuplicateLogicResult>("find_duplicate_logic", { files }, opts);
}
export function rankSelfUpgrades(
  findings: {
    weak_modules?: unknown[];
    untested_modules?: unknown[];
    orphan_candidates?: unknown[];
    duplicate_pairs?: unknown[];
    coverage_ratio?: number;
  },
  opts?: CallOpts,
) {
  return callBrain<SelfUpgradesResult>("rank_self_upgrades", findings, opts);
}
export function detectStuckness(
  input: {
    recent_decisions?: Array<{ missionStage?: string }>;
    recent_repairs?: Array<{ kind?: string; status?: string }>;
    published_delta?: number;
    pass_count?: number;
    source_fatigue?: Record<string, number>;
  },
  opts?: CallOpts,
) {
  return callBrain<StucknessResult>("detect_stuckness", input, opts);
}

// ── Catholic authority graph ──────────────────────────────────────────
export function buildCatholicAuthorityGraph(opts?: CallOpts) {
  return callBrain("build_catholic_authority_graph", {}, opts);
}
export function rankCatholicSourceAuthority(
  sources: Array<Record<string, unknown>>,
  opts?: CallOpts,
) {
  return callBrain("rank_catholic_source_authority", { sources }, opts);
}
export function resolveAuthorityChain(levels: string[], opts?: CallOpts) {
  return callBrain("resolve_authority_chain", { levels }, opts);
}
export function classifyDocumentAuthority(documentType: string, opts?: CallOpts) {
  return callBrain("classify_document_authority", { document_type: documentType }, opts);
}
export function classifySourceRole(
  input: { url?: string; authorityLevel?: string },
  opts?: CallOpts,
) {
  return callBrain("classify_source_role", input, opts);
}
export function explainAuthorityDecision(chosen: string, over: string[], opts?: CallOpts) {
  return callBrain("explain_authority_decision", { chosen, over }, opts);
}

// ── Claim-level verification ──────────────────────────────────────────
export interface ClaimInput {
  subject?: string;
  predicate: string;
  value: string;
  source?: string;
  authority_level?: string;
  citation?: string;
}
export function extractClaims(
  input: {
    text: string;
    subject?: string;
    source?: string;
    authority_level?: string;
    citation?: string;
  },
  opts?: CallOpts,
) {
  return callBrain("extract_claims", input, opts);
}
export function normalizeClaim(claim: ClaimInput, opts?: CallOpts) {
  return callBrain("normalize_claim", { claim }, opts);
}
export function compareClaims(claims: ClaimInput[], opts?: CallOpts) {
  return callBrain("compare_claims", { claims }, opts);
}
export function detectDateConflict(claims: ClaimInput[], opts?: CallOpts) {
  return callBrain("detect_date_conflict", { claims }, opts);
}
export function detectEntityConflict(claims: ClaimInput[], opts?: CallOpts) {
  return callBrain("detect_entity_conflict", { claims }, opts);
}
export function detectTitleConflict(claims: ClaimInput[], opts?: CallOpts) {
  return callBrain("detect_title_conflict", { claims }, opts);
}
export function detectLiturgicalConflict(claims: ClaimInput[], opts?: CallOpts) {
  return callBrain("detect_liturgical_conflict", { claims }, opts);
}
export function resolveClaimWithAuthority(claims: ClaimInput[], opts?: CallOpts) {
  return callBrain("resolve_claim_with_authority", { claims }, opts);
}
export function buildClaimEvidencePack(
  input: { subject: string; predicate?: string; claims?: ClaimInput[] },
  opts?: CallOpts,
) {
  return callBrain("build_claim_evidence_pack", input, opts);
}

// ── Action simulation ─────────────────────────────────────────────────
export interface SimContext {
  stage_outcomes?: Array<Record<string, unknown>>;
  source_reputation?: Array<Record<string, unknown>>;
  source_fatigue?: Record<string, number>;
  sensitive_content_types?: string[];
}
export function simulateAction(action: Record<string, unknown>, ctx?: SimContext, opts?: CallOpts) {
  return callBrain("simulate_action", { action, ...(ctx ?? {}) }, opts);
}
export function predictActionOutcome(
  action: Record<string, unknown>,
  ctx?: SimContext,
  opts?: CallOpts,
) {
  return callBrain("predict_action_outcome", { action, ...(ctx ?? {}) }, opts);
}
export function estimateFailureModes(
  action: Record<string, unknown>,
  ctx?: SimContext,
  opts?: CallOpts,
) {
  return callBrain("estimate_failure_modes", { action, ...(ctx ?? {}) }, opts);
}
export function estimatePublishRisk(
  action: Record<string, unknown>,
  ctx?: SimContext,
  opts?: CallOpts,
) {
  return callBrain("estimate_publish_risk", { action, ...(ctx ?? {}) }, opts);
}
export function compareCounterfactualActions(
  actions: Array<Record<string, unknown>>,
  ctx?: SimContext,
  opts?: CallOpts,
) {
  return callBrain("compare_counterfactual_actions", { actions, ...(ctx ?? {}) }, opts);
}

// ── Confidence calibration ────────────────────────────────────────────
export interface PredictionRecord {
  op: string;
  predicted: boolean | string;
  actual: boolean | string;
  confidence?: number;
}
export function calibrateConfidence(records: PredictionRecord[], opts?: CallOpts) {
  return callBrain("calibrate_confidence", { records }, opts);
}
export function measurePredictionAccuracy(records: PredictionRecord[], opts?: CallOpts) {
  return callBrain("measure_prediction_accuracy", { records }, opts);
}
export function scoreDecisionQuality(records: PredictionRecord[], opts?: CallOpts) {
  return callBrain("score_decision_quality", { records }, opts);
}
export function gradeBrainDecision(decision: PredictionRecord, opts?: CallOpts) {
  return callBrain("grade_brain_decision", { decision }, opts);
}

// ── Stuckness detection ───────────────────────────────────────────────
export function detectActionLoop(input: Record<string, unknown>, opts?: CallOpts) {
  return callBrain("detect_action_loop", input, opts);
}
export function detectSourceLoop(input: Record<string, unknown>, opts?: CallOpts) {
  return callBrain("detect_source_loop", input, opts);
}
export function detectRepairLoop(input: Record<string, unknown>, opts?: CallOpts) {
  return callBrain("detect_repair_loop", input, opts);
}
export function detectNoGrowth(input: Record<string, unknown>, opts?: CallOpts) {
  return callBrain("detect_no_growth", input, opts);
}
export function explainNoGrowth(input: Record<string, unknown>, opts?: CallOpts) {
  return callBrain("explain_no_growth", input, opts);
}
export function recommendUnblockStrategy(signals: string[], opts?: CallOpts) {
  return callBrain("recommend_unblock_strategy", { signals }, opts);
}

// ── Mission control ───────────────────────────────────────────────────
export function buildMissionTree(goals: Array<Record<string, unknown>>, opts?: CallOpts) {
  return callBrain("build_mission_tree", { goals }, opts);
}
export function updateMissionProgress(
  input: { content_type: string; existing: number; target: number },
  opts?: CallOpts,
) {
  return callBrain("update_mission_progress", input, opts);
}
export function detectMissionBlockers(mission: Record<string, unknown>, opts?: CallOpts) {
  return callBrain("detect_mission_blockers", { mission }, opts);
}
export function rankSubgoals(missions: Array<Record<string, unknown>>, opts?: CallOpts) {
  return callBrain("rank_subgoals", { missions }, opts);
}
export function recommendNextMissionAction(
  input: { mission: Record<string, unknown>; blockers?: string[] },
  opts?: CallOpts,
) {
  return callBrain("recommend_next_mission_action", input, opts);
}

// ── Self-explanation ──────────────────────────────────────────────────
export function explainDecision(decision: Record<string, unknown>, opts?: CallOpts) {
  return callBrain("explain_decision", { decision }, opts);
}
export function explainRejectedAlternatives(
  input: { chosen_score?: number; alternatives: Array<Record<string, unknown>> },
  opts?: CallOpts,
) {
  return callBrain("explain_rejected_alternatives", input, opts);
}
export function explainSafetyGate(input: Record<string, unknown>, opts?: CallOpts) {
  return callBrain("explain_safety_gate", input, opts);
}
export function explainConfidence(
  input: { confidence: number; drivers?: string[] },
  opts?: CallOpts,
) {
  return callBrain("explain_confidence", input, opts);
}
export function explainWhatWouldChangeMyMind(input: Record<string, unknown>, opts?: CallOpts) {
  return callBrain("explain_what_would_change_my_mind", input, opts);
}

// ── Upgrade-request engine ────────────────────────────────────────────
export function rankUpgradeRequests(requests: Array<Record<string, unknown>>, opts?: CallOpts) {
  return callBrain("rank_upgrade_requests", { requests }, opts);
}
export function explainUpgradeRequest(request: Record<string, unknown>, opts?: CallOpts) {
  return callBrain("explain_upgrade_request", { request }, opts);
}
export function mergeDuplicateUpgradeRequests(
  requests: Array<Record<string, unknown>>,
  opts?: CallOpts & { threshold?: number },
) {
  return callBrain(
    "merge_duplicate_upgrade_requests",
    { requests, threshold: opts?.threshold },
    opts,
  );
}
export function detectIgnoredUpgradeRequests(
  requests: Array<Record<string, unknown>>,
  opts?: CallOpts,
) {
  return callBrain("detect_ignored_upgrade_requests", { requests }, opts);
}
export function estimateUpgradeRoi(request: Record<string, unknown>, opts?: CallOpts) {
  return callBrain("estimate_upgrade_roi", { request }, opts);
}

// ── Test-gap detection ────────────────────────────────────────────────
export function detectTestGap(
  input: { failures: Array<Record<string, unknown>>; min_occurrences?: number },
  opts?: CallOpts,
) {
  return callBrain("detect_test_gap", input, opts);
}
export function suggestRegressionTest(failure: string, opts?: CallOpts) {
  return callBrain("suggest_regression_test", { failure }, opts);
}
export function generateTestFixturePlan(failure: string, opts?: CallOpts) {
  return callBrain("generate_test_fixture_plan", { failure }, opts);
}
export function proposeTestPatch(
  input: { failure: string; target_file?: string },
  opts?: CallOpts,
) {
  return callBrain("propose_test_patch", input, opts);
}
export function rankMissingTests(gaps: Array<Record<string, unknown>>, opts?: CallOpts) {
  return callBrain("rank_missing_tests", { gaps }, opts);
}

// ── Specialist reviewers ──────────────────────────────────────────────
export function specialistReviews(candidate: Record<string, unknown>, opts?: CallOpts) {
  return callBrain("specialist_reviews", { candidate }, opts);
}
export function combineSpecialistReviews(reviews: Array<Record<string, unknown>>, opts?: CallOpts) {
  return callBrain("combine_specialist_reviews", { reviews }, opts);
}

// ── Multi-layer memory ────────────────────────────────────────────────
type MemoryList = Array<Record<string, unknown>>;
export function consolidateMemories(memories: MemoryList, opts?: CallOpts) {
  return callBrain("consolidate_memories", { memories }, opts);
}
export function summarizeRepeatedLessons(memories: MemoryList, opts?: CallOpts) {
  return callBrain("summarize_repeated_lessons", { memories }, opts);
}
export function mergeDuplicateMemories(
  memories: MemoryList,
  opts?: CallOpts & { threshold?: number },
) {
  return callBrain("merge_duplicate_memories", { memories, threshold: opts?.threshold }, opts);
}
export function detectConflictingMemories(memories: MemoryList, opts?: CallOpts) {
  return callBrain("detect_conflicting_memories", { memories }, opts);
}
export function retireStaleMemories(
  memories: MemoryList,
  opts?: CallOpts & { maxAgeDays?: number },
) {
  return callBrain("retire_stale_memories", { memories, max_age_days: opts?.maxAgeDays }, opts);
}
export function rankMemoryImportance(memories: MemoryList, opts?: CallOpts) {
  return callBrain("rank_memory_importance", { memories }, opts);
}
export function retrieveContextPack(
  input: { query?: string; memories: MemoryList; k?: number },
  opts?: CallOpts,
) {
  return callBrain("retrieve_context_pack", input, opts);
}
export function extractUpgradeRequestsFromMemory(memories: MemoryList, opts?: CallOpts) {
  return callBrain("extract_upgrade_requests_from_memory", { memories }, opts);
}

// ── Hybrid retrieval ──────────────────────────────────────────────────
export function hybridSearch(
  input: { query?: string; candidates: MemoryList; weights?: Record<string, number>; k?: number },
  opts?: CallOpts,
) {
  return callBrain("hybrid_search", input, opts);
}
export function rankMemoryCandidates(
  input: { query?: string; candidates: MemoryList },
  opts?: CallOpts,
) {
  return callBrain("rank_memory_candidates", input, opts);
}
export function rankSourceCandidates(
  input: { query?: string; candidates: MemoryList },
  opts?: CallOpts,
) {
  return callBrain("rank_source_candidates", input, opts);
}
export function rankRelatedContent(
  input: { query?: string; candidates: MemoryList },
  opts?: CallOpts,
) {
  return callBrain("rank_related_content", input, opts);
}
export function explainRetrievalResult(result: Record<string, unknown>, opts?: CallOpts) {
  return callBrain("explain_retrieval_result", { result }, opts);
}
export function detectMemoryGap(
  input: { query: string; candidates?: MemoryList; min_similarity?: number },
  opts?: CallOpts,
) {
  return callBrain("detect_memory_gap", input, opts);
}

// ── Catholic content extraction ───────────────────────────────────────
export function identifyDocumentType(text: string, opts?: CallOpts) {
  return callBrain("identify_document_type", { text }, opts);
}
export function extractStructuredCatholicDocument(text: string, opts?: CallOpts) {
  return callBrain("extract_structured_catholic_document", { text }, opts);
}
export function extractLiturgicalDate(text: string, opts?: CallOpts) {
  return callBrain("extract_liturgical_date", { text }, opts);
}
export function extractCanonLawReference(text: string, opts?: CallOpts) {
  return callBrain("extract_canon_law_reference", { text }, opts);
}
export function extractCatechismReference(text: string, opts?: CallOpts) {
  return callBrain("extract_catechism_reference", { text }, opts);
}
export function extractPapalDocumentMetadata(text: string, opts?: CallOpts) {
  return callBrain("extract_papal_document_metadata", { text }, opts);
}
export function extractCouncilDocumentMetadata(text: string, opts?: CallOpts) {
  return callBrain("extract_council_document_metadata", { text }, opts);
}
export function extractSaintMetadata(text: string, opts?: CallOpts) {
  return callBrain("extract_saint_metadata", { text }, opts);
}
export function extractParishMetadata(text: string, opts?: CallOpts) {
  return callBrain("extract_parish_metadata", { text }, opts);
}
export function extractPrayerMetadata(text: string, opts?: CallOpts) {
  return callBrain("extract_prayer_metadata", { text }, opts);
}
export function extractNovenaMetadata(text: string, opts?: CallOpts) {
  return callBrain("extract_novena_metadata", { text }, opts);
}
export function extractLitanyMetadata(text: string, opts?: CallOpts) {
  return callBrain("extract_litany_metadata", { text }, opts);
}
export function buildChurchHistoryTimelineEntry(text: string, opts?: CallOpts) {
  return callBrain("build_church_history_timeline_entry", { text }, opts);
}

// ── Review-gated self-improvement (propose only; never auto-deploy) ────
export function proposeCodePatch(
  input: { request: Record<string, unknown>; affected_files?: string[]; approach?: string },
  opts?: CallOpts,
) {
  return callBrain("propose_code_patch", input, opts);
}
export function proposeSchemaMigration(
  input: { change: string; affected_models?: string[]; backfill_required?: boolean },
  opts?: CallOpts,
) {
  return callBrain("propose_schema_migration", input, opts);
}
export function reviewPatchRisk(patch: Record<string, unknown>, opts?: CallOpts) {
  return callBrain("review_patch_risk", { patch }, opts);
}
export function generateRollbackPlan(patch: Record<string, unknown>, opts?: CallOpts) {
  return callBrain("generate_rollback_plan", { patch }, opts);
}
export function explainPatchValue(patch: Record<string, unknown>, opts?: CallOpts) {
  return callBrain("explain_patch_value", { patch }, opts);
}

// ── Replayability & resilience ────────────────────────────────────────
export function replayDecision(
  input: { chosen_stage: string; candidates: Array<Record<string, unknown>> },
  opts?: CallOpts,
) {
  return callBrain("replay_decision", input, opts);
}
export function compareDecisions(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  opts?: CallOpts,
) {
  return callBrain("compare_decisions", { a, b }, opts);
}
export function explainDecisionChange(
  input: {
    previous: Record<string, unknown>;
    current: Record<string, unknown>;
    world_changes?: string[];
  },
  opts?: CallOpts,
) {
  return callBrain("explain_decision_change", input, opts);
}
export function detectDecisionDrift(decisions: Array<Record<string, unknown>>, opts?: CallOpts) {
  return callBrain("detect_decision_drift", { decisions }, opts);
}
export function recommendCircuitBreak(
  input: {
    scope: "host" | "stage" | "content_type";
    key: string;
    attempts: number;
    failures: number;
    consecutive_failures?: number;
  },
  opts?: CallOpts,
) {
  return callBrain("recommend_circuit_break", input, opts);
}
export function checkReplayIntegrity(records: Array<Record<string, unknown>>, opts?: CallOpts) {
  return callBrain("check_replay_integrity", { records }, opts);
}

export type { BrainEnvelope };
