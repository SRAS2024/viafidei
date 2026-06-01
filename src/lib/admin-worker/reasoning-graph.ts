/**
 * Worker reasoning graph (spec §23-45).
 *
 * A directed "why" graph. Each edge connects two pipeline entities and
 * carries a human-readable explanation of *why* one led to the other.
 * The worker records an edge for every important decision so nothing it
 * does is unexplainable later (spec §48). The Worker Reasoning admin
 * view (`/admin/admin-worker/reasoning`) walks these edges to show the
 * full chain for any content item.
 *
 * Hard rules (consistent with the rest of the Admin Worker):
 *   - Writes are best-effort: a failed edge write never breaks a pass.
 *   - The graph records reasoning, it never *drives* a decision — the
 *     brain + gates remain the only deciders. This is the audit trail.
 */

import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * The entities the reasoning graph connects (spec §26-38). Kept as a
 * string union (not a DB enum) so new node kinds can be added without a
 * migration and so the module stays testable without Prisma.
 */
export type ReasoningNodeType =
  | "CONTENT_GOAL"
  | "CANDIDATE_URL"
  | "SOURCE_READ"
  | "SOURCE_BLOCK"
  | "PACKAGE_ARTIFACT"
  | "VALIDATION_EVIDENCE"
  | "STRICT_QA"
  | "QUALITY_SCORE"
  | "PUBLISHED_CONTENT"
  | "POST_PUBLISH_RESULT"
  | "SEARCH_RESULT"
  | "SITEMAP_RESULT"
  | "CACHE_RESULT"
  | "REPAIR_PLAN"
  | "MEMORY_OUTCOME"
  | "SOURCE_REPUTATION"
  | "BRAIN_DECISION"
  | "ACTION";

/**
 * The relationship an edge expresses (spec §39-45). These read as
 * "<from> <relation> <to>" with the explanation filling in the rest,
 * e.g. CANDIDATE_URL —SELECTED_BECAUSE→ SOURCE_REPUTATION
 * ("candidate selected because source reputation was high").
 */
export type ReasoningRelation =
  | "SELECTED_BECAUSE"
  | "REJECTED_BECAUSE"
  | "PAUSED_BECAUSE"
  | "REPAIR_SELECTED_BECAUSE"
  | "PUBLISH_ALLOWED_BECAUSE"
  | "PUBLISH_BLOCKED_BECAUSE"
  | "PRODUCED"
  | "LED_TO"
  | "VERIFIED_BY"
  | "BLOCKED_BY"
  | "ADVANCED_TO"
  | "LEARNED_FROM"
  | "PROMOTED_BECAUSE"
  | "DEPRIORITIZED_BECAUSE";

export interface ReasoningNodeRef {
  type: ReasoningNodeType;
  id?: string | null;
  label?: string | null;
}

export interface ReasoningEdgeInput {
  /** Stable per-item key so the whole chain for one content item joins. */
  pipelineKey?: string | null;
  contentType?: string | null;
  contentId?: string | null;
  from: ReasoningNodeRef;
  to: ReasoningNodeRef;
  relation: ReasoningRelation;
  /** Why this edge exists — surfaced verbatim in the admin view. */
  explanation: string;
  confidence?: number;
  passId?: string | null;
  decisionId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Record a single reasoning edge. Best-effort: never throws, so a
 * reasoning write can be dropped into any pipeline stage without
 * guarding the call site.
 */
export async function recordReasoningEdge(
  prisma: PrismaClient,
  edge: ReasoningEdgeInput,
): Promise<void> {
  await prisma.adminWorkerReasoningGraph
    .create({
      data: {
        pipelineKey: edge.pipelineKey ?? null,
        contentType: edge.contentType ?? null,
        contentId: edge.contentId ?? null,
        fromNodeType: edge.from.type,
        fromNodeId: edge.from.id ?? null,
        fromNodeLabel: edge.from.label ?? null,
        toNodeType: edge.to.type,
        toNodeId: edge.to.id ?? null,
        toNodeLabel: edge.to.label ?? null,
        relation: edge.relation,
        explanation: edge.explanation,
        confidence: edge.confidence ?? 0,
        passId: edge.passId ?? null,
        decisionId: edge.decisionId ?? null,
        metadata: edge.metadata,
      },
    })
    .catch(() => undefined);
}

/** Record several edges in one shot (best-effort). */
export async function recordReasoningEdges(
  prisma: PrismaClient,
  edges: ReasoningEdgeInput[],
): Promise<void> {
  for (const edge of edges) {
    await recordReasoningEdge(prisma, edge);
  }
}

export interface ReasoningChainNode {
  type: ReasoningNodeType;
  id: string | null;
  label: string | null;
}

export interface ReasoningChainEdge {
  id: string;
  from: ReasoningChainNode;
  to: ReasoningChainNode;
  relation: string;
  explanation: string;
  confidence: number;
  createdAt: Date;
}

export interface ReasoningChain {
  pipelineKey: string | null;
  contentType: string | null;
  contentId: string | null;
  edges: ReasoningChainEdge[];
  nodes: ReasoningChainNode[];
}

/**
 * Walk the reasoning graph for one content item (spec §47). Joins on
 * pipelineKey when supplied (the canonical per-item key) and otherwise
 * falls back to (contentType, contentId). Returns the ordered edges +
 * the distinct nodes so the admin view can render the chain.
 */
export async function getReasoningChain(
  prisma: PrismaClient,
  query: { pipelineKey?: string | null; contentType?: string | null; contentId?: string | null },
  opts: { limit?: number } = {},
): Promise<ReasoningChain> {
  const where: Prisma.AdminWorkerReasoningGraphWhereInput = query.pipelineKey
    ? { pipelineKey: query.pipelineKey }
    : {
        ...(query.contentType ? { contentType: query.contentType } : {}),
        ...(query.contentId ? { contentId: query.contentId } : {}),
      };

  const rows = await prisma.adminWorkerReasoningGraph
    .findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: opts.limit ?? 500,
    })
    .catch(() => [] as Array<Record<string, unknown>>);

  const edges: ReasoningChainEdge[] = rows.map((r) => {
    const row = r as {
      id: string;
      fromNodeType: string;
      fromNodeId: string | null;
      fromNodeLabel: string | null;
      toNodeType: string;
      toNodeId: string | null;
      toNodeLabel: string | null;
      relation: string;
      explanation: string;
      confidence: number;
      createdAt: Date;
    };
    return {
      id: row.id,
      from: {
        type: row.fromNodeType as ReasoningNodeType,
        id: row.fromNodeId,
        label: row.fromNodeLabel,
      },
      to: {
        type: row.toNodeType as ReasoningNodeType,
        id: row.toNodeId,
        label: row.toNodeLabel,
      },
      relation: row.relation,
      explanation: row.explanation,
      confidence: row.confidence,
      createdAt: row.createdAt,
    };
  });

  // De-dupe the nodes the edges reference so the view can render a
  // node list alongside the edge list.
  const nodeKey = (n: ReasoningChainNode) => `${n.type}:${n.id ?? n.label ?? ""}`;
  const nodeMap = new Map<string, ReasoningChainNode>();
  for (const e of edges) {
    nodeMap.set(nodeKey(e.from), e.from);
    nodeMap.set(nodeKey(e.to), e.to);
  }

  return {
    pipelineKey: query.pipelineKey ?? null,
    contentType: query.contentType ?? null,
    contentId: query.contentId ?? null,
    edges,
    nodes: [...nodeMap.values()],
  };
}

/**
 * List the most recent content items that have a reasoning chain, so
 * the Worker Reasoning view can offer a pick-list without the operator
 * having to know a pipelineKey. Groups by pipelineKey (preferred) and
 * surfaces the content type + a representative label + edge count.
 */
export async function listReasoningChains(
  prisma: PrismaClient,
  opts: { limit?: number } = {},
): Promise<
  Array<{
    pipelineKey: string | null;
    contentType: string | null;
    contentId: string | null;
    label: string | null;
    edgeCount: number;
    lastActivity: Date;
  }>
> {
  const rows = await prisma.adminWorkerReasoningGraph
    .findMany({
      orderBy: { createdAt: "desc" },
      take: (opts.limit ?? 25) * 20,
      select: {
        pipelineKey: true,
        contentType: true,
        contentId: true,
        toNodeLabel: true,
        fromNodeLabel: true,
        createdAt: true,
      },
    })
    .catch(
      () =>
        [] as Array<{
          pipelineKey: string | null;
          contentType: string | null;
          contentId: string | null;
          toNodeLabel: string | null;
          fromNodeLabel: string | null;
          createdAt: Date;
        }>,
    );

  const grouped = new Map<
    string,
    {
      pipelineKey: string | null;
      contentType: string | null;
      contentId: string | null;
      label: string | null;
      edgeCount: number;
      lastActivity: Date;
    }
  >();
  for (const r of rows) {
    const key = r.pipelineKey ?? `${r.contentType ?? ""}:${r.contentId ?? ""}`;
    if (!key || key === ":") continue;
    const existing = grouped.get(key);
    if (existing) {
      existing.edgeCount += 1;
      if (r.createdAt > existing.lastActivity) existing.lastActivity = r.createdAt;
      if (!existing.label) existing.label = r.toNodeLabel ?? r.fromNodeLabel ?? null;
    } else {
      grouped.set(key, {
        pipelineKey: r.pipelineKey,
        contentType: r.contentType,
        contentId: r.contentId,
        label: r.toNodeLabel ?? r.fromNodeLabel ?? null,
        edgeCount: 1,
        lastActivity: r.createdAt,
      });
    }
  }

  return [...grouped.values()]
    .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime())
    .slice(0, opts.limit ?? 25);
}
