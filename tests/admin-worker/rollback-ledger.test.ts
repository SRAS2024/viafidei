/**
 * Durable rollback ledger — proves every post-publish rollback writes a
 * restorable-aware ledger row and that DELETED is the only non-restorable
 * terminal state.
 */

import { describe, expect, it, vi } from "vitest";

import { listRecentRollbacks, recordRollbackLedger } from "@/lib/admin-worker/rollback-ledger";
import { decideAndExecuteRollback } from "@/lib/admin-worker/post-publish-rollback";

describe("recordRollbackLedger", () => {
  it("writes a row and never throws when the store fails", async () => {
    const create = vi.fn(async () => ({ id: "rb-1" }));
    const prisma = { adminWorkerRollbackLedger: { create } } as never;
    await recordRollbackLedger(prisma, {
      previousPublicState: "PUBLISHED",
      rollbackAction: "unpublished",
      rollbackResult: "HUMAN_REVIEW",
      restorable: true,
    });
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0][0].data.restorable).toBe(true);

    const throwing = {
      adminWorkerRollbackLedger: {
        create: vi.fn(async () => {
          throw new Error("db down");
        }),
      },
    } as never;
    await expect(
      recordRollbackLedger(throwing, {
        previousPublicState: "PUBLISHED",
        rollbackAction: "x",
        rollbackResult: "DELETED",
      }),
    ).resolves.toBeUndefined();
  });
});

describe("listRecentRollbacks", () => {
  it("returns [] on a query failure", async () => {
    const prisma = {
      adminWorkerRollbackLedger: {
        findMany: vi.fn(async () => {
          throw new Error("nope");
        }),
      },
    } as never;
    expect(await listRecentRollbacks(prisma)).toEqual([]);
  });
});

describe("decideAndExecuteRollback writes the ledger", () => {
  function makePrisma() {
    const ledger: Array<Record<string, unknown>> = [];
    const prisma = {
      publishedContent: { updateMany: vi.fn(async () => ({ count: 1 })) },
      adminWorkerLog: { create: vi.fn(async () => ({ id: "l" })) },
      adminWorkerRollbackLedger: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          ledger.push(data);
          return { id: `rb-${ledger.length}` };
        }),
      },
      // human-review dependency (best-effort, may be unused)
      adminWorkerHumanReviewItem: { create: vi.fn(async () => ({ id: "hr" })) },
    } as never;
    return { prisma, ledger };
  }

  it("records a restorable HUMAN_REVIEW row for an ambiguous failure", async () => {
    const { prisma, ledger } = makePrisma();
    const res = await decideAndExecuteRollback(prisma, {
      contentType: "PRAYER",
      contentId: "ci-1",
      slug: "our-father",
      failedCheck: "related_links", // not severe → human review
      reason: "broken related link",
    });
    expect(res.kind).toBe("HUMAN_REVIEW");
    expect(ledger).toHaveLength(1);
    expect(ledger[0].rollbackResult).toBe("HUMAN_REVIEW");
    expect(ledger[0].restorable).toBe(true);
    expect(ledger[0].previousPublicState).toBe("PUBLISHED");
  });

  it("records a non-restorable DELETED row for a severe+clear failure", async () => {
    const { prisma, ledger } = makePrisma();
    const res = await decideAndExecuteRollback(prisma, {
      contentType: "PRAYER",
      contentId: "ci-2",
      slug: "broken",
      failedCheck: "public_route", // severe
      reason: "HTTP 404 on public route",
      recoverableHint: false,
    });
    expect(res.kind).toBe("DELETED");
    expect(ledger).toHaveLength(1);
    expect(ledger[0].rollbackResult).toBe("DELETED");
    expect(ledger[0].restorable).toBe(false);
  });
});
