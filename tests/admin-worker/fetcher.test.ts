/**
 * AdminWorkerFetcher (spec §6). Tests cover the policy layer —
 * approved-host enforcement, the test skipNetwork path, and the
 * persistence layer. Real HTTP is exercised in the dispatcher /
 * integration tests.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/checklist", () => {
  const approved = (host: string) =>
    ["www.vatican.va", "vatican.va", "www.usccb.org"].includes(host);
  return {
    isApprovedAuthorityHost: vi.fn(approved),
    // Registry-only mode (open-internet off) → fetchable === approved.
    isFetchableHost: vi.fn(approved),
  };
});

vi.mock("@/lib/admin-worker/source-reputation", () => ({
  recordSourceOutcome: vi.fn(async () => undefined),
}));

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

import { adminWorkerFetch } from "@/lib/admin-worker/fetcher";

function makePrisma(opts: { failOnCreate?: boolean } = {}) {
  const rows: unknown[] = [];
  return {
    rows,
    prisma: {
      adminWorkerFetchResult: {
        create: vi.fn(async (args: { data: Record<string, unknown> }) => {
          if (opts.failOnCreate) throw new Error("DB down");
          const row = { id: `f${rows.length}`, ...args.data };
          rows.push(row);
          return row;
        }),
      },
    } as unknown as Parameters<typeof adminWorkerFetch>[0],
  };
}

describe("adminWorkerFetch — policy + persistence (spec §6)", () => {
  it("rejects invalid URLs and persists a row with INVALID_URL", async () => {
    const { prisma, rows } = makePrisma();
    const result = await adminWorkerFetch(prisma, { url: "not-a-url" });
    expect(result.succeeded).toBe(false);
    expect(result.errorClass).toBe("INVALID_URL");
    expect(rows.length).toBe(1);
  });

  it("rejects unapproved hosts before making any HTTP call", async () => {
    const { prisma, rows } = makePrisma();
    const result = await adminWorkerFetch(prisma, { url: "https://random.example/test" });
    expect(result.succeeded).toBe(false);
    expect(result.errorClass).toBe("UNAPPROVED_HOST");
    expect(rows.length).toBe(1);
    expect((rows[0] as { rejectionReason: string }).rejectionReason).toBe("unapproved host");
  });

  it("skipNetwork test path returns a synthetic 200 with an empty body", async () => {
    const { prisma } = makePrisma();
    const result = await adminWorkerFetch(prisma, {
      url: "https://www.vatican.va/test",
      skipNetwork: true,
    });
    expect(result.succeeded).toBe(true);
    expect(result.httpStatus).toBe(200);
    expect(result.checksum).toBeTruthy();
  });

  it("records succeeded=true in the AdminWorkerFetchResult row on success", async () => {
    const { prisma, rows } = makePrisma();
    await adminWorkerFetch(prisma, {
      url: "https://www.vatican.va/test",
      skipNetwork: true,
    });
    expect((rows[0] as { succeeded: boolean }).succeeded).toBe(true);
  });

  it("flags unchanged=true when the previous checksum is provided in skip-network mode", async () => {
    const { prisma } = makePrisma();
    const result = await adminWorkerFetch(prisma, {
      url: "https://www.vatican.va/test",
      skipNetwork: true,
      previousChecksum: "any-previous",
    });
    expect(result.unchanged).toBe(true);
  });

  it("survives a persistence failure and still returns a FetchedPage", async () => {
    const { prisma } = makePrisma({ failOnCreate: true });
    const result = await adminWorkerFetch(prisma, {
      url: "https://www.vatican.va/test",
      skipNetwork: true,
    });
    expect(result.fetchResultRowId).toBeNull();
    expect(result.succeeded).toBe(true);
  });
});
