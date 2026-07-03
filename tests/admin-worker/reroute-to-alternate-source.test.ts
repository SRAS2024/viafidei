/**
 * Active source rerouting (self-reliant replacement for AI extraction).
 *
 * When deterministic extraction leaves required fields missing, the worker must
 * escape EXTRACTION by SWITCHING SOURCES — never by inventing fields with an
 * external AI. These tests pin that rerouteToAlternateSource picks the best
 * unfetched candidate of the same type on a DIFFERENT host and boosts its fetch
 * priority, and is a safe no-op when no alternate exists yet.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

import type { PrismaClient } from "@prisma/client";

import { rerouteToAlternateSource } from "@/lib/admin-worker/repair";

interface Candidate {
  id: string;
  discoveredUrl: string;
  sourceHost: string;
  predictedContentType: string | null;
  status: string;
  fetchAttempts: number;
  fetchPriority: number;
}

function fakePrisma(candidates: Candidate[]) {
  const rows = candidates.map((c) => ({ ...c }));
  return {
    rows,
    candidateSourceUrl: {
      findFirst: async ({
        where,
        orderBy,
      }: {
        where: {
          predictedContentType?: string;
          sourceHost?: { not: string };
          status?: { in: string[] };
        };
        orderBy?: Array<Record<string, "asc" | "desc">>;
      }) => {
        let matches = rows.filter((r) => {
          if (where.predictedContentType && r.predictedContentType !== where.predictedContentType)
            return false;
          if (where.sourceHost?.not && r.sourceHost === where.sourceHost.not) return false;
          if (where.status?.in && !where.status.in.includes(r.status)) return false;
          return true;
        });
        // Honour the "least-tried, then highest-priority" ordering.
        matches = matches.sort(
          (a, b) => a.fetchAttempts - b.fetchAttempts || b.fetchPriority - a.fetchPriority,
        );
        void orderBy;
        return matches[0] ?? null;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { fetchPriority?: number; status?: string };
      }) => {
        const row = rows.find((r) => r.id === where.id);
        if (row) {
          if (typeof data.fetchPriority === "number") row.fetchPriority = data.fetchPriority;
          if (typeof data.status === "string") row.status = data.status;
        }
        return row ?? {};
      },
    },
    adminWorkerLog: { create: vi.fn(async () => ({})) },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FakePrisma = any;

function cand(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: "c1",
    discoveredUrl: "https://alt.example/saint",
    sourceHost: "alt.example",
    predictedContentType: "SAINT",
    status: "DISCOVERED",
    fetchAttempts: 0,
    fetchPriority: 5,
    ...overrides,
  };
}

describe("rerouteToAlternateSource", () => {
  it("boosts an alternate-host candidate of the same type and marks it PRIORITIZED", async () => {
    const prisma = fakePrisma([cand({ id: "alt", sourceHost: "alt.example", fetchPriority: 5 })]);
    const r = await rerouteToAlternateSource(prisma as FakePrisma, {
      contentType: "SAINT",
      failedHost: "failed.example",
      missingFields: ["feastDay"],
    });
    expect(r.succeeded).toBe(true);
    expect(r.reroutedTo).toBe("alt.example");
    const boosted = prisma.rows.find((x: Candidate) => x.id === "alt");
    expect(boosted.fetchPriority).toBeGreaterThan(1000); // boosted above the queue
    expect(boosted.status).toBe("PRIORITIZED");
  });

  it("never reroutes back to the failed host", async () => {
    const prisma = fakePrisma([
      cand({ id: "same", sourceHost: "failed.example" }), // same host — ineligible
    ]);
    const r = await rerouteToAlternateSource(prisma as FakePrisma, {
      contentType: "SAINT",
      failedHost: "failed.example",
    });
    expect(r.succeeded).toBe(false);
    expect(r.reroutedTo).toBeNull();
  });

  it("is a safe no-op when no alternate source exists yet", async () => {
    const prisma = fakePrisma([]);
    const r = await rerouteToAlternateSource(prisma as FakePrisma, {
      contentType: "PRAYER",
      failedHost: "failed.example",
    });
    expect(r.attempted).toBe(true);
    expect(r.succeeded).toBe(false);
    expect(r.reroutedTo).toBeNull();
    expect(r.reason).toMatch(/no alternate/i);
  });

  it("prefers the least-tried alternate (genuine rotation, not re-hammering one)", async () => {
    const prisma = fakePrisma([
      cand({ id: "tried", sourceHost: "a.example", fetchAttempts: 3, fetchPriority: 50 }),
      cand({ id: "fresh", sourceHost: "b.example", fetchAttempts: 0, fetchPriority: 1 }),
    ]);
    const r = await rerouteToAlternateSource(prisma as FakePrisma, {
      contentType: "SAINT",
      failedHost: "failed.example",
    });
    expect(r.reroutedTo).toBe("b.example"); // least-tried wins despite lower priority
  });
});
