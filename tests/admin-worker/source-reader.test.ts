/**
 * AdminWorkerSourceReader (spec §6). Proves the orchestrator wires
 * stripJunk → classify → extract → persist source-read + pipeline
 * stage + memory.
 */

import { describe, expect, it, vi } from "vitest";

import { readSource } from "@/lib/admin-worker/source-reader";

interface MockOpts {
  upsertReused?: boolean;
}

function makePrisma(opts: MockOpts = {}) {
  const memoryUpsert = vi.fn(async () => ({}));
  const memoryFindUnique = vi.fn(async () => null);
  return {
    adminWorkerSourceRead: {
      findUnique: vi.fn(async () =>
        opts.upsertReused ? { id: "existing", checksum: "abc" } : null,
      ),
      create: vi.fn(async () => ({ id: "new", checksum: "newhash" })),
      update: vi.fn(async () => ({})),
    },
    adminWorkerPipelineStage: {
      create: vi.fn(async () => ({ id: "stage1" })),
    },
    adminWorkerMemory: {
      findUnique: memoryFindUnique,
      upsert: memoryUpsert,
    },
  } as unknown as Parameters<typeof readSource>[0];
}

describe("readSource", () => {
  it("classifies a clear prayer page and runs the prayer extractor", async () => {
    const prisma = makePrisma();
    const out = await readSource(prisma, {
      sourceUrl: "https://catholic.example/prayers/our-father",
      sourceHost: "catholic.example",
      rawBody:
        "<html><body>Our Father, who art in heaven, hallowed be thy name. Through Christ our Lord. Amen.</body></html>",
      title: "Our Father Prayer",
    });
    expect(out.classifierContentType).toBe("PRAYER");
    expect(out.extraction).not.toBeNull();
    expect(out.pipelineStageId).toBe("stage1");
    expect(out.rejected).toBe(false);
  });

  it("rejects junk URLs and skips extraction", async () => {
    const prisma = makePrisma();
    const out = await readSource(prisma, {
      sourceUrl: "https://catholic.example/livestream/mass",
      sourceHost: "catholic.example",
      rawBody: "...",
    });
    expect(out.rejected).toBe(true);
    expect(out.extraction).toBeNull();
    expect(out.classifierContentType).toBe("WRONG");
  });

  it("writes SOURCE_PRIORITY memory on success", async () => {
    const prisma = makePrisma();
    await readSource(prisma, {
      sourceUrl: "https://catholic.example/prayers/our-father",
      sourceHost: "catholic.example",
      rawBody: "Through Christ our Lord. Amen.",
      title: "Our Father",
    });
    const upsert = (
      prisma as unknown as { adminWorkerMemory: { upsert: ReturnType<typeof vi.fn> } }
    ).adminWorkerMemory.upsert;
    expect(upsert).toHaveBeenCalled();
  });

  it("records a CLASSIFY pipeline stage with classifier confidence", async () => {
    const prisma = makePrisma();
    await readSource(prisma, {
      sourceUrl: "https://catholic.example/prayers/our-father",
      sourceHost: "catholic.example",
      rawBody: "Our Father, who art in heaven. Through Christ our Lord. Amen.",
      title: "Our Father",
    });
    const create = (
      prisma as unknown as {
        adminWorkerPipelineStage: { create: ReturnType<typeof vi.fn> };
      }
    ).adminWorkerPipelineStage.create;
    const args = create.mock.calls[0]?.[0] as { data: { stageName: string; status: string } };
    expect(args.data.stageName).toBe("CLASSIFY");
    expect(args.data.status).toBe("SUCCEEDED");
  });

  it("marks the pipeline stage FAILED when the extractor has fatal reasons", async () => {
    const prisma = makePrisma();
    await readSource(prisma, {
      sourceUrl: "https://catholic.example/prayers/x",
      sourceHost: "catholic.example",
      rawBody: "Reflections on prayer without an actual prayer text.",
      title: "Prayer Reflections",
    });
    const create = (
      prisma as unknown as {
        adminWorkerPipelineStage: { create: ReturnType<typeof vi.fn> };
      }
    ).adminWorkerPipelineStage.create;
    const args = create.mock.calls[0]?.[0] as { data: { status: string } };
    expect(args.data.status).toBe("FAILED");
  });
});
