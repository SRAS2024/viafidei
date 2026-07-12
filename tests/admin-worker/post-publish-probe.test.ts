/**
 * Post-publish probe + automatic rollback — proves "post-publish
 * verification works" and "rollback works when post-publish
 * verification fails" (spec sections 15, 16, 24).
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/cache/revalidate", () => ({
  revalidateForRow: vi.fn(async () => ({ ok: true, tags: [] })),
  revalidateSitemap: vi.fn(async () => ({ ok: true })),
  revalidateContentType: vi.fn(async () => ({ ok: true })),
}));

import { verifyPublished } from "@/lib/admin-worker/post-publish-probe";
import { revalidateForRow } from "@/lib/cache/revalidate";

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

  it("rolls back and unpublishes on FAIL", async () => {
    // Force the probe to fail by stubbing the global fetch.
    const realFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => "internal",
    })) as unknown as typeof fetch;

    const { prisma } = makePrisma();
    const out = await verifyPublished(prisma, {
      contentType: "PRAYER",
      contentId: "p1",
      slug: "our-father",
      expectedTitle: "Our Father",
    });
    expect(out.result).toBe("FAIL");
    expect(prisma.publishedContent.updateMany).toHaveBeenCalled();

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
