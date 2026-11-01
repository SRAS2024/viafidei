/**
 * Pope catalogue accuracy: the ingestor must exclude antipopes (so the count
 * reflects the real line of Roman Pontiffs), and the cleanup must unpublish any
 * antipope rows an earlier version published.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-worker/structured/wikipedia", () => ({
  fetchSummaryForArticleUrl: vi.fn(async () => null),
}));
vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

import type { PrismaClient } from "@prisma/client";

import { ingestorFor } from "@/lib/admin-worker/structured/ingestors";
import { rejectionOf } from "@/lib/admin-worker/structured/reject";
import {
  pruneAntipopeRecords,
  pruneDuplicatePopeRecords,
  regnalIdentity,
} from "@/lib/admin-worker/pope-cleanup";
import type { SparqlBinding } from "@/lib/admin-worker/structured/wikidata";

const SKIP = "ADMIN_WORKER_SKIP_NETWORK";
let savedSkip: string | undefined;
beforeEach(() => {
  savedSkip = process.env[SKIP];
  process.env[SKIP] = "1"; // keep the pope mapper offline
});
afterEach(() => {
  if (savedSkip === undefined) delete process.env[SKIP];
  else process.env[SKIP] = savedSkip;
  vi.restoreAllMocks();
});

function row(over: Record<string, string>): SparqlBinding {
  const b: SparqlBinding = {};
  for (const [k, v] of Object.entries(over)) b[k] = { type: "literal", value: v };
  return b;
}
const popeMap = (r: SparqlBinding) => ingestorFor("POPE")!.map(r, {} as Record<string, never>);

describe("POPE ingestor — antipope exclusion", () => {
  it("publishes a real pope", async () => {
    const entry = await popeMap(
      row({ pope: "http://www.wikidata.org/entity/Q450", popeLabel: "Francis", startYear: "2013" }),
    );
    expect(entry).not.toBeNull();
    expect(entry!.payload.title).toBe("Pope Francis");
  });

  it("SKIPS an antipope (label contains 'antipope')", async () => {
    const entry = await popeMap(
      row({
        pope: "http://www.wikidata.org/entity/Q1",
        popeLabel: "Antipope John XXIII",
        startYear: "1410",
      }),
    );
    // Not merely dropped — dropped WITH a reason the pass histogram can count.
    expect(rejectionOf(entry)?.code).toBe("antipope_excluded");
  });
});

describe("POPE ingestor — the line of Roman Pontiffs, once each", () => {
  it("SKIPS Pope Joan, the unconsecrated Stephen of 752 and Benedict X", async () => {
    for (const [qid, label] of [
      ["Q243811", "Pope Joan"],
      ["Q383322", "Pope-elect Stephen"],
      ["Q117656", "Benedict X"],
    ]) {
      const entry = await popeMap(
        row({ pope: `http://www.wikidata.org/entity/${qid}`, popeLabel: label, startYear: "855" }),
      );
      expect(rejectionOf(entry)?.code).toBe("antipope_excluded");
    }
  });

  it("identifies a pope by the curated page that already covers him", () => {
    const identify = ingestorFor("POPE")!.identify!;
    expect(
      identify(row({ pope: "http://www.wikidata.org/entity/Q43954", popeLabel: "Leo I" }))?.slug,
    ).toBe("pope-saint-leo-the-great");
    expect(
      identify(row({ pope: "http://www.wikidata.org/entity/Q23873", popeLabel: "Pope John" }))
        ?.slug,
    ).toBe("pope-saint-john-xxiii");
    expect(
      identify(row({ pope: "http://www.wikidata.org/entity/Q450", popeLabel: "Francis" }))?.slug,
    ).toBe("pope-francis");
  });
});

describe("regnalIdentity", () => {
  it("reads the regnal name and number out of a title", () => {
    expect(regnalIdentity("Pope Saint Nicholas I (the Great)")).toEqual({
      name: "nicholas",
      ordinal: "i",
      specific: true,
    });
    expect(regnalIdentity("Pope Saint Leo the Great")).toEqual({
      name: "leo",
      ordinal: null,
      specific: true,
    });
    expect(regnalIdentity("Pope John Paul II")).toEqual({
      name: "john paul",
      ordinal: "ii",
      specific: true,
    });
    expect(regnalIdentity("Pope John")).toEqual({ name: "john", ordinal: null, specific: false });
  });
});

describe("pruneAntipopeRecords", () => {
  it("unpublishes live antipope rows and reports them", async () => {
    const updateMany = vi.fn(async () => ({ count: 2 }));
    const prisma = {
      publishedContent: {
        findMany: vi.fn(async () => [
          { id: "p1", title: "Antipope John XXIII" },
          { id: "p2", title: "Antipope Clement VII" },
        ]),
        updateMany,
      },
      adminWorkerLog: { create: vi.fn(async () => ({})) },
    } as unknown as PrismaClient;

    const result = await pruneAntipopeRecords(prisma);

    expect(result.pruned).toBe(2);
    expect(updateMany).toHaveBeenCalledTimes(1);
    const arg = updateMany.mock.calls[0][0] as {
      where: { id: { in: string[] } };
      data: { isPublished: boolean };
    };
    expect(arg.where.id.in).toEqual(["p1", "p2"]);
    expect(arg.data.isPublished).toBe(false);
  });

  it("is a clean no-op when there are no antipope rows", async () => {
    const updateMany = vi.fn();
    const prisma = {
      publishedContent: { findMany: vi.fn(async () => []), updateMany },
      adminWorkerLog: { create: vi.fn(async () => ({})) },
    } as unknown as PrismaClient;

    const result = await pruneAntipopeRecords(prisma);

    expect(result.pruned).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe("pruneDuplicatePopeRecords", () => {
  const t0 = new Date("2024-01-01T00:00:00Z");
  const t1 = new Date("2024-02-01T00:00:00Z");

  it("keeps the richest record and unpublishes same-pope duplicates", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const prisma = {
      publishedContent: {
        findMany: vi.fn(async () => [
          // Same pontiff under two slugs — the honorific differs, the regnal
          // identity ("john paul ii") is the same → one must be pruned.
          {
            id: "rich",
            title: "Pope Saint John Paul II",
            slug: "pope-john-paul-ii",
            payload: { a: 1, b: 2, c: 3 },
            createdAt: t1,
          },
          {
            id: "thin",
            title: "Pope John Paul II",
            slug: "pope-john-paul-ii-2",
            payload: { a: 1 },
            createdAt: t0,
          },
          // A distinct pope (different regnal number) must be left alone.
          {
            id: "benedict",
            title: "Pope Benedict XVI",
            slug: "pope-benedict-xvi",
            payload: { a: 1 },
            createdAt: t0,
          },
        ]),
        updateMany,
      },
      adminWorkerLog: { create: vi.fn(async () => ({})) },
    } as unknown as PrismaClient;

    const result = await pruneDuplicatePopeRecords(prisma);

    expect(result.pruned).toBe(1);
    expect(updateMany).toHaveBeenCalledTimes(1);
    const arg = updateMany.mock.calls[0][0] as {
      where: { id: { in: string[] } };
      data: { isPublished: boolean };
    };
    // The thinner payload loses even though it was created first.
    expect(arg.where.id.in).toEqual(["thin"]);
    expect(arg.data.isPublished).toBe(false);
  });

  it("collapses one pope published under his epithet and his regnal name", async () => {
    const updateMany = vi.fn(async () => ({ count: 2 }));
    const pope = (
      id: string,
      title: string,
      start: string,
      end: string,
      sourceRef: string | null,
      fields = 1,
    ) => ({
      id,
      title,
      slug: `pope-${id}`,
      sourceRef,
      payload: {
        papacyStart: start,
        papacyEnd: end,
        ...Object.fromEntries(Array.from({ length: fields }, (_, i) => [`f${i}`, i])),
      },
      createdAt: t0,
    });
    const WD = "https://www.wikidata.org/wiki/Q";
    const prisma = {
      publishedContent: {
        findMany: vi.fn(async () => [
          pope("leo-great", "Pope Saint Leo the Great", "440", "461", null),
          // Richer, but built from Wikidata: the hand-checked page stays.
          pope("leo-i", "Pope Leo I", "440", "461", `${WD}43954`, 5),
          pope("john-xxiii", "Pope Saint John XXIII", "1958", "1963", null),
          // A bare name loses to the title that says which John.
          pope("john", "Pope John", "1958", "1963", `${WD}23873`, 5),
          // Same years, different popes: names differ, or numbers disagree.
          pope("adrian-v", "Pope Adrian V", "1276", "1276", `${WD}1`),
          pope("innocent-v", "Pope Innocent V", "1276", "1276", `${WD}2`),
          pope("john-xvii", "Pope John XVII", "1003", "1003", `${WD}3`),
          pope("john-xvii-b", "Pope John XVIII", "1003", "1003", `${WD}4`),
          // Same name, different reign: Stephen II is not the Stephen of 752.
          pope("stephen-ii", "Pope Stephen II", "752", "757", `${WD}5`),
          pope("stephen-elect", "Pope Stephen", "752", "752", `${WD}6`),
        ]),
        updateMany,
      },
      adminWorkerLog: { create: vi.fn(async () => ({})) },
    } as unknown as PrismaClient;

    const result = await pruneDuplicatePopeRecords(prisma);

    expect(result.pruned).toBe(2);
    const arg = updateMany.mock.calls[0][0] as { where: { id: { in: string[] } } };
    expect(arg.where.id.in.sort()).toEqual(["john", "leo-i"]);
  });

  it("is a clean no-op when every pope is unique", async () => {
    const updateMany = vi.fn();
    const prisma = {
      publishedContent: {
        findMany: vi.fn(async () => [
          {
            id: "a",
            title: "Pope Francis",
            slug: "pope-francis",
            payload: { a: 1 },
            createdAt: t0,
          },
          {
            id: "b",
            title: "Pope Leo XIV",
            slug: "pope-leo-xiv",
            payload: { a: 1 },
            createdAt: t0,
          },
        ]),
        updateMany,
      },
      adminWorkerLog: { create: vi.fn(async () => ({})) },
    } as unknown as PrismaClient;

    const result = await pruneDuplicatePopeRecords(prisma);

    expect(result.pruned).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
