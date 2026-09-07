/**
 * Post-publish probe + automatic rollback — proves "post-publish
 * verification works" and "rollback works when post-publish
 * verification fails" (spec sections 15, 16, 24).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/cache/revalidate", () => ({
  revalidateForRow: vi.fn(async () => ({ ok: true, tags: [] })),
  revalidateSitemap: vi.fn(async () => ({ ok: true })),
  revalidateContentType: vi.fn(async () => ({ ok: true })),
}));

import { verifyPublished } from "@/lib/admin-worker/post-publish-probe";
import { revalidateForRow } from "@/lib/cache/revalidate";

// The probe refuses to run against a localhost origin when DATABASE_URL is
// remote (that is how production rows got unpublished from a laptop). Pin a
// local DB here so these tests exercise the probe regardless of the shell env.
let savedDbUrl: string | undefined;
beforeEach(() => {
  savedDbUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
});
afterEach(() => {
  if (savedDbUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = savedDbUrl;
});

function makePrisma() {
  const verifications: unknown[] = [];
  return {
    captured: verifications,
    prisma: {
      postPublishVerification: {
        create: vi.fn(async ({ data }: { data: unknown }) => {
          const row = { id: `v${verifications.length + 1}`, ...(data as object) };
          verifications.push(row);
          return row;
        }),
      },
      adminWorkerLog: { create: vi.fn(async () => ({ id: "log" })) },
      publishedContent: { updateMany: vi.fn(async () => ({ count: 1 })) },
      humanReviewQueue: { create: vi.fn(async () => ({ id: "r1" })) },
    } as unknown as Parameters<typeof verifyPublished>[0],
  };
}

describe("verifyPublished", () => {
  it("returns PASS when the probe is skipped (test mode)", async () => {
    vi.mocked(revalidateForRow).mockClear();
    const { prisma } = makePrisma();
    const out = await verifyPublished(prisma, {
      contentType: "PRAYER",
      contentId: "p1",
      slug: "our-father",
      expectedTitle: "Our Father",
      skipNetwork: true,
    });
    expect(out.result).toBe("PASS");
    expect(revalidateForRow).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "package_created",
        contentType: "PRAYER",
        slug: "our-father",
      }),
    );
  });

  it("reports WARN (unverified) on a 5xx and never unpublishes", async () => {
    // A 502/503/429 is the transport or the edge talking (a deploy in
    // progress, a rate limit) — not evidence the page is gone.
    const realFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 502,
      text: async () => "bad gateway",
    })) as unknown as typeof fetch;

    const { prisma } = makePrisma();
    const out = await verifyPublished(prisma, {
      contentType: "PRAYER",
      contentId: "p1",
      slug: "our-father",
      expectedTitle: "Our Father",
    });
    expect(out.result).toBe("WARN");
    expect(out.observed).toBe("WARN");
    expect(out.checks.publicPageCheck).toBe("WARN");
    expect(prisma.publishedContent.updateMany).not.toHaveBeenCalled();

    globalThis.fetch = realFetch;
  });

  it("treats a 404 as a FIRST STRIKE: recorded FAIL, reported WARN, nothing unpublished", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 404,
      text: async () => "not found",
    })) as unknown as typeof fetch;

    const { prisma, captured } = makePrisma();
    const out = await verifyPublished(prisma, {
      contentType: "PRAYER",
      contentId: "p1",
      slug: "our-father",
      expectedTitle: "Our Father",
    });
    expect(out.observed).toBe("FAIL");
    expect(out.result).toBe("WARN");
    expect(out.failureConfirmed).toBe(false);
    // The observation is persisted so the next pass can confirm or clear it.
    expect((captured[0] as { result: string }).result).toBe("FAIL");
    expect((captured[0] as { errorMessage: string }).errorMessage).toMatch(/first strike/);
    expect(prisma.publishedContent.updateMany).not.toHaveBeenCalled();

    globalThis.fetch = realFetch;
  });

  it("confirms a FAIL only with a prior FAIL ≥ 10 min old — and still does not unpublish itself", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 404,
      text: async () => "not found",
    })) as unknown as typeof fetch;

    const { prisma } = makePrisma();
    const pp = prisma.postPublishVerification as unknown as Record<string, unknown>;
    // Prior strike 11 minutes ago.
    pp.findFirst = vi.fn(async () => ({
      id: "v0",
      result: "FAIL",
      createdAt: new Date(Date.now() - 11 * 60 * 1000),
    }));
    const confirmed = await verifyPublished(prisma, {
      contentType: "PRAYER",
      contentId: "p1",
      slug: "our-father",
      expectedTitle: "Our Father",
    });
    expect(confirmed.result).toBe("FAIL");
    expect(confirmed.failureConfirmed).toBe(true);
    // The probe records + reports; the dispatcher's decision tree unpublishes.
    expect(prisma.publishedContent.updateMany).not.toHaveBeenCalled();

    // Prior strike only 2 minutes ago → still unconfirmed.
    pp.findFirst = vi.fn(async () => ({
      id: "v0",
      result: "FAIL",
      createdAt: new Date(Date.now() - 2 * 60 * 1000),
    }));
    const tooSoon = await verifyPublished(prisma, {
      contentType: "PRAYER",
      contentId: "p1",
      slug: "our-father",
      expectedTitle: "Our Father",
    });
    expect(tooSoon.result).toBe("WARN");
    expect(tooSoon.failureConfirmed).toBe(false);

    globalThis.fetch = realFetch;
  });

  it("emits WARN and does NOT roll back when the page is unreachable (fetch throws)", async () => {
    // The worker could not connect (no server / proxied egress / mid-deploy).
    // That is NOT evidence the content is broken, so vetted content must stay
    // published — never deleted because the probe couldn't reach the host.
    const realFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      throw new Error("fetch failed");
    }) as unknown as typeof fetch;

    const { prisma } = makePrisma();
    const out = await verifyPublished(prisma, {
      contentType: "PRAYER",
      contentId: "p1",
      slug: "our-father",
      expectedTitle: "Our Father",
    });
    expect(out.result).toBe("WARN");
    // No rollback: the published row is left untouched.
    expect(prisma.publishedContent.updateMany).not.toHaveBeenCalled();

    globalThis.fetch = realFetch;
  });

  it("emits WARN when the page loads but the title is missing", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => "<html>some other content</html>",
    })) as unknown as typeof fetch;

    const { prisma } = makePrisma();
    const out = await verifyPublished(prisma, {
      contentType: "PRAYER",
      contentId: "p1",
      slug: "our-father",
      expectedTitle: "Our Father",
    });
    expect(out.result).toBe("WARN");

    globalThis.fetch = realFetch;
  });
});
