/**
 * Content-coverage self-knowledge. The worker maps published items per
 * (contentType, subtype) against the catalog's declared subtypes so it can fill
 * every subtype — not just hit a type's numeric target. These pin the pure
 * model build, the missing-target ranking (neediest type first), the rotation
 * picker, and the IO seam.
 */
import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@prisma/client";
import {
  buildCoverageModel,
  computeCoverageModel,
  pickCoverageTarget,
  type CoverageCountRow,
} from "@/lib/admin-worker/coverage-model";
import { CONTENT_TYPE_CATALOG } from "@/lib/admin-worker/skills/catalog";

const PRAYER_SUBTYPES = CONTENT_TYPE_CATALOG.find((c) => c.type === "PRAYER")?.subtypes ?? [];
const NOVENA_SUBTYPES = CONTENT_TYPE_CATALOG.find((c) => c.type === "NOVENA")?.subtypes ?? [];

describe("buildCoverageModel", () => {
  it("reports full coverage when every declared subtype has an item", () => {
    const rows: CoverageCountRow[] = CONTENT_TYPE_CATALOG.flatMap((spec) =>
      spec.subtypes.map((s) => ({ contentType: spec.type, subtype: s, count: 3 })),
    );
    const model = buildCoverageModel(rows);
    expect(model.prioritizedMissing).toHaveLength(0);
    expect(model.nextTarget).toBeNull();
    expect(model.subtypesPresent).toBe(model.subtypesTotal);
    expect(model.summary).toMatch(/all .* declared subtypes/i);
  });

  it("flags a missing subtype even when the type already has published items", () => {
    // PRAYER has items in one subtype but the others are empty.
    const rows: CoverageCountRow[] = [
      { contentType: "PRAYER", subtype: "common_prayer", count: 50 },
    ];
    const model = buildCoverageModel(rows);
    const prayer = model.types.find((t) => t.contentType === "PRAYER")!;
    expect(prayer.published).toBe(50);
    expect(prayer.missingSubtypes).toEqual(PRAYER_SUBTYPES.filter((s) => s !== "common_prayer"));
    // A type with 50 published can still owe subtype coverage.
    expect(model.prioritizedMissing.some((t) => t.contentType === "PRAYER")).toBe(true);
  });

  it("ranks a needier type's missing subtypes ahead of a well-served type's", () => {
    const rows: CoverageCountRow[] = [
      { contentType: "PRAYER", subtype: "common_prayer", count: 100 }, // well served
      { contentType: "NOVENA", subtype: "novena_day", count: 1 }, // barely served
    ];
    const model = buildCoverageModel(rows);
    // Types with zero published correctly lead overall; between these two,
    // NOVENA (1 published) must rank ahead of PRAYER (100 published).
    const idx = (ct: string) => model.prioritizedMissing.findIndex((t) => t.contentType === ct);
    expect(idx("NOVENA")).toBeGreaterThanOrEqual(0);
    expect(idx("PRAYER")).toBeGreaterThanOrEqual(0);
    expect(idx("NOVENA")).toBeLessThan(idx("PRAYER"));
    // The single neediest target overall is a totally-empty type (0 published).
    const top = model.types.find((t) => t.contentType === model.nextTarget?.contentType)!;
    expect(top.published).toBe(0);
  });

  it("counts untagged published rows for a multi-subtype type", () => {
    const rows: CoverageCountRow[] = [
      { contentType: "PRAYER", subtype: null, count: 7 },
      ...PRAYER_SUBTYPES.map((s) => ({ contentType: "PRAYER", subtype: s, count: 2 })),
    ];
    const prayer = buildCoverageModel(rows).types.find((t) => t.contentType === "PRAYER")!;
    expect(prayer.untagged).toBe(7);
    expect(prayer.missingSubtypes).toHaveLength(0);
  });

  it("never invents missing targets for types with no declared subtypes", () => {
    // SACRAMENT has no subtypes in the catalog.
    const model = buildCoverageModel([{ contentType: "SACRAMENT", subtype: null, count: 7 }]);
    expect(model.prioritizedMissing.some((t) => t.contentType === "SACRAMENT")).toBe(false);
  });
});

describe("pickCoverageTarget", () => {
  it("rotates past recently-targeted pairs", () => {
    const model = buildCoverageModel([{ contentType: "NOVENA", subtype: "novena_day", count: 1 }]);
    const first = model.nextTarget!;
    const key = `${first.contentType}/${first.subtype}`;
    const next = pickCoverageTarget(model, new Set([key]));
    // With the top target excluded, it picks a different missing pair.
    expect(next).not.toBeNull();
    expect(`${next!.contentType}/${next!.subtype}`).not.toBe(key);
  });

  it("falls back to the top target when all were recently attempted", () => {
    const model = buildCoverageModel([{ contentType: "NOVENA", subtype: "novena_day", count: 1 }]);
    const all = new Set(model.prioritizedMissing.map((t) => `${t.contentType}/${t.subtype}`));
    expect(pickCoverageTarget(model, all)).toEqual(model.prioritizedMissing[0]);
  });

  it("returns null when nothing is missing", () => {
    const full = CONTENT_TYPE_CATALOG.flatMap((spec) =>
      spec.subtypes.map((s) => ({ contentType: spec.type, subtype: s, count: 1 })),
    );
    expect(pickCoverageTarget(buildCoverageModel(full))).toBeNull();
  });
});

describe("computeCoverageModel (IO seam)", () => {
  it("builds from a raw grouped query and is fail-open", async () => {
    const queryRaw = vi.fn(async () => [
      { contentType: "PRAYER", subtype: "common_prayer", count: 5 },
    ]);
    const prisma = { $queryRaw: queryRaw } as unknown as PrismaClient;
    const model = await computeCoverageModel(prisma);
    expect(queryRaw).toHaveBeenCalled();
    expect(model.types.find((t) => t.contentType === "PRAYER")?.published).toBe(5);
  });

  it("degrades to an empty-count model when the query throws", async () => {
    const prisma = {
      $queryRaw: vi.fn(async () => {
        throw new Error("db down");
      }),
    } as unknown as PrismaClient;
    const model = await computeCoverageModel(prisma);
    // No counts → every declared subtype is missing, but it never throws.
    expect(model.subtypesPresent).toBe(0);
    expect(model.nextTarget).not.toBeNull();
  });
});
