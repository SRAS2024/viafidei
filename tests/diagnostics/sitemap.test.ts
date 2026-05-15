import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/client", () => ({
  prisma: {
    prayer: { findMany: vi.fn() },
    saint: { findMany: vi.fn() },
    marianApparition: { findMany: vi.fn() },
    devotion: { findMany: vi.fn() },
    liturgyEntry: { findMany: vi.fn() },
    parish: { findMany: vi.fn() },
    spiritualLifeGuide: { findMany: vi.fn() },
  },
}));

import { runSitemapDiagnostics } from "@/lib/diagnostics/sitemap";
import { prisma } from "@/lib/db/client";

beforeEach(() => {
  for (const model of Object.values(prisma)) {
    if (model && typeof model === "object") {
      for (const fn of Object.values(model)) {
        if (typeof fn === "function") (fn as ReturnType<typeof vi.fn>).mockReset();
      }
    }
  }
  // Default — no published rows so static entries dominate.
  for (const model of Object.values(prisma)) {
    (model as { findMany: ReturnType<typeof vi.fn> }).findMany.mockResolvedValue([]);
  }
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("runSitemapDiagnostics", () => {
  it("returns pass when sitemap, xml envelope, and robots are all healthy", async () => {
    // No baseUrl — skip reachability checks; only check sitemap shape + robots.
    const section = await runSitemapDiagnostics(null);
    expect(section.id).toBe("sitemap");
    const entries = section.results.find((r) => r.id === "sitemap.entries");
    expect(entries?.severity).toBe("pass");
    const xml = section.results.find((r) => r.id === "sitemap.xml_valid");
    expect(xml?.severity).toBe("pass");
    const robotsResult = section.results.find((r) => r.id === "sitemap.robots");
    expect(robotsResult?.severity).toBe("pass");
    expect(section.severity).toBe("pass");
  });

  it("shares a single requestId across every result in the section", async () => {
    const section = await runSitemapDiagnostics(null);
    expect(section.requestId).toMatch(/^[A-Za-z0-9_-]+$/);
    for (const r of section.results) {
      expect(r.requestId).toBe(section.requestId);
    }
  });

  it("stamps every result with an ISO timestamp and a duration", async () => {
    const section = await runSitemapDiagnostics(null);
    for (const r of section.results) {
      expect(typeof r.durationMs).toBe("number");
      expect(new Date(r.ranAt).toString()).not.toBe("Invalid Date");
    }
  });
});
