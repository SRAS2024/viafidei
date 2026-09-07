/**
 * Bounded parish-website communion verification: 30 sites/run by default,
 * per-parish nextDueAt persisted in payload._meta, cursor persisted after
 * every site, a NOT-in-communion verdict unpublishes (never deletes) with a
 * review row + an osm-skip so discovery does not republish it, in-communion
 * enriches missing details, unknown keeps the row on the OSM tag.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@prisma/client";

vi.mock("@/lib/admin-worker/communion-verifier", () => ({
  inspectParishWebsite: vi.fn(),
}));
vi.mock("@/lib/admin-worker/content-protection", () => ({
  applyProtectedContentUpdate: vi.fn(async () => ({ applied: true, kind: "enrich" })),
}));
vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

import {
  runParishWebsiteVerification,
  websiteVerificationDue,
} from "@/lib/admin-worker/parish-website-verification";
import { inspectParishWebsite } from "@/lib/admin-worker/communion-verifier";
import { applyProtectedContentUpdate } from "@/lib/admin-worker/content-protection";

const mockedInspect = vi.mocked(inspectParishWebsite);
const mockedProtect = vi.mocked(applyProtectedContentUpdate);

function verdict(
  status: "in-communion" | "not-in-communion" | "unknown",
  details: Record<string, string> = {},
) {
  return {
    verdict: {
      status,
      confidence: 0.8,
      signals: {
        positive: [],
        negative: status === "not-in-communion" ? ["Old Catholic"] : [],
        review: [],
      },
      reason: `${status} (test)`,
    },
    details,
  } as never;
}

function makePrisma(rows: Array<Record<string, unknown>>) {
  const store = new Map<string, { memoryValue: unknown; lastUsedAt: Date }>();
  const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
  const reviews: Array<Record<string, unknown>> = [];
  const prisma = {
    adminWorkerMemory: {
      findUnique: vi.fn(
        async ({ where }: { where: { memoryType_memoryKey: { memoryKey: string } } }) => {
          const v = store.get(where.memoryType_memoryKey.memoryKey);
          return v ? { memoryValue: v.memoryValue, lastUsedAt: v.lastUsedAt } : null;
        },
      ),
      upsert: vi.fn(
        async ({
          where,
          update,
        }: {
          where: { memoryType_memoryKey: { memoryKey: string } };
          update: { memoryValue: unknown };
        }) => {
          store.set(where.memoryType_memoryKey.memoryKey, {
            memoryValue: update.memoryValue,
            lastUsedAt: new Date(),
          });
          return {};
        },
      ),
    },
    publishedContent: {
      findMany: vi.fn(async ({ where }: { where: { id?: { gt: string } } }) =>
        rows.filter((r) => !where.id || String(r.id) > where.id.gt),
      ),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          updates.push({ id: where.id, data });
          return {};
        },
      ),
    },
    humanReviewQueue: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        reviews.push(data);
        return {};
      }),
    },
  } as unknown as PrismaClient;
  return { prisma, store, updates, reviews };
}

const row = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  slug: `parish-${id}`,
  title: `Parish ${id}`,
  payload: {
    slug: `parish-${id}`,
    title: `Parish ${id}`,
    website: `https://${id}.example`,
    city: "X",
    ...extra,
  },
});

beforeEach(() => {
  delete process.env.ADMIN_WORKER_SKIP_NETWORK;
  mockedInspect.mockReset();
  mockedProtect.mockClear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("websiteVerificationDue", () => {
  it("is due with a website and no future nextDueAt; never due without a website", () => {
    expect(websiteVerificationDue({ website: "https://a.example" })).toBe(true);
    expect(
      websiteVerificationDue({
        website: "https://a.example",
        _meta: { websiteVerification: { nextDueAt: Date.now() + 1000 } },
      }),
    ).toBe(false);
    expect(
      websiteVerificationDue({
        website: "https://a.example",
        _meta: { websiteVerification: { nextDueAt: Date.now() - 1 } },
      }),
    ).toBe(true);
    expect(websiteVerificationDue({})).toBe(false);
  });
});

describe("runParishWebsiteVerification", () => {
  it("unpublishes (never deletes) a parish whose site proves not in communion, with a review row and an osm-skip", async () => {
    mockedInspect.mockResolvedValue(verdict("not-in-communion"));
    const { prisma, store, updates, reviews } = makePrisma([row("a")]);

    const out = await runParishWebsiteVerification(prisma, { limit: 30 });

    expect(out.checked).toBe(1);
    expect(out.unpublished).toBe(1);
    expect(updates[0]!.data.isPublished).toBe(false);
    expect(updates[0]!.data.unpublishedAt).toBeInstanceOf(Date);
    const meta = (
      updates[0]!.data.payload as { _meta: { websiteVerification: { status: string } } }
    )._meta;
    expect(meta.websiteVerification.status).toBe("not-in-communion");
    expect(reviews[0]).toMatchObject({
      contentType: "PARISH",
      contentTitle: "parish-a",
      blockingGate: "communion-verifier",
    });
    const skip = store.get("osm-skip:parish-a")!.memoryValue as { retryAfter: number };
    expect(skip.retryAfter).toBeGreaterThan(Date.now() + 300 * 24 * 60 * 60 * 1000);
  });

  it("keeps an in-communion parish, folds in missing details (enrich only), and schedules the next check", async () => {
    mockedInspect.mockResolvedValue(
      verdict("in-communion", { phone: "(555) 111-2222", massTimes: "Sun 9am" }),
    );
    const { prisma } = makePrisma([row("b", { massTimes: "Sun 10am" })]);

    const out = await runParishWebsiteVerification(prisma, { limit: 30 });

    expect(out.inCommunion).toBe(1);
    expect(out.enriched).toBe(1);
    expect(mockedProtect).toHaveBeenCalledTimes(1);
    const proposed = mockedProtect.mock.calls[0]![1].proposedPayload as {
      phone: string;
      massTimes: string;
      _meta: {
        websiteVerification: { status: string; nextDueAt: number; verifiedViaWebsite: boolean };
      };
    };
    expect(proposed.phone).toBe("(555) 111-2222");
    expect(proposed.massTimes).toBe("Sun 10am"); // existing value is not replaced here
    expect(proposed._meta.websiteVerification.verifiedViaWebsite).toBe(true);
    expect(proposed._meta.websiteVerification.nextDueAt).toBeGreaterThan(
      Date.now() + 170 * 24 * 60 * 60 * 1000,
    );
  });

  it("keeps an unreadable/unknown site published on the OSM tag and re-checks in 90 days", async () => {
    mockedInspect.mockResolvedValue(verdict("unknown"));
    const { prisma, updates } = makePrisma([row("c")]);

    const out = await runParishWebsiteVerification(prisma, { limit: 30 });

    expect(out.unknown).toBe(1);
    expect(out.unpublished).toBe(0);
    expect(updates[0]!.data.isPublished).toBeUndefined();
    const meta = (
      updates[0]!.data.payload as {
        _meta: { websiteVerification: { nextDueAt: number; verifiedViaWebsite: boolean } };
      }
    )._meta;
    expect(meta.websiteVerification.verifiedViaWebsite).toBe(false);
    expect(meta.websiteVerification.nextDueAt).toBeGreaterThan(
      Date.now() + 80 * 24 * 60 * 60 * 1000,
    );
  });

  it("honours the limit, skips rows not yet due, and persists the cursor after every site", async () => {
    mockedInspect.mockResolvedValue(verdict("unknown"));
    const notDue = row("b", { _meta: { websiteVerification: { nextDueAt: Date.now() + 1e9 } } });
    const { prisma, store } = makePrisma([row("a"), notDue, row("c"), row("d")]);

    const out = await runParishWebsiteVerification(prisma, { limit: 2 });

    expect(out.checked).toBe(2);
    expect(mockedInspect.mock.calls.map((c) => c[0])).toEqual([
      "https://a.example",
      "https://c.example",
    ]);
    expect((store.get("parish-site-verify")!.memoryValue as { cursorId: string }).cursorId).toBe(
      "c",
    );

    // Next run continues after "c".
    mockedInspect.mockClear();
    await runParishWebsiteVerification(prisma, { limit: 2 });
    expect(mockedInspect.mock.calls.map((c) => c[0])).toEqual(["https://d.example"]);
    // Reached the end of the catalog → wrap.
    expect(
      (store.get("parish-site-verify")!.memoryValue as { cursorId: string | null }).cursorId,
    ).toBeNull();
  });

  it("stops at its wall-clock budget so it stays under the lane watchdog", async () => {
    mockedInspect.mockResolvedValue(verdict("unknown"));
    let now = 1_000_000;
    const { prisma } = makePrisma([row("a"), row("b"), row("c")]);
    const out = await runParishWebsiteVerification(prisma, {
      limit: 30,
      budgetMs: 10,
      now: () => (now += 6), // each check "takes" 6 ms
    });
    expect(out.checked).toBeLessThan(3);
  });

  it("is idle in skip-network mode", async () => {
    process.env.ADMIN_WORKER_SKIP_NETWORK = "1";
    const { prisma } = makePrisma([row("a")]);
    const out = await runParishWebsiteVerification(prisma);
    expect(out.ran).toBe(false);
    expect(prisma.publishedContent.findMany).not.toHaveBeenCalled();
  });
});
