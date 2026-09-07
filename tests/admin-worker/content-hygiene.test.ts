/**
 * Content hygiene (content-hygiene.ts): published rows whose TITLE is still
 * their SLUG get their real display name back, and stale subtitles are
 * re-derived — bounded, versioned, idempotent.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

import {
  humanizeSlug,
  repairedTitle,
  runContentHygiene,
  titleLooksLikeSlug,
} from "@/lib/admin-worker/content-hygiene";
import { generateContentSubtitle } from "@/lib/content-shared/content-subtitle";

describe("content hygiene — pure helpers", () => {
  it("humanises slugs with small words and roman numerals", () => {
    expect(humanizeSlug("saint-john-of-the-cross")).toBe("Saint John of the Cross");
    expect(humanizeSlug("pope-pius-xii")).toBe("Pope Pius XII");
    expect(humanizeSlug("our-lady-of-the-rosary-of-chiquinquira")).toBe(
      "Our Lady of the Rosary of Chiquinquira",
    );
  });

  it("detects slug-shaped titles", () => {
    expect(titleLooksLikeSlug("saint-our-lady-of-the-rosary", "saint-our-lady-of-the-rosary")).toBe(
      true,
    );
    expect(titleLooksLikeSlug("saint-innocent-xi", "another-slug")).toBe(true);
    expect(titleLooksLikeSlug("", "x")).toBe(true);
    expect(titleLooksLikeSlug("Saint Innocent XI", "saint-innocent-xi")).toBe(false);
    expect(titleLooksLikeSlug("Our Father", "our-father")).toBe(false);
  });

  it("prefers the payload's own display name over a humanised slug", () => {
    expect(repairedTitle("saint-innocent-xi", { canonicalName: "Innocent XI" })).toBe(
      "Innocent XI",
    );
    expect(repairedTitle("saint-innocent-xi", { title: "Pope Innocent XI" })).toBe(
      "Pope Innocent XI",
    );
    // A payload name that is itself a slug is not a display name.
    expect(repairedTitle("saint-innocent-xi", { title: "saint-innocent-xi" })).toBe(
      "Saint Innocent XI",
    );
    expect(repairedTitle("saint-innocent-xi", {})).toBe("Saint Innocent XI");
  });
});

interface Row {
  id: string;
  contentType: string;
  slug: string;
  title: string;
  subtitle: string | null;
  payload: Record<string, unknown>;
  version: number;
  contentChecksum: string | null;
}

function fakePrisma(rows: Row[]) {
  const memory = new Map<string, unknown>();
  const versions: unknown[] = [];
  const checklistUpdates: unknown[] = [];
  return {
    versions,
    checklistUpdates,
    rows,
    $queryRaw: vi.fn(async () =>
      rows.filter(
        (r) => r.title === r.slug || /^[a-z0-9]+(-[a-z0-9]+)+$/.test(r.title) || !r.title.trim(),
      ),
    ),
    publishedContent: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const r = rows.find((x) => x.id === where.id);
        return r ? { ...r } : null;
      }),
      findMany: vi.fn(
        async ({
          where,
          take,
          select: _select,
        }: {
          where: { id?: { gt: string } };
          take: number;
          select?: unknown;
        }) =>
          rows
            .filter((r) => !where.id || r.id > where.id.gt)
            .sort((a, b) => (a.id < b.id ? -1 : 1))
            .slice(0, take)
            .map((r) => ({ ...r })),
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        const r = rows.find((x) => x.id === where.id)!;
        if (typeof (data as { version?: { increment: number } }).version === "object") {
          r.version += (data as { version: { increment: number } }).version.increment;
        } else {
          Object.assign(r, data);
        }
        return { ...r };
      }),
    },
    publishedContentVersion: {
      create: vi.fn(async ({ data }: { data: unknown }) => {
        versions.push(data);
        return { id: `v${versions.length}` };
      }),
    },
    checklistItem: {
      updateMany: vi.fn(async (args: unknown) => {
        checklistUpdates.push(args);
        return { count: 1 };
      }),
    },
    adminWorkerMemory: {
      findUnique: vi.fn(
        async ({ where }: { where: { memoryType_memoryKey: { memoryKey: string } } }) => {
          const v = memory.get(where.memoryType_memoryKey.memoryKey);
          return v ? { memoryValue: v } : null;
        },
      ),
      upsert: vi.fn(
        async ({
          where,
          create,
        }: {
          where: { memoryType_memoryKey: { memoryKey: string } };
          create: { memoryValue: unknown };
        }) => {
          memory.set(where.memoryType_memoryKey.memoryKey, create.memoryValue);
          return {};
        },
      ),
    },
  };
}

describe("runContentHygiene", () => {
  let rows: Row[];
  beforeEach(() => {
    rows = [
      {
        id: "a1",
        contentType: "SAINT",
        slug: "saint-our-lady-of-the-rosary-of-chiquinquira",
        title: "saint-our-lady-of-the-rosary-of-chiquinquira",
        subtitle: "A saint of the Catholic Church",
        payload: { canonicalName: "Our Lady of the Rosary of Chiquinquirá", role: "Patroness" },
        version: 1,
        contentChecksum: null,
      },
      {
        id: "a2",
        contentType: "GUIDE",
        slug: "how-to-pray-the-rosary",
        title: "How to Pray the Holy Rosary",
        subtitle: "stale subtitle",
        payload: { kind: "rosary", title: "How to Pray the Holy Rosary" },
        version: 3,
        contentChecksum: "x",
      },
      {
        id: "a3",
        contentType: "PRAYER",
        slug: "our-father",
        title: "Our Father",
        subtitle: generateContentSubtitle({ contentType: "PRAYER", contentSubtype: null }),
        payload: { body: "Our Father, who art in heaven" },
        version: 1,
        contentChecksum: "y",
      },
    ];
  });

  it("repairs slug titles with a version snapshot and refreshes only stale subtitles", async () => {
    const prisma = fakePrisma(rows);
    const res = await runContentHygiene(prisma as never, { titleLimit: 10, subtitleLimit: 10 });

    expect(res.titlesRepaired).toBe(1);
    const saint = rows.find((r) => r.id === "a1")!;
    expect(saint.title).toBe("Our Lady of the Rosary of Chiquinquirá");
    expect(saint.version).toBe(2); // snapshotted + bumped
    expect(prisma.versions).toHaveLength(1);
    expect(prisma.checklistUpdates).toHaveLength(1);
    expect(saint.contentChecksum).toMatch(/^[0-9a-f]{16}$/);

    // The guide's subtitle was stale; the prayer's already matched → untouched.
    expect(res.subtitlesRefreshed).toBe(1);
    const guide = rows.find((r) => r.id === "a2")!;
    expect(guide.subtitle).toBe(
      generateContentSubtitle({
        contentType: "GUIDE",
        contentSubtype: null,
        fields: guide.payload,
      }),
    );
    expect(guide.subtitle).toBe("How to pray the Rosary");
  });

  it("is idempotent — a second sweep changes nothing", async () => {
    const prisma = fakePrisma(rows);
    await runContentHygiene(prisma as never, { titleLimit: 10, subtitleLimit: 10 });
    const again = await runContentHygiene(prisma as never, { titleLimit: 10, subtitleLimit: 10 });
    expect(again.titlesRepaired).toBe(0);
    expect(again.subtitlesRefreshed).toBe(0);
  });

  it("fails open when the database throws", async () => {
    const prisma = fakePrisma(rows);
    prisma.$queryRaw.mockRejectedValueOnce(new Error("boom"));
    prisma.publishedContent.findMany.mockRejectedValueOnce(new Error("boom"));
    const res = await runContentHygiene(prisma as never);
    expect(res.titlesRepaired).toBe(0);
    expect(res.subtitlesRefreshed).toBe(0);
  });
});
