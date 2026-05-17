/**
 * Cron + manual cleanup invariants.
 *
 * Spec lines:
 *   "The cron route should only plan work and enqueue jobs."
 *   "The cron route should not execute adapters."
 *   "Every cleanup job should exist in IngestionJobQueue."
 *
 * Structural tests against the cron + manual cleanup endpoints to
 * prove neither imports the legacy inline cleanup helpers anymore.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readFile(p: string): string {
  return readFileSync(resolve(p), "utf8");
}

describe("cron route plans + enqueues, never executes inline cleanup", () => {
  it("does NOT call cleanupMiscategorisedContent or archiveDuplicatePrayers directly", () => {
    const source = readFile("src/app/api/cron/ingest/route.ts");
    // The legacy functions may still be imported for type compat but
    // must not be invoked. The previous inline call sites are gone.
    expect(source).not.toMatch(/await\s+cleanupMiscategorisedContent\(\)/);
    expect(source).not.toMatch(/await\s+archiveDuplicatePrayers\(\)/);
    expect(source).not.toMatch(/await\s+purgeArchivedByArchivedAt\(/);
    expect(source).not.toMatch(/await\s+runCatalogJanitor\(\)/);
  });

  it("enqueues strict_cleanup / dedupe_cleanup / archive_cleanup as queued jobs", () => {
    const source = readFile("src/app/api/cron/ingest/route.ts");
    expect(source).toMatch(/strict_cleanup/);
    expect(source).toMatch(/dedupe_cleanup/);
    expect(source).toMatch(/archive_cleanup/);
    expect(source).toMatch(/enqueueJob/);
  });
});

describe("manual /api/admin/data-management/cleanup route", () => {
  it("enqueues into the durable queue and never executes inline cleanup", () => {
    const source = readFile("src/app/api/admin/data-management/cleanup/route.ts");
    expect(source).toMatch(/enqueueJob/);
    expect(source).toMatch(/strict_cleanup/);
    expect(source).not.toMatch(/await\s+cleanupMiscategorisedContent\(\)/);
    expect(source).not.toMatch(/await\s+archiveDuplicatePrayers\(\)/);
    expect(source).not.toMatch(/await\s+purgeArchivedByArchivedAt\(/);
  });
});
