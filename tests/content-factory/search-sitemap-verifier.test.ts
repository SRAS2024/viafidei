/**
 * Search + sitemap verification — proves the helper checks each
 * surface and returns per-query reasons when the row is invisible.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { verifyIndexing } from "@/lib/content-factory/search-sitemap-verifier";

beforeEach(() => {
  resetPrismaMock();
});

describe("verifyIndexing", () => {
  it("returns visible-everywhere when each surface query finds the row", async () => {
    prismaMock.prayer.findFirst.mockResolvedValue({ id: "p1" });
    prismaMock.prayer.findMany.mockResolvedValue([{ id: "p1" }]);
    const result = await verifyIndexing({ contentType: "Prayer", slug: "our-father" });
    expect(result.visibleInPublicQuery).toBe(true);
    expect(result.visibleInSitemap).toBe(true);
    expect(result.visibleInSearch).toBe(true);
  });

  it("reports per-surface reasons when the row is missing", async () => {
    prismaMock.prayer.findFirst.mockResolvedValue(null);
    prismaMock.prayer.findMany.mockResolvedValue([]);
    const result = await verifyIndexing({ contentType: "Prayer", slug: "missing" });
    expect(result.visibleInPublicQuery).toBe(false);
    expect(result.reasons.public).toBe("not_in_strict_public_query");
    expect(result.reasons.search).toBe("not_in_search_query");
  });
});
