/**
 * listSourceQualityScores admin query.
 *
 * Spec line: "The source dashboard should show: Source discovered
 * count, fetched count, build success rate, QA pass rate, rejection
 * rate, deletion rate, duplicate rate, last successful valid package,
 * last failure reason, auto-pause status."
 *
 * Verifies the query returns the per-source rolling stats sorted by
 * worst-performing first.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { listSourceQualityScores } from "@/lib/content-factory";

beforeEach(() => {
  resetPrismaMock();
});

describe("listSourceQualityScores", () => {
  it("sorts by lowest validPackageRate first so the worst sources surface", async () => {
    prismaMock.sourceQualityScore.findMany.mockResolvedValue([
      { sourceId: "bad", contentType: "Prayer", validPackageRate: 0.2 },
      { sourceId: "ok", contentType: "Prayer", validPackageRate: 0.85 },
    ]);
    const rows = await listSourceQualityScores();
    expect(rows[0].sourceId).toBe("bad");
    const call = prismaMock.sourceQualityScore.findMany.mock.calls[0][0] as {
      orderBy: Array<Record<string, string>>;
    };
    expect(call.orderBy[0]).toEqual({ validPackageRate: "asc" });
  });

  it("scopes by contentType when given", async () => {
    prismaMock.sourceQualityScore.findMany.mockResolvedValue([]);
    await listSourceQualityScores({ contentType: "Saint" });
    const call = prismaMock.sourceQualityScore.findMany.mock.calls[0][0] as {
      where?: { contentType?: string };
    };
    expect(call.where?.contentType).toBe("Saint");
  });

  it("caps the limit at 500", async () => {
    prismaMock.sourceQualityScore.findMany.mockResolvedValue([]);
    await listSourceQualityScores({ limit: 99999 });
    const call = prismaMock.sourceQualityScore.findMany.mock.calls[0][0] as { take: number };
    expect(call.take).toBe(500);
  });
});
