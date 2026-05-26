/**
 * Pipeline resume / checksum-based skip (spec §3). Proves the brain
 * won't redo completed stages unless the input has changed.
 */

import { describe, expect, it, vi } from "vitest";

import { resumeOrAdvance } from "@/lib/admin-worker/pipeline-stages";

function makePrismaWithRows(rows: Array<Record<string, unknown>>) {
  return {
    adminWorkerPipelineStage: {
      findMany: vi.fn(async () => rows),
    },
  } as unknown as Parameters<typeof resumeOrAdvance>[0];
}

describe("resumeOrAdvance — checksum-based skip + resume (spec §3)", () => {
  it("returns 'run' when no prior attempt exists", async () => {
    const prisma = makePrismaWithRows([]);
    const result = await resumeOrAdvance(prisma, {
      stageName: "CLASSIFY",
      pipelineKey: "abc",
      inputChecksum: "deadbeef",
    });
    expect(result.action).toBe("run");
  });

  it("returns 'skip' when the most recent SUCCEEDED row has the same input checksum", async () => {
    const prisma = makePrismaWithRows([
      {
        id: "r1",
        status: "SUCCEEDED",
        inputChecksum: "deadbeef",
        stageName: "CLASSIFY",
      },
    ]);
    const result = await resumeOrAdvance(prisma, {
      stageName: "CLASSIFY",
      pipelineKey: "abc",
      inputChecksum: "deadbeef",
    });
    expect(result.action).toBe("skip");
    expect(result.action === "skip" && result.rowId).toBe("r1");
  });

  it("returns 'run' when the input checksum changed since the last success", async () => {
    const prisma = makePrismaWithRows([
      {
        id: "r1",
        status: "SUCCEEDED",
        inputChecksum: "old",
        stageName: "CLASSIFY",
      },
    ]);
    const result = await resumeOrAdvance(prisma, {
      stageName: "CLASSIFY",
      pipelineKey: "abc",
      inputChecksum: "new",
    });
    expect(result.action).toBe("run");
    expect(result.reason).toMatch(/changed/);
  });

  it("returns 'resume' when an in-flight row exists", async () => {
    const prisma = makePrismaWithRows([
      {
        id: "r2",
        status: "RUNNING",
        inputChecksum: "deadbeef",
        stageName: "CLASSIFY",
      },
    ]);
    const result = await resumeOrAdvance(prisma, {
      stageName: "CLASSIFY",
      pipelineKey: "abc",
      inputChecksum: "deadbeef",
    });
    expect(result.action).toBe("resume");
    expect(result.action === "resume" && result.rowId).toBe("r2");
  });

  it("returns 'run' when no pipelineKey is provided", async () => {
    const prisma = makePrismaWithRows([]);
    const result = await resumeOrAdvance(prisma, {
      stageName: "CLASSIFY",
      pipelineKey: "",
    });
    expect(result.action).toBe("run");
    expect(result.reason).toMatch(/no pipelineKey/);
  });

  it("PENDING rows count as in-flight (we resume rather than start over)", async () => {
    const prisma = makePrismaWithRows([
      {
        id: "r3",
        status: "PENDING",
        inputChecksum: null,
        stageName: "CLASSIFY",
      },
    ]);
    const result = await resumeOrAdvance(prisma, {
      stageName: "CLASSIFY",
      pipelineKey: "abc",
      inputChecksum: "deadbeef",
    });
    expect(result.action).toBe("resume");
  });
});
