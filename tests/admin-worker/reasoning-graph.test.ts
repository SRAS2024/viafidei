/**
 * Worker reasoning graph (spec §23-45). Proves edges are recorded with
 * a "why" explanation, that the chain can be walked for one content
 * item, and that recent chains can be listed for the admin pick-list.
 */

import { describe, expect, it, vi } from "vitest";

import {
  recordReasoningEdge,
  recordReasoningEdges,
  getReasoningChain,
  listReasoningChains,
} from "@/lib/admin-worker/reasoning-graph";

describe("recordReasoningEdge (spec §39-45)", () => {
  it("persists an edge with from/to nodes, relation, and explanation", async () => {
    let created: { data: Record<string, unknown> } | null = null;
    const prisma = {
      adminWorkerReasoningGraph: {
        create: vi.fn(async (args: { data: Record<string, unknown> }) => {
          created = args;
          return { id: "edge-1" };
        }),
      },
    } as unknown as Parameters<typeof recordReasoningEdge>[0];

    await recordReasoningEdge(prisma, {
      pipelineKey: "PRAYER:our-father",
      contentType: "PRAYER",
      from: { type: "CANDIDATE_URL", id: "c-1", label: "our-father" },
      to: { type: "SOURCE_REPUTATION", label: "vatican.va" },
      relation: "SELECTED_BECAUSE",
      explanation: "candidate selected because source reputation was high",
      confidence: 0.9,
    });

    expect(created).not.toBeNull();
    const data = (created as unknown as { data: Record<string, unknown> }).data;
    expect(data.fromNodeType).toBe("CANDIDATE_URL");
    expect(data.toNodeType).toBe("SOURCE_REPUTATION");
    expect(data.relation).toBe("SELECTED_BECAUSE");
    expect(data.explanation).toContain("source reputation was high");
    expect(data.pipelineKey).toBe("PRAYER:our-father");
  });

  it("never throws when the write fails (best-effort)", async () => {
    const prisma = {
      adminWorkerReasoningGraph: {
        create: vi.fn(async () => {
          throw new Error("db down");
        }),
      },
    } as unknown as Parameters<typeof recordReasoningEdge>[0];
    await expect(
      recordReasoningEdge(prisma, {
        from: { type: "CONTENT_GOAL" },
        to: { type: "CANDIDATE_URL" },
        relation: "LED_TO",
        explanation: "x",
      }),
    ).resolves.toBeUndefined();
  });

  it("records several edges in sequence", async () => {
    const create = vi.fn(async () => ({ id: "e" }));
    const prisma = {
      adminWorkerReasoningGraph: { create },
    } as unknown as Parameters<typeof recordReasoningEdges>[0];
    await recordReasoningEdges(prisma, [
      {
        from: { type: "SOURCE_READ" },
        to: { type: "SOURCE_BLOCK" },
        relation: "PRODUCED",
        explanation: "read produced blocks",
      },
      {
        from: { type: "PACKAGE_ARTIFACT" },
        to: { type: "STRICT_QA" },
        relation: "VERIFIED_BY",
        explanation: "artifact verified by strict QA",
      },
    ]);
    expect(create).toHaveBeenCalledTimes(2);
  });
});

describe("getReasoningChain (spec §47)", () => {
  it("walks edges for a content item and de-dupes nodes", async () => {
    const prisma = {
      adminWorkerReasoningGraph: {
        findMany: vi.fn(async () => [
          {
            id: "e1",
            fromNodeType: "CONTENT_GOAL",
            fromNodeId: "g1",
            fromNodeLabel: "PRAYER goal",
            toNodeType: "CANDIDATE_URL",
            toNodeId: "c1",
            toNodeLabel: "our-father",
            relation: "LED_TO",
            explanation: "goal needed prayers",
            confidence: 0.7,
            createdAt: new Date("2026-01-01T00:00:00Z"),
          },
          {
            id: "e2",
            fromNodeType: "CANDIDATE_URL",
            fromNodeId: "c1",
            fromNodeLabel: "our-father",
            toNodeType: "PUBLISHED_CONTENT",
            toNodeId: "p1",
            toNodeLabel: "our-father",
            relation: "PUBLISH_ALLOWED_BECAUSE",
            explanation: "strict QA + quality passed",
            confidence: 0.95,
            createdAt: new Date("2026-01-01T01:00:00Z"),
          },
        ]),
      },
    } as unknown as Parameters<typeof getReasoningChain>[0];

    const chain = await getReasoningChain(prisma, { pipelineKey: "PRAYER:our-father" });
    expect(chain.edges).toHaveLength(2);
    expect(chain.edges[1].relation).toBe("PUBLISH_ALLOWED_BECAUSE");
    // CONTENT_GOAL + CANDIDATE_URL + PUBLISHED_CONTENT = 3 distinct nodes
    expect(chain.nodes).toHaveLength(3);
  });
});

describe("listReasoningChains (admin pick-list)", () => {
  it("groups edges by pipelineKey and counts them", async () => {
    const prisma = {
      adminWorkerReasoningGraph: {
        findMany: vi.fn(async () => [
          {
            pipelineKey: "PRAYER:a",
            contentType: "PRAYER",
            contentId: null,
            toNodeLabel: "a",
            fromNodeLabel: null,
            createdAt: new Date("2026-01-02T00:00:00Z"),
          },
          {
            pipelineKey: "PRAYER:a",
            contentType: "PRAYER",
            contentId: null,
            toNodeLabel: "a",
            fromNodeLabel: null,
            createdAt: new Date("2026-01-02T01:00:00Z"),
          },
          {
            pipelineKey: "SAINT:b",
            contentType: "SAINT",
            contentId: null,
            toNodeLabel: "b",
            fromNodeLabel: null,
            createdAt: new Date("2026-01-01T00:00:00Z"),
          },
        ]),
      },
    } as unknown as Parameters<typeof listReasoningChains>[0];

    const chains = await listReasoningChains(prisma);
    expect(chains).toHaveLength(2);
    // Most recent first.
    expect(chains[0].pipelineKey).toBe("PRAYER:a");
    expect(chains[0].edgeCount).toBe(2);
  });
});
