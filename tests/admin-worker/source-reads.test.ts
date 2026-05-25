/**
 * AdminWorkerSourceRead helpers — proves checksum dedupe + reuse logic
 * (spec §6). When the page hasn't changed, return the existing row;
 * when it has, write a new one.
 */

import { describe, expect, it, vi } from "vitest";

import {
  checksumOf,
  findExistingRead,
  listRecentReads,
  upsertSourceRead,
} from "@/lib/admin-worker/source-reads";

function makePrismaMock(opts: {
  findUnique?: ReturnType<typeof vi.fn>;
  create?: ReturnType<typeof vi.fn>;
  findMany?: ReturnType<typeof vi.fn>;
}) {
  const table = {
    findUnique: opts.findUnique ?? vi.fn(async () => null),
    create:
      opts.create ??
      vi.fn(async (args: { data: { checksum: string } }) => ({
        id: "new-id",
        checksum: args.data.checksum,
      })),
    findMany: opts.findMany ?? vi.fn(async () => []),
  };
  return {
    adminWorkerSourceRead: table,
  } as unknown as Parameters<typeof upsertSourceRead>[0];
}

describe("checksumOf", () => {
  it("hashes deterministically", () => {
    expect(checksumOf("hello")).toBe(checksumOf("hello"));
  });

  it("returns different checksums for different inputs", () => {
    expect(checksumOf("a")).not.toBe(checksumOf("b"));
  });

  it("returns a 64-char hex sha256", () => {
    const out = checksumOf("anything");
    expect(out).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("findExistingRead", () => {
  it("queries the compound unique index", async () => {
    const findUnique = vi.fn(async () => null);
    const prisma = makePrismaMock({ findUnique });
    await findExistingRead(prisma, "https://example.com/x", "abc123");
    const arg = findUnique.mock.calls[0]?.[0] as {
      where: { sourceUrl_checksum: { sourceUrl: string; checksum: string } };
    };
    expect(arg.where.sourceUrl_checksum.sourceUrl).toBe("https://example.com/x");
    expect(arg.where.sourceUrl_checksum.checksum).toBe("abc123");
  });
});

describe("upsertSourceRead", () => {
  const baseInput = {
    sourceUrl: "https://example.com/page",
    sourceHost: "example.com",
    rawBody: "<html>Page</html>",
  };

  it("creates a new read when checksum is unseen", async () => {
    const create = vi.fn(async (args: { data: { checksum: string } }) => ({
      id: "created-1",
      checksum: args.data.checksum,
    }));
    const prisma = makePrismaMock({ create });
    const res = await upsertSourceRead(prisma, baseInput);
    expect(res.reused).toBe(false);
    expect(res.id).toBe("created-1");
    expect(create).toHaveBeenCalledOnce();
  });

  it("reuses an existing read when the checksum matches", async () => {
    const checksum = checksumOf(baseInput.rawBody);
    const findUnique = vi.fn(async () => ({ id: "existing-1", checksum }));
    const create = vi.fn();
    const prisma = makePrismaMock({ findUnique, create });
    const res = await upsertSourceRead(prisma, baseInput);
    expect(res.reused).toBe(true);
    expect(res.id).toBe("existing-1");
    expect(create).not.toHaveBeenCalled();
  });

  it("records byteSize using the UTF-8 byte length", async () => {
    const create = vi.fn(async () => ({ id: "x", checksum: "y" }));
    const prisma = makePrismaMock({ create });
    await upsertSourceRead(prisma, { ...baseInput, rawBody: "héllo" });
    const arg = create.mock.calls[0]?.[0] as { data: { byteSize: number } };
    expect(arg.data.byteSize).toBe(Buffer.byteLength("héllo", "utf8"));
  });

  it("stores extracted fields when provided", async () => {
    const create = vi.fn(async () => ({ id: "x", checksum: "y" }));
    const prisma = makePrismaMock({ create });
    await upsertSourceRead(prisma, {
      ...baseInput,
      extractedTitle: "My Page",
      extractedText: "lorem ipsum",
      detectedContentType: "PRAYER",
      confidenceScore: 0.82,
      fetchStatus: 200,
    });
    const arg = create.mock.calls[0]?.[0] as {
      data: {
        extractedTitle: string;
        extractedText: string;
        detectedContentType: string;
        confidenceScore: number;
        fetchStatus: number;
      };
    };
    expect(arg.data.extractedTitle).toBe("My Page");
    expect(arg.data.detectedContentType).toBe("PRAYER");
    expect(arg.data.confidenceScore).toBe(0.82);
    expect(arg.data.fetchStatus).toBe(200);
  });
});

describe("listRecentReads", () => {
  it("filters by host when provided", async () => {
    const findMany = vi.fn(async () => []);
    const prisma = makePrismaMock({ findMany });
    await listRecentReads(prisma, { host: "example.com", limit: 10 });
    const arg = findMany.mock.calls[0]?.[0] as {
      where: { sourceHost: string };
      take: number;
    };
    expect(arg.where.sourceHost).toBe("example.com");
    expect(arg.take).toBe(10);
  });

  it("defaults to limit=50 when not provided", async () => {
    const findMany = vi.fn(async () => []);
    const prisma = makePrismaMock({ findMany });
    await listRecentReads(prisma);
    const arg = findMany.mock.calls[0]?.[0] as { take: number };
    expect(arg.take).toBe(50);
  });
});
