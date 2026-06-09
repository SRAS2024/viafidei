/**
 * Intelligence Laboratory pass — proves the loop integration is safe: a no-op
 * when the brain is offline, advisory-only, and never throws into the loop.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));
vi.mock("@/lib/admin-worker/intelligence/store", () => ({
  recordBrainCall: vi.fn(async () => undefined),
}));

import type { PrismaClient } from "@prisma/client";

import { runIntelligenceLabPass } from "@/lib/admin-worker/intelligence-lab";
import { isBrainEnabled } from "@/lib/admin-worker/intelligence";

const prisma = {} as unknown as PrismaClient;

describe("runIntelligenceLabPass", () => {
  it("is a no-op when the Python brain is offline (default in tests)", async () => {
    // Tests run without the brain; the lab pass must safely do nothing.
    expect(isBrainEnabled()).toBe(false);
    const r = await runIntelligenceLabPass(prisma, { passId: "p1" });
    expect(r.ran).toBe(false);
    expect(r.consulted).toEqual([]);
  });

  it("never throws into the loop", async () => {
    await expect(
      runIntelligenceLabPass(prisma, { passId: "p1", signals: { strict_qa_failure: 5 } }),
    ).resolves.toBeTruthy();
  });
});
