/**
 * Tests for the build-intent queue (enqueueBuild).
 */

import { describe, it, expect, vi } from "vitest";

import { enqueueBuild } from "@/lib/checklist/build/queue";

function makePrisma() {
  return {
    workerBuildJob: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  } as never;
}

describe("enqueueBuild", () => {
  it("creates the first attempt for a fresh checklist item", async () => {
    const prisma: any = makePrisma();
    prisma.workerBuildJob.findFirst.mockResolvedValue(null);
    prisma.workerBuildJob.create.mockImplementation(async (args: any) => ({
      id: "job-1",
      ...args.data,
    }));

    const job = await enqueueBuild(prisma, { checklistItemId: "ci-1", triggeredBy: "manual" });
    const args = prisma.workerBuildJob.create.mock.calls[0]?.[0];
    expect(args.data.checklistItemId).toBe("ci-1");
    expect(args.data.attempt).toBe(1);
    expect(args.data.triggeredBy).toBe("manual");
    expect(job.id).toBe("job-1");
  });

  it("increments the attempt counter from the last job", async () => {
    const prisma: any = makePrisma();
    prisma.workerBuildJob.findFirst.mockResolvedValue({ attempt: 3 });
    prisma.workerBuildJob.create.mockImplementation(async (args: any) => ({
      id: "job-2",
      ...args.data,
    }));

    await enqueueBuild(prisma, { checklistItemId: "ci-1" });
    const args = prisma.workerBuildJob.create.mock.calls[0]?.[0];
    expect(args.data.attempt).toBe(4);
    expect(args.data.triggeredBy).toBe("automatic");
  });
});
