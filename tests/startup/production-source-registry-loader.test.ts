/**
 * Production source registry loader tests (spec §1).
 *
 * Pins:
 *   - new hosts get created
 *   - existing hosts with stale registry-managed fields get updated
 *   - existing hosts already current are left unchanged (zero writes)
 *   - per-row errors don't break the rest of the loader
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { loadProductionSourceRegistry } from "@/lib/startup/production-source-registry-loader";
import { PRODUCTION_SOURCE_REGISTRY } from "@/lib/ingestion/sources/production-source-registry";

beforeEach(() => {
  resetPrismaMock();
});

describe("loadProductionSourceRegistry()", () => {
  it("creates every registry entry when none exist", async () => {
    prismaMock.ingestionSource.findUnique.mockResolvedValue(null);
    prismaMock.ingestionSource.create.mockResolvedValue({ id: "x" });
    const report = await loadProductionSourceRegistry();
    expect(report.inspected).toBe(PRODUCTION_SOURCE_REGISTRY.length);
    expect(report.created).toBe(PRODUCTION_SOURCE_REGISTRY.length);
    expect(prismaMock.ingestionSource.create).toHaveBeenCalledTimes(
      PRODUCTION_SOURCE_REGISTRY.length,
    );
  });

  it("leaves an existing row unchanged when the registry-managed fields already match", async () => {
    // Return a row whose registry-managed fields match the calling
    // registry entry exactly. The mock dispatches on the where clause's
    // host so each entry gets its matching shape.
    const byHost = new Map(PRODUCTION_SOURCE_REGISTRY.map((e) => [e.host, e]));
    prismaMock.ingestionSource.findUnique.mockImplementation(async (args: unknown) => {
      const host = (args as { where: { host: string } }).where.host;
      const entry = byHost.get(host);
      if (!entry) return null;
      return {
        name: entry.name,
        baseUrl: entry.baseUrl,
        sourceType: entry.discoveryMethod === "factory_handler" ? "factory_handler" : "web",
        tier: entry.tier,
        discoveryFeedUrl: entry.discoveryFeedUrl,
        discoveryMethod: entry.discoveryMethod,
        configurationStatus:
          entry.discoveryMethod === "not_configured" ? "not_configured" : "factory_native",
        role: entry.role,
        fetchLimitPerRun: entry.fetchLimitPerRun,
        buildLimitPerRun: entry.buildLimitPerRun,
        dailyCap: entry.dailyCap,
      };
    });
    const report = await loadProductionSourceRegistry();
    expect(report.unchanged).toBe(PRODUCTION_SOURCE_REGISTRY.length);
    expect(prismaMock.ingestionSource.create).not.toHaveBeenCalled();
    expect(prismaMock.ingestionSource.update).not.toHaveBeenCalled();
  });

  it("updates an existing row when a registry-managed field has drifted", async () => {
    prismaMock.ingestionSource.findUnique.mockImplementation(async () => ({
      name: "Stale Name",
      baseUrl: "https://stale.example",
      sourceType: "web",
      tier: 3, // drifted; registry says tier 1 for vatican.va
      discoveryFeedUrl: null,
      discoveryMethod: "not_configured",
      configurationStatus: "not_configured",
      role: "discovery_only_source",
      fetchLimitPerRun: null,
      buildLimitPerRun: null,
      dailyCap: null,
    }));
    prismaMock.ingestionSource.update.mockResolvedValue({ id: "u" });
    const report = await loadProductionSourceRegistry();
    expect(report.updated).toBe(PRODUCTION_SOURCE_REGISTRY.length);
    expect(prismaMock.ingestionSource.update).toHaveBeenCalledTimes(
      PRODUCTION_SOURCE_REGISTRY.length,
    );
  });

  it("counts per-row errors but does not halt the loader", async () => {
    prismaMock.ingestionSource.findUnique.mockRejectedValue(new Error("transient"));
    const report = await loadProductionSourceRegistry();
    expect(report.errors).toBe(PRODUCTION_SOURCE_REGISTRY.length);
    expect(report.inspected).toBe(PRODUCTION_SOURCE_REGISTRY.length);
  });
});
