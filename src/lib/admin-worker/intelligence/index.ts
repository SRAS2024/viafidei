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
  CodeAnalysisResult,
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
  actionHistory?: Array<{ missionStage: string }>;
  sourceReputation?: Array<{ host: string; tier: string }>;
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

export interface CodeFileSummary {
  path: string;
  lines: number;
}
export function analyzeCode(
  files: CodeFileSummary[],
  opts?: CallOpts & { oversizedThreshold?: number; largeThreshold?: number },
) {
  return callBrain<CodeAnalysisResult>(
    "analyze_code",
    {
      files,
      oversized_threshold: opts?.oversizedThreshold,
      large_threshold: opts?.largeThreshold,
    },
    opts,
  );
}

export type { BrainEnvelope };
