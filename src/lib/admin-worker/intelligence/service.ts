/**
 * Worker-facing intelligence service.
 *
 * These are the functions the Admin Worker (dispatcher, publish/repair
 * orchestrators, report generator, custody jobs) call. Each one:
 *   1. calls the typed brain wrapper,
 *   2. records the call to the AdminWorkerBrainCall audit trail,
 *   3. persists any durable output (embeddings, developer requests), and
 *   4. returns a fallback-safe shape — `available: false` when the brain
 *      is offline, so the caller keeps its existing deterministic path.
 *
 * Policy stays in TypeScript: these helpers surface the brain's scores and
 * recommendations; the publish/policy gates decide what actually happens.
 */

import type { PrismaClient } from "@prisma/client";

import type {
  BrainEnvelope,
  CommunionRiskResult,
  DuplicateResult,
  IqResult,
  QualityResult,
  SelfInspectResult,
  SemanticSearchResult,
  SourceAssessmentResult,
} from "./contracts";
import {
  assessSource,
  detectCommunionRisk,
  detectDuplicates,
  embed,
  iqMetrics,
  scoreQuality,
  selfInspect,
  semanticSearch,
  type DuplicateRecord,
  type QualityRecord,
  type SourceInput,
} from "./index";
import {
  BrainCallContext,
  contentHashOf,
  loadEmbeddingCandidates,
  recordBrainCall,
  recordDeveloperRequests,
  upsertEmbedding,
} from "./store";

/** Communion-risk threshold above which TypeScript blocks auto-publish. */
export const COMMUNION_BLOCK_THRESHOLD = 0.6;
/** Communion-risk threshold above which content is drafted + escalated. */
export const COMMUNION_ESCALATE_THRESHOLD = 0.35;

export interface CommunionScreen {
  available: boolean;
  block: boolean;
  escalate: boolean;
  risk: number;
  verdict: string | null;
  flags: string[];
  envelope: BrainEnvelope<CommunionRiskResult> | null;
}

/**
 * Screen a source/institution for possible non-communion-with-Rome. This
 * is a verification flag, not a canonical ruling — TypeScript decides the
 * gate using the thresholds above.
 */
export async function screenCommunionRisk(
  prisma: PrismaClient,
  input: { name?: string; description?: string; text?: string; url?: string },
  ctx: BrainCallContext = {},
): Promise<CommunionScreen> {
  const env = await detectCommunionRisk(input, {
    cacheKey: `communion:${input.url ?? ""}:${input.name ?? ""}`,
    cacheTtlMs: 5 * 60_000,
  });
  await recordBrainCall(prisma, "detect_communion_risk", env, ctx);
  if (!env || !env.ok || !env.result) {
    return {
      available: false,
      block: false,
      escalate: false,
      risk: 0,
      verdict: null,
      flags: [],
      envelope: env,
    };
  }
  const risk = env.result.communion_risk;
  return {
    available: true,
    block: risk >= COMMUNION_BLOCK_THRESHOLD,
    escalate: risk >= COMMUNION_ESCALATE_THRESHOLD,
    risk,
    verdict: env.result.verdict,
    flags: env.result.flags,
    envelope: env,
  };
}

export interface DuplicateCheck {
  available: boolean;
  isDuplicate: boolean;
  bestMatchId: string | null;
  bestScore: number;
  envelope: BrainEnvelope<DuplicateResult> | null;
}

export async function checkDuplicate(
  prisma: PrismaClient,
  target: DuplicateRecord,
  candidates: DuplicateRecord[],
  ctx: BrainCallContext = {},
  opts: { duplicateThreshold?: number } = {},
): Promise<DuplicateCheck> {
  if (candidates.length === 0) {
    return { available: true, isDuplicate: false, bestMatchId: null, bestScore: 0, envelope: null };
  }
  const env = await detectDuplicates(target, candidates, opts);
  await recordBrainCall(prisma, "detect_duplicates", env, ctx);
  if (!env || !env.ok || !env.result) {
    return { available: false, isDuplicate: false, bestMatchId: null, bestScore: 0, envelope: env };
  }
  return {
    available: true,
    isDuplicate: env.result.is_duplicate,
    bestMatchId: env.result.best_match?.id ?? null,
    bestScore: env.result.best_match?.score ?? 0,
    envelope: env,
  };
}

export interface QualityScore {
  available: boolean;
  overall: number;
  publishGatesFailed: string[];
  recommendedAction: string;
  envelope: BrainEnvelope<QualityResult> | null;
}

export async function scoreRecordQuality(
  prisma: PrismaClient,
  record: QualityRecord,
  ctx: BrainCallContext = {},
): Promise<QualityScore> {
  const env = await scoreQuality(record);
  await recordBrainCall(prisma, "score_quality", env, ctx);
  if (!env || !env.ok || !env.result) {
    return {
      available: false,
      overall: 0,
      publishGatesFailed: [],
      recommendedAction: "",
      envelope: env,
    };
  }
  return {
    available: true,
    overall: env.result.overall,
    publishGatesFailed: env.result.publish_gates_failed,
    recommendedAction: env.recommendedNextAction,
    envelope: env,
  };
}

export interface SourceIntel {
  available: boolean;
  tier: string | null;
  overall: number;
  block: boolean;
  envelope: BrainEnvelope<SourceAssessmentResult> | null;
}

export async function assessSourceIntel(
  prisma: PrismaClient,
  source: SourceInput,
  ctx: BrainCallContext = {},
): Promise<SourceIntel> {
  const env = await assessSource(source, {
    cacheKey: `source:${source.url ?? source.name ?? ""}`,
    cacheTtlMs: 5 * 60_000,
  });
  await recordBrainCall(prisma, "assess_source", env, ctx);
  if (!env || !env.ok || !env.result) {
    return { available: false, tier: null, overall: 0, block: false, envelope: env };
  }
  return {
    available: true,
    tier: env.result.tier,
    overall: env.result.overall_score,
    block: env.result.tier === "BLOCKED",
    envelope: env,
  };
}

export interface InspectionResult {
  available: boolean;
  report: SelfInspectResult | null;
  persisted: { created: number; bumped: number };
  envelope: BrainEnvelope<SelfInspectResult> | null;
}

/** Self-inspect a run and persist the resulting developer requests. */
export async function inspectAndRecordRequests(
  prisma: PrismaClient,
  input: {
    failures?: unknown[];
    blocked?: unknown[];
    jobs?: unknown[];
    logs?: unknown[];
    metrics?: Record<string, unknown>;
  },
  ctx: BrainCallContext = {},
): Promise<InspectionResult> {
  const env = await selfInspect(input);
  await recordBrainCall(prisma, "self_inspect", env, ctx);
  if (!env || !env.ok || !env.result) {
    return { available: false, report: null, persisted: { created: 0, bumped: 0 }, envelope: env };
  }
  const persisted = await recordDeveloperRequests(
    prisma,
    env.result.developer_requests,
    "self_inspect",
  );
  return { available: true, report: env.result, persisted, envelope: env };
}

export async function computeIqMetrics(
  prisma: PrismaClient,
  stats: Record<string, number>,
  ctx: BrainCallContext = {},
): Promise<{
  available: boolean;
  metrics: IqResult["metrics"] | null;
  envelope: BrainEnvelope<IqResult> | null;
}> {
  const env = await iqMetrics(stats);
  await recordBrainCall(prisma, "iq_metrics", env, ctx);
  if (!env || !env.ok || !env.result) return { available: false, metrics: null, envelope: env };
  return { available: true, metrics: env.result.metrics, envelope: env };
}

/** Embed records and persist their vectors for later semantic search. */
export async function embedAndStore(
  prisma: PrismaClient,
  entityType: string,
  items: Array<{ id: string; text: string; title?: string | null; contentType?: string | null }>,
): Promise<{ available: boolean; stored: number }> {
  if (items.length === 0) return { available: true, stored: 0 };
  const env = await embed(
    items.map((i) => ({ id: i.id, text: i.text, title: i.title ?? undefined })),
  );
  if (!env || !env.ok || !env.result) return { available: false, stored: 0 };
  let stored = 0;
  const vectors = env.result.vectors;
  for (let i = 0; i < vectors.length; i++) {
    const v = vectors[i];
    const src = items[i];
    if (!v.id || !src) continue;
    await upsertEmbedding(prisma, {
      entityType,
      entityId: String(v.id),
      embeddingJson: v.embedding_json,
      dims: v.dims,
      contentType: src.contentType ?? null,
      title: src.title ?? null,
      textSnapshot: src.text.slice(0, 4000),
      contentHash: contentHashOf(src.text),
    });
    stored += 1;
  }
  return { available: true, stored };
}

/** Find records related to a query via the stored vector memory. */
export async function findRelated(
  prisma: PrismaClient,
  entityType: string,
  query: string,
  opts: { excludeEntityId?: string; limit?: number; k?: number } = {},
  ctx: BrainCallContext = {},
): Promise<{
  available: boolean;
  matches: SemanticSearchResult["matches"];
  envelope: BrainEnvelope<SemanticSearchResult> | null;
}> {
  const candidates = await loadEmbeddingCandidates(prisma, entityType, {
    excludeEntityId: opts.excludeEntityId,
    limit: opts.limit,
  });
  if (candidates.length === 0) return { available: true, matches: [], envelope: null };
  // semanticSearch ranks on the precomputed embedding_json; title (which may
  // be null in the store) isn't needed and would clash with the optional type.
  const env = await semanticSearch(
    query,
    candidates.map((c) => ({ id: c.id, text: c.text, embedding_json: c.embedding_json })),
    { k: opts.k },
  );
  await recordBrainCall(prisma, "semantic_search", env, ctx);
  if (!env || !env.ok || !env.result) return { available: false, matches: [], envelope: env };
  return { available: true, matches: env.result.matches, envelope: env };
}
