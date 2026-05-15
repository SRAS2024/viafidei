import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { runSaintsFeastDiagnostics } from "@/lib/diagnostics/saints-feast";

beforeEach(() => {
  resetPrismaMock();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runSaintsFeastDiagnostics", () => {
  it("reports FAIL when no saints are PUBLISHED", async () => {
    prismaMock.saint.count.mockResolvedValue(0);
    prismaMock.saint.findMany.mockResolvedValue([]);

    const section = await runSaintsFeastDiagnostics(new Date(Date.UTC(2026, 7, 28)));
    expect(section.severity).toBe("fail");
    const publishedCount = section.results.find((r) => r.id === "saints_feast.published_count");
    expect(publishedCount?.severity).toBe("fail");
  });

  it("reports PASS when matches are found for the date", async () => {
    prismaMock.saint.count
      // First: total published; Second: with structured fields
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(95)
      .mockResolvedValueOnce(5); // legacy
    prismaMock.saint.findMany
      .mockResolvedValueOnce([
        {
          id: "1",
          slug: "st-augustine",
          canonicalName: "St. Augustine",
          biography: "",
          patronages: [],
          feastDay: "August 28",
          feastMonth: 8,
          feastDayOfMonth: 28,
          status: "PUBLISHED",
          translations: [],
        },
      ])
      .mockResolvedValueOnce([])
      // The today_match check runs listSaintsForFeastDate again
      .mockResolvedValueOnce([
        {
          id: "1",
          slug: "st-augustine",
          canonicalName: "St. Augustine",
          biography: "",
          patronages: [],
          feastDay: "August 28",
          feastMonth: 8,
          feastDayOfMonth: 28,
          status: "PUBLISHED",
          translations: [],
        },
      ])
      .mockResolvedValueOnce([])
      // The api_route check runs it again
      .mockResolvedValueOnce([
        {
          id: "1",
          slug: "st-augustine",
          canonicalName: "St. Augustine",
          biography: "",
          patronages: [],
          feastDay: "August 28",
          feastMonth: 8,
          feastDayOfMonth: 28,
          status: "PUBLISHED",
          translations: [],
        },
      ])
      .mockResolvedValueOnce([]);

    const section = await runSaintsFeastDiagnostics(new Date(Date.UTC(2026, 7, 28)));
    const todayMatch = section.results.find((r) => r.id === "saints_feast.today_match");
    expect(todayMatch?.severity).toBe("pass");
    expect(todayMatch?.evidence?.total).toBe(1);
  });

  it("reports FAIL when no saints have structured feast fields", async () => {
    prismaMock.saint.count
      .mockResolvedValueOnce(50) // published total
      .mockResolvedValueOnce(50) // published count again
      .mockResolvedValueOnce(0) // structured count
      .mockResolvedValueOnce(50); // legacy count
    prismaMock.saint.findMany.mockResolvedValue([]);

    const section = await runSaintsFeastDiagnostics(new Date(Date.UTC(2026, 7, 28)));
    const coverage = section.results.find(
      (r) => r.id === "saints_feast.structured_fields_coverage",
    );
    expect(coverage?.severity).toBe("fail");
  });

  it("reports WARN when no saints match today's date", async () => {
    prismaMock.saint.count
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(0);
    prismaMock.saint.findMany.mockResolvedValue([]);

    const section = await runSaintsFeastDiagnostics(new Date(Date.UTC(2026, 1, 30)));
    const today = section.results.find((r) => r.id === "saints_feast.today_match");
    expect(today?.severity).toBe("warn");
  });
});
