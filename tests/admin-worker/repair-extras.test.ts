/**
 * Repair-handler extras — fetchWithBackoff retries on failure and
 * succeeds on a later attempt; persistence + validation-evidence
 * reporters write a structured log row.
 */

import { describe, expect, it, vi } from "vitest";

import {
  fetchWithBackoff,
  reportPersistenceFailure,
  reportValidationEvidenceMissing,
} from "@/lib/admin-worker/repair";

function makePrisma() {
  const logs: unknown[] = [];
  return {
    logs,
    prisma: {
      adminWorkerLog: {
        create: vi.fn(async ({ data }: { data: unknown }) => {
          logs.push(data);
          return { id: `l${logs.length}` };
        }),
      },
    } as unknown as Parameters<typeof fetchWithBackoff>[0],
  };
}

describe("fetchWithBackoff", () => {
  it("returns the value on the first successful attempt", async () => {
    const { prisma, logs } = makePrisma();
    const out = await fetchWithBackoff(prisma, "fetch test", async () => "ok", {
      attempts: 3,
      baseDelayMs: 1,
    });
    expect(out).toBe("ok");
    expect(logs).toHaveLength(0);
  });

  it("retries until success", async () => {
    const { prisma, logs } = makePrisma();
    let calls = 0;
    const out = await fetchWithBackoff(
      prisma,
      "fetch test",
      async () => {
        calls += 1;
        if (calls < 3) throw new Error("flaky");
        return "ok";
      },
      { attempts: 4, baseDelayMs: 1 },
    );
    expect(out).toBe("ok");
    expect(calls).toBe(3);
    expect(logs.some((l) => (l as { eventName: string }).eventName === "fetch_backoff_retry")).toBe(
      true,
    );
  });

  it("throws after exhausting attempts", async () => {
    const { prisma } = makePrisma();
    await expect(
      fetchWithBackoff(
        prisma,
        "fetch test",
        async () => {
          throw new Error("nope");
        },
        { attempts: 2, baseDelayMs: 1 },
      ),
    ).rejects.toThrow("nope");
  });
});

describe("reportPersistenceFailure", () => {
  it("logs the database error", async () => {
    const { prisma, logs } = makePrisma();
    const out = await reportPersistenceFailure(prisma, "save row", new Error("conn refused"));
    expect(out.succeeded).toBe(false);
    expect(out.kind).toBe("persistence_failed");
    expect(logs[0]).toMatchObject({ eventName: "persistence_failed" });
  });
});

describe("reportValidationEvidenceMissing", () => {
  it("logs a validation-evidence-missing entry", async () => {
    const { prisma, logs } = makePrisma();
    const out = await reportValidationEvidenceMissing(prisma, "PRAYER", "p1");
    expect(out.kind).toBe("validation_evidence_missing");
    expect(logs[0]).toMatchObject({ eventName: "validation_evidence_missing" });
  });
});
