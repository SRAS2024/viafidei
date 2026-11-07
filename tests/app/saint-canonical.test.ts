/**
 * A saint hidden as a duplicate keeps its own page, and that page names the record
 * the list shows, while that record is live. The database is the only thing faked:
 * the slug read, the live-duplicate read and the metadata builder are the real ones.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const live = new Set<string>();
let duplicatesReadFails = false;

vi.mock("@/lib/db/client", () => ({
  prisma: {
    publishedContent: {
      findFirst: async ({ where }: { where: { slug: string } }) =>
        live.has(where.slug)
          ? {
              id: where.slug,
              checklistItemId: where.slug,
              contentType: "SAINT",
              slug: where.slug,
              title: `Title of ${where.slug}`,
              subtitle: null,
              payload: { summary: `Summary of ${where.slug}` },
              authorityLevel: "VATICAN",
              version: 1,
              publishedAt: null,
            }
          : null,
      findMany: async ({ where }: { where: { slug: { in: string[] } } }) => {
        if (duplicatesReadFails) throw new Error("database unreachable");
        return where.slug.in
          .filter((slug) => live.has(slug))
          .map((slug) => ({ slug, title: `Title of ${slug}` }));
      },
    },
  },
}));

import { generateMetadata } from "@/app/saints/[slug]/page";
import { memoClear } from "@/lib/cache/memo";
import { SAINT_DUPLICATE_OF } from "@/lib/content-shared/saints";

const metadataFor = (slug: string) => generateMetadata({ params: Promise.resolve({ slug }) });

const DUPLICATE = "saint-penitent-thief";
const KEPT = "saint-dismas";

describe("a saint's canonical link", () => {
  beforeEach(() => {
    live.clear();
    duplicatesReadFails = false;
    memoClear();
  });

  it("a hidden duplicate names the record it was hidden for", async () => {
    expect(SAINT_DUPLICATE_OF[DUPLICATE]).toBe(KEPT);
    live.add(DUPLICATE).add(KEPT);
    const metadata = await metadataFor(DUPLICATE);
    expect(metadata.alternates).toEqual({ canonical: `/saints/${KEPT}` });
    // The page goes on being itself: only the link is added.
    expect(metadata.title).toBe(`Title of ${DUPLICATE}`);
    expect(metadata.description).toBe(`Summary of ${DUPLICATE}`);
    expect(metadata.robots).toBeUndefined();
  });

  it("every hidden duplicate points at its own kept record", async () => {
    for (const [duplicate, kept] of Object.entries(SAINT_DUPLICATE_OF)) {
      live.add(duplicate).add(kept);
    }
    for (const [duplicate, kept] of Object.entries(SAINT_DUPLICATE_OF)) {
      expect((await metadataFor(duplicate)).alternates, duplicate).toEqual({
        canonical: `/saints/${kept}`,
      });
    }
  });

  it("a duplicate whose kept record is withdrawn stands alone", async () => {
    live.add(DUPLICATE);
    expect((await metadataFor(DUPLICATE)).alternates).toBeUndefined();
  });

  it("the kept record and an ordinary saint carry no link", async () => {
    live.add(DUPLICATE).add(KEPT).add("saint-peter");
    expect((await metadataFor(KEPT)).alternates).toBeUndefined();
    expect((await metadataFor("saint-peter")).alternates).toBeUndefined();
  });

  it("a failed read of the duplicates leaves the page's metadata whole, with no link", async () => {
    live.add(DUPLICATE).add(KEPT);
    duplicatesReadFails = true;
    const metadata = await metadataFor(DUPLICATE);
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.title).toBe(`Title of ${DUPLICATE}`);
  });

  it("a missing saint is still not found, before any of this", async () => {
    await expect(metadataFor("no-such-saint")).rejects.toThrow();
    await expect(metadataFor("constructor")).rejects.toThrow();
  });
});
