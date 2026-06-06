/**
 * Persistence helpers for the intelligence tables. TypeScript owns every
 * write to Postgres (the spec's "database writer / Prisma layer"); the
 * Python brain never touches the DB. These helpers are all best-effort
 * for the audit/embedding paths — recording intelligence must never break
 * a worker pass — and strict where correctness matters (graph upserts).
 */

import { createHash } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

import type { BrainEnvelope, DeveloperRequest } from "./contracts";

export interface BrainCallContext {
  entityType?: string | null;
  entityId?: string | null;
  contentType?: string | null;
  passId?: string | null;
  decisionId?: string | null;
}

/** Persist a brain call to the audit trail. Never throws. */
export async function recordBrainCall(
  prisma: PrismaClient,
  op: string,
  env: BrainEnvelope | null,
  ctx: BrainCallContext = {},
): Promise<string | null> {
  if (!env) return null;
  try {
    const row = await prisma.adminWorkerBrainCall.create({
      data: {
        op,
        ok: env.ok,
        confidence: env.confidence,
        riskLevel: env.riskLevel,
        recommendedNextAction: env.recommendedNextAction || null,
        safeToAutoExecute: env.safeToAutoExecute,
        reasoning: env.reasoning || null,
        evidence: env.evidence.slice(0, 50),
        sourcesUsed: env.sourcesUsed.slice(0, 50),
        entityType: ctx.entityType ?? null,
        entityId: ctx.entityId ?? null,
        contentType: ctx.contentType ?? null,
        passId: ctx.passId ?? null,
        decisionId: ctx.decisionId ?? null,
        elapsedMs: env.elapsedMs,
        error: env.error,
      },
      select: { id: true },
    });
    return row.id;
  } catch {
    return null;
  }
}

// ── Embeddings / vector store ─────────────────────────────────────────
export interface EmbeddingInput {
  entityType: string;
  entityId: string;
  embeddingJson: string;
  dims?: number;
  model?: string;
  contentType?: string | null;
  title?: string | null;
  textSnapshot?: string | null;
  contentHash?: string | null;
}

export function contentHashOf(text: string): string {
  return createHash("sha1").update(text).digest("hex");
}

/** Upsert a single embedding row (unique by entityType+entityId+model). */
export async function upsertEmbedding(prisma: PrismaClient, input: EmbeddingInput) {
  const model = input.model ?? "hash-v1";
  const data = {
    contentType: input.contentType ?? null,
    title: input.title ?? null,
    textSnapshot: input.textSnapshot ?? null,
    embeddingJson: input.embeddingJson,
    dims: input.dims ?? 512,
    contentHash: input.contentHash ?? null,
  };
  return prisma.adminWorkerEmbedding.upsert({
    where: {
      entityType_entityId_model: { entityType: input.entityType, entityId: input.entityId, model },
    },
    create: { entityType: input.entityType, entityId: input.entityId, model, ...data },
    update: data,
  });
}

/**
 * Load stored embeddings of one entity type as semantic-search candidates
 * for the Python brain (it accepts `embedding_json` directly, so no
 * re-embedding is needed).
 */
export async function loadEmbeddingCandidates(
  prisma: PrismaClient,
  entityType: string,
  opts: { excludeEntityId?: string; limit?: number; model?: string } = {},
): Promise<Array<{ id: string; text: string; title: string | null; embedding_json: string }>> {
  const rows = await prisma.adminWorkerEmbedding.findMany({
    where: {
      entityType,
      model: opts.model ?? "hash-v1",
      ...(opts.excludeEntityId ? { entityId: { not: opts.excludeEntityId } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: opts.limit ?? 500,
    select: { entityId: true, title: true, textSnapshot: true, embeddingJson: true },
  });
  return rows.map((r) => ({
    id: r.entityId,
    title: r.title,
    text: r.textSnapshot ?? r.title ?? "",
    embedding_json: r.embeddingJson,
  }));
}

// ── Developer requests ────────────────────────────────────────────────
export function devRequestFingerprint(kind: string, title: string): string {
  return createHash("sha1").update(`${kind}|${title}`.toLowerCase()).digest("hex");
}

/** Upsert a developer request, bumping `occurrences` on repeats. */
export async function upsertDeveloperRequest(
  prisma: PrismaClient,
  req: DeveloperRequest,
  source?: string,
): Promise<{ id: string; created: boolean } | null> {
  const fingerprint = devRequestFingerprint(req.kind, req.title);
  try {
    const existing = await prisma.adminWorkerDeveloperRequest.findUnique({
      where: { fingerprint },
      select: { id: true },
    });
    if (existing) {
      await prisma.adminWorkerDeveloperRequest.update({
        where: { fingerprint },
        data: {
          detail: req.detail,
          severity: req.severity,
          evidence: req.evidence,
          occurrences: { increment: 1 },
          // re-open if it had been resolved but is recurring
          status: "OPEN",
          resolvedAt: null,
        },
      });
      return { id: existing.id, created: false };
    }
    const row = await prisma.adminWorkerDeveloperRequest.create({
      data: {
        kind: req.kind,
        title: req.title,
        detail: req.detail,
        severity: req.severity,
        evidence: req.evidence,
        source: source ?? null,
        fingerprint,
      },
      select: { id: true },
    });
    return { id: row.id, created: true };
  } catch {
    return null;
  }
}

export async function recordDeveloperRequests(
  prisma: PrismaClient,
  requests: DeveloperRequest[],
  source?: string,
): Promise<{ created: number; bumped: number }> {
  let created = 0;
  let bumped = 0;
  for (const req of requests) {
    const res = await upsertDeveloperRequest(prisma, req, source);
    if (res?.created) created += 1;
    else if (res) bumped += 1;
  }
  return { created, bumped };
}

// ── Knowledge graph ───────────────────────────────────────────────────
export interface GraphNodeInput {
  nodeType: string;
  entityType?: string | null;
  entityId?: string | null;
  label: string;
  embeddingJson?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** Upsert a graph node, deduping ENTITY nodes by (nodeType, entityType, entityId). */
export async function upsertGraphNode(prisma: PrismaClient, node: GraphNodeInput): Promise<string> {
  const metadata = (node.metadata ?? undefined) as never;
  if (node.entityType && node.entityId) {
    const row = await prisma.adminWorkerGraphNode.upsert({
      where: {
        nodeType_entityType_entityId: {
          nodeType: node.nodeType,
          entityType: node.entityType,
          entityId: node.entityId,
        },
      },
      create: {
        nodeType: node.nodeType,
        entityType: node.entityType,
        entityId: node.entityId,
        label: node.label,
        embeddingJson: node.embeddingJson ?? null,
        metadata,
      },
      update: { label: node.label, embeddingJson: node.embeddingJson ?? undefined, metadata },
      select: { id: true },
    });
    return row.id;
  }
  // Concept/abstract nodes (null entity) can't use the compound unique
  // (Postgres treats NULLs as distinct), so dedupe by (nodeType, label).
  const existing = await prisma.adminWorkerGraphNode.findFirst({
    where: { nodeType: node.nodeType, label: node.label, entityType: null, entityId: null },
    select: { id: true },
  });
  if (existing) return existing.id;
  const row = await prisma.adminWorkerGraphNode.create({
    data: {
      nodeType: node.nodeType,
      label: node.label,
      embeddingJson: node.embeddingJson ?? null,
      metadata,
    },
    select: { id: true },
  });
  return row.id;
}

export interface GraphEdgeInput {
  fromNodeId: string;
  toNodeId: string;
  edgeType: string;
  weight?: number;
  confidence?: number;
  status?: string;
  source?: string;
  explanation?: string;
}

/** Upsert a graph edge (unique by from+to+type). */
export async function upsertGraphEdge(prisma: PrismaClient, edge: GraphEdgeInput): Promise<string> {
  const row = await prisma.adminWorkerGraphEdge.upsert({
    where: {
      fromNodeId_toNodeId_edgeType: {
        fromNodeId: edge.fromNodeId,
        toNodeId: edge.toNodeId,
        edgeType: edge.edgeType,
      },
    },
    create: {
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      edgeType: edge.edgeType,
      weight: edge.weight ?? 1,
      confidence: edge.confidence ?? 0,
      status: edge.status ?? "PROPOSED",
      source: edge.source ?? null,
      explanation: edge.explanation ?? null,
    },
    update: {
      weight: edge.weight ?? undefined,
      confidence: edge.confidence ?? undefined,
      explanation: edge.explanation ?? undefined,
    },
    select: { id: true },
  });
  return row.id;
}

/** Load the graph (or a slice) in the shape the Python `analyze_graph` op expects. */
export async function loadSubgraph(
  prisma: PrismaClient,
  opts: { limitNodes?: number } = {},
): Promise<{
  nodes: Array<{ id: string; type: string; label: string }>;
  edges: Array<{ source: string; target: string; type: string }>;
}> {
  const nodes = await prisma.adminWorkerGraphNode.findMany({
    take: opts.limitNodes ?? 1000,
    orderBy: { updatedAt: "desc" },
    select: { id: true, nodeType: true, label: true },
  });
  const ids = new Set(nodes.map((n) => n.id));
  const edges = await prisma.adminWorkerGraphEdge.findMany({
    where: { fromNodeId: { in: [...ids] }, toNodeId: { in: [...ids] } },
    select: { fromNodeId: true, toNodeId: true, edgeType: true },
  });
  return {
    nodes: nodes.map((n) => ({ id: n.id, type: n.nodeType, label: n.label })),
    edges: edges.map((e) => ({ source: e.fromNodeId, target: e.toNodeId, type: e.edgeType })),
  };
}
