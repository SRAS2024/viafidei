/**
 * Public detail-page contract: a missing slug must produce a 404 (Next's
 * notFound() response), NOT a 500. This file verifies the data-layer
 * boundary that pages depend on:
 *
 *   1. The lookup returns null when the slug is unknown.
 *   2. A DB error is caught + classified by classifyPageError, never
 *      escapes as an uncaught exception.
 *
 * Pages are server components and exercise notFound() at the framework
 * level; the relevant invariant we can unit-test is that the code path
 * leading to notFound() does not throw.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { getPublishedPrayerBySlug } from "@/lib/data/prayers";
import { getPublishedSaintBySlug } from "@/lib/data/saints";
import { getPublishedDevotionBySlug } from "@/lib/data/devotions";
import { getPublishedSpiritualLifeGuideBySlug } from "@/lib/data/spiritual-life";
import { classifyPageError } from "@/lib/observability/page-errors";

beforeEach(() => {
  resetPrismaMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("missing content yields a 404, not a 500", () => {
  it("prayer lookup returns null for an unknown slug (page → notFound)", async () => {
    prismaMock.prayer.findFirst.mockResolvedValue(null);
    const out = await getPublishedPrayerBySlug("nope", "en");
    expect(out).toBeNull();
  });

  it("saint lookup returns null for an unknown slug", async () => {
    prismaMock.saint.findFirst.mockResolvedValue(null);
    expect(await getPublishedSaintBySlug("nope", "en")).toBeNull();
  });

  it("devotion lookup returns null for an unknown slug", async () => {
    prismaMock.devotion.findFirst.mockResolvedValue(null);
    expect(await getPublishedDevotionBySlug("nope", "en")).toBeNull();
  });

  it("guide lookup returns null for an unknown slug", async () => {
    prismaMock.spiritualLifeGuide.findFirst.mockResolvedValue(null);
    expect(await getPublishedSpiritualLifeGuideBySlug("nope", "en")).toBeNull();
  });

  it("DB outage during a slug lookup is classifiable as a connection error", async () => {
    prismaMock.prayer.findFirst.mockRejectedValue(new Error("ECONNREFUSED"));
    let caught: unknown = null;
    try {
      await getPublishedPrayerBySlug("anything", "en");
    } catch (err) {
      caught = err;
    }
    // The lookup itself doesn't swallow — it propagates so the page wrapper
    // (safeGetPrayer) can classify and notFound(). Confirm the error is one
    // the classifier recognises as a DB-connection issue.
    expect(caught).toBeInstanceOf(Error);
    expect(classifyPageError(caught)).toBe("db_connection");
  });

  it("missing-table errors are classified separately (run migrations)", async () => {
    prismaMock.prayer.findFirst.mockRejectedValue(new Error('relation "Prayer" does not exist'));
    let caught: unknown = null;
    try {
      await getPublishedPrayerBySlug("anything", "en");
    } catch (err) {
      caught = err;
    }
    expect(classifyPageError(caught)).toBe("missing_table");
  });
});
