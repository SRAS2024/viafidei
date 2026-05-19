/**
 * Production source registry loader (spec §1).
 *
 * Walks the curated PRODUCTION_SOURCE_REGISTRY and upserts every
 * entry into IngestionSource so a fresh deployment has working
 * sources on first boot. The loader is idempotent:
 *
 *   - For each registry entry, an IngestionSource row is created
 *     (when `host` is new) or updated (when the host exists).
 *   - Updates only touch the registry-managed fields. Operator
 *     overrides on other fields are preserved.
 *
 * Runs at app startup alongside the existing factory-source-setup
 * task. The two tasks are complementary:
 *
 *   - factory-source-setup adjusts existing rows (assigns
 *     discoveryMethod / configurationStatus based on current data).
 *   - production-source-registry-loader adds the curated registry
 *     entries the spec calls for.
 */

import { prisma } from "../db/client";
import { logger } from "../observability/logger";
import {
  PRODUCTION_SOURCE_REGISTRY,
  purposeFlagsForEntry,
  type ProductionSourceEntry,
} from "../ingestion/sources/production-source-registry";

export type RegistryLoadReport = {
  inspected: number;
  created: number;
  updated: number;
  unchanged: number;
  errors: number;
};

const REGISTRY_MANAGED_FIELDS = [
  "name",
  "baseUrl",
  "sourceType",
  "tier",
  "discoveryFeedUrl",
  "discoveryMethod",
  "configurationStatus",
  "role",
  "fetchLimitPerRun",
  "buildLimitPerRun",
  "dailyCap",
] as const;

function buildPayload(entry: ProductionSourceEntry) {
  const purposes = purposeFlagsForEntry(entry);
  return {
    name: entry.name,
    host: entry.host,
    baseUrl: entry.baseUrl,
    sourceType: entry.discoveryMethod === "factory_handler" ? "factory_handler" : "web",
    isOfficial: entry.tier === 1,
    isActive: true,
    tier: entry.tier,
    trustLabel: entry.tier === 1 ? "tier_1" : entry.tier === 2 ? "tier_2" : "tier_3",
    role: entry.role,
    discoveryMethod: entry.discoveryMethod,
    discoveryFeedUrl: entry.discoveryFeedUrl,
    configurationStatus:
      entry.discoveryMethod === "not_configured" ? "not_configured" : "factory_native",
    fetchLimitPerRun: entry.fetchLimitPerRun,
    buildLimitPerRun: entry.buildLimitPerRun,
    dailyCap: entry.dailyCap,
    notes: entry.notes ?? null,
    ...purposes,
  };
}

export async function loadProductionSourceRegistry(): Promise<RegistryLoadReport> {
  const report: RegistryLoadReport = {
    inspected: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    errors: 0,
  };
  for (const entry of PRODUCTION_SOURCE_REGISTRY) {
    report.inspected += 1;
    try {
      const existing = await prisma.ingestionSource.findUnique({
        where: { host: entry.host },
      });
      const payload = buildPayload(entry);
      if (!existing) {
        await prisma.ingestionSource.create({ data: payload });
        report.created += 1;
        logger.info("production-source-registry.created", {
          host: entry.host,
          name: entry.name,
        });
        continue;
      }
      // Compare just the registry-managed fields. If every one
      // matches, the row is already current.
      const changed = REGISTRY_MANAGED_FIELDS.some(
        (k) =>
          (existing as unknown as Record<string, unknown>)[k] !==
          (payload as unknown as Record<string, unknown>)[k],
      );
      if (!changed) {
        report.unchanged += 1;
        continue;
      }
      await prisma.ingestionSource.update({
        where: { host: entry.host },
        data: payload,
      });
      report.updated += 1;
      logger.info("production-source-registry.updated", {
        host: entry.host,
        name: entry.name,
      });
    } catch (e) {
      report.errors += 1;
      logger.warn("production-source-registry.upsert_failed", {
        host: entry.host,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  logger.info("production-source-registry.completed", report);
  return report;
}
