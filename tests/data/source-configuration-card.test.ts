/**
 * Source configuration card data — proves the helper returns the
 * 12 spec-listed fields per active source and the
 * not-factory-native filter surfaces sources lacking a discovery
 * method.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import {
  listSourceConfigurationCards,
  listSourcesNotFactoryNative,
} from "@/lib/data/source-configuration-card";

beforeEach(() => {
  resetPrismaMock();
});

describe("listSourceConfigurationCards", () => {
  it("returns one card per active source with the spec-listed fields", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      {
        id: "src-1",
        name: "Vatican",
        host: "vatican.va",
        tier: 1,
        canIngestPrayers: true,
        canIngestSaints: true,
        canIngestApparitions: false,
        canIngestParishes: false,
        canIngestDevotions: false,
        canIngestNovenas: false,
        canIngestSacraments: false,
        canIngestRosaryGuides: false,
        canIngestConsecrations: false,
        canIngestSpiritualGuides: false,
        canIngestLiturgy: false,
        canIngestHistory: false,
        canProvideScriptureText: false,
        discoveryMethod: "sitemap",
        configurationStatus: "factory_native",
        configurationStatusReason: null,
      },
    ]);
    prismaMock.ingestionJobQueue.findFirst.mockResolvedValue(null);
    prismaMock.sourceDocument.findFirst.mockResolvedValue({ fetchedAt: new Date() });
    prismaMock.contentPackageBuildLog.findFirst.mockResolvedValue({ createdAt: new Date() });

    const cards = await listSourceConfigurationCards();

    expect(cards).toHaveLength(1);
    const c = cards[0];
    expect(c.name).toBe("Vatican");
    expect(c.host).toBe("vatican.va");
    expect(c.tier).toBe(1);
    expect(c.supportedContentTypes).toContain("Prayer");
    expect(c.supportedContentTypes).toContain("Saint");
    expect(c.discoveryMethod).toBe("sitemap");
    expect(c.configurationStatus).toBe("factory_native");
    expect(c.lastFetchAt).toBeInstanceOf(Date);
    expect(c.lastBuildAt).toBeInstanceOf(Date);
  });

  it("captures per-source errors instead of failing the whole list", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      {
        id: "src-2",
        name: "Bad",
        host: "bad.example",
        tier: 3,
        canIngestPrayers: true,
        canIngestSaints: false,
        canIngestApparitions: false,
        canIngestParishes: false,
        canIngestDevotions: false,
        canIngestNovenas: false,
        canIngestSacraments: false,
        canIngestRosaryGuides: false,
        canIngestConsecrations: false,
        canIngestSpiritualGuides: false,
        canIngestLiturgy: false,
        canIngestHistory: false,
        canProvideScriptureText: false,
        discoveryMethod: "not_configured",
        configurationStatus: "not_configured",
        configurationStatusReason: "No discovery feed URL set",
      },
    ]);
    prismaMock.ingestionJobQueue.findFirst.mockRejectedValue(new Error("db down"));
    prismaMock.sourceDocument.findFirst.mockRejectedValue(new Error("db down"));
    prismaMock.contentPackageBuildLog.findFirst.mockRejectedValue(new Error("db down"));

    const [card] = await listSourceConfigurationCards();

    expect(card.errors.length).toBeGreaterThan(0);
    expect(card.errors.some((e) => e.includes("db down"))).toBe(true);
  });
});

describe("listSourcesNotFactoryNative", () => {
  it("returns only sources with discoveryMethod null or not_configured", async () => {
    prismaMock.ingestionSource.findMany.mockResolvedValue([
      {
        id: "src-not",
        name: "Legacy",
        host: "legacy.example",
        configurationStatusReason: "No discovery feed URL set",
      },
    ]);
    const rows = await listSourcesNotFactoryNative();
    expect(rows).toHaveLength(1);
    expect(rows[0].host).toBe("legacy.example");
    expect(rows[0].reason).toMatch(/discovery feed/i);
  });
});
