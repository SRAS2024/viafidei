/**
 * Public display verifier — proves:
 *   1. Returns `visible: true` when the strict-public query finds
 *      the row.
 *   2. Returns `visible: false` with specific reasons when the row
 *      exists but is gate-blocked.
 *   3. Returns `visible: false` with `row_does_not_exist` when the
 *      row is absent.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { verifyPublicDisplay } from "@/lib/content-factory";

beforeEach(() => {
  resetPrismaMock();
});

describe("verifyPublicDisplay", () => {
  it("returns visible=true when the strict-public query finds the row", async () => {
    prismaMock.prayer.findFirst.mockResolvedValue({ id: "p1" });
    const result = await verifyPublicDisplay({ contentType: "Prayer", slug: "our-father" });
    expect(result.visible).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("explains a gate-block when status=PUBLISHED but publicRenderReady=false", async () => {
    // First pass: strict query misses.
    prismaMock.prayer.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "p2",
      status: "PUBLISHED",
      publicRenderReady: false,
      isThresholdEligible: true,
    });
    const result = await verifyPublicDisplay({ contentType: "Prayer", slug: "blocked" });
    expect(result.visible).toBe(false);
    expect(result.reasons).toContain("publicRenderReady_false");
  });

  it("returns row_does_not_exist when the row is absent", async () => {
    prismaMock.prayer.findFirst.mockResolvedValue(null);
    const result = await verifyPublicDisplay({ contentType: "Prayer", slug: "missing" });
    expect(result.visible).toBe(false);
    expect(result.reasons).toContain("row_does_not_exist");
  });

  it("reports the expected tab and full checks for a visible package", async () => {
    prismaMock.prayer.findFirst.mockResolvedValue({
      id: "p1",
      status: "PUBLISHED",
      publicRenderReady: true,
      isThresholdEligible: true,
    });
    const result = await verifyPublicDisplay({ contentType: "Prayer", slug: "our-father" });
    expect(result.visible).toBe(true);
    expect(result.expectedTab).toBe("prayers");
    expect(result.checks.publicQuery).toBe(true);
    expect(result.checks.correctTab).toBe(true);
    expect(result.checks.thresholdEligible).toBe(true);
    expect(result.checks.correctSubtype).toBe(true);
  });

  it("flags a wrong subtype when a Novena row lacks the Novena subtype", async () => {
    prismaMock.devotion.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "d1",
      status: "PUBLISHED",
      publicRenderReady: true,
      isThresholdEligible: true,
      subtype: null,
    });
    const result = await verifyPublicDisplay({ contentType: "Novena", slug: "some-novena" });
    expect(result.visible).toBe(false);
    expect(result.checks.correctSubtype).toBe(false);
    expect(result.reasons).toContain("wrong_subtype");
  });
});
