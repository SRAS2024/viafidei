import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import {
  checkAndRecordDomainFetch,
  policyForDomain,
  robotsAllowsPath,
} from "@/lib/ingestion/rate-limit-domain";

beforeEach(() => {
  resetPrismaMock();
});

describe("per-domain rate policy", () => {
  it("returns stricter limits for vatican.va than the default", () => {
    const p = policyForDomain("www.vatican.va");
    expect(p.requestsPerMinute).toBeLessThanOrEqual(30);
    expect(p.spacingMs).toBeGreaterThanOrEqual(2_000);
  });

  it("returns the default for unknown domains", () => {
    const p = policyForDomain("random.example.com");
    expect(p.requestsPerMinute).toBe(60);
    expect(p.spacingMs).toBe(1_000);
  });
});

describe("checkAndRecordDomainFetch", () => {
  it("allows the first request and creates the bucket", async () => {
    prismaMock.ingestionRateBucket.findUnique.mockResolvedValue(null);
    prismaMock.ingestionRateBucket.create.mockResolvedValue({});
    const r = await checkAndRecordDomainFetch("example.com");
    expect(r.allow).toBe(true);
    expect(prismaMock.ingestionRateBucket.create).toHaveBeenCalled();
  });

  it("denies when spacing has not elapsed", async () => {
    const now = new Date();
    prismaMock.ingestionRateBucket.findUnique.mockResolvedValue({
      domain: "example.com",
      windowStart: new Date(now.getTime() - 10),
      requestsInWindow: 1,
      lastRequestAt: new Date(now.getTime() - 100), // 100ms ago
      updatedAt: now,
    });
    const r = await checkAndRecordDomainFetch("example.com", {
      spacingMs: 1_000,
      now,
    });
    expect(r.allow).toBe(false);
    if (!r.allow) {
      expect(r.waitMs).toBeGreaterThan(0);
    }
  });

  it("denies when per-minute ceiling reached", async () => {
    const now = new Date();
    prismaMock.ingestionRateBucket.findUnique.mockResolvedValue({
      domain: "example.com",
      windowStart: new Date(now.getTime() - 30_000),
      requestsInWindow: 60,
      lastRequestAt: new Date(now.getTime() - 2_000),
      updatedAt: now,
    });
    const r = await checkAndRecordDomainFetch("example.com", {
      requestsPerMinute: 60,
      spacingMs: 1_000,
      now,
    });
    expect(r.allow).toBe(false);
  });

  it("rolls the window over after 60s", async () => {
    const now = new Date();
    prismaMock.ingestionRateBucket.findUnique.mockResolvedValue({
      domain: "example.com",
      windowStart: new Date(now.getTime() - 70_000),
      requestsInWindow: 60,
      lastRequestAt: new Date(now.getTime() - 70_000),
      updatedAt: now,
    });
    prismaMock.ingestionRateBucket.update.mockResolvedValue({});
    const r = await checkAndRecordDomainFetch("example.com", { now });
    expect(r.allow).toBe(true);
  });
});

describe("robotsAllowsPath", () => {
  it("allows when robotsTxt is null", () => {
    expect(robotsAllowsPath(null, "/anything")).toBe(true);
  });

  it("blocks when User-agent: * Disallow matches", () => {
    const robots = `User-agent: *\nDisallow: /private`;
    expect(robotsAllowsPath(robots, "/private/file")).toBe(false);
  });

  it("allows when no disallow rule matches", () => {
    const robots = `User-agent: *\nDisallow: /admin`;
    expect(robotsAllowsPath(robots, "/public/page")).toBe(true);
  });

  it("ignores rules for other user agents", () => {
    const robots = `User-agent: Googlebot\nDisallow: /no-google`;
    expect(robotsAllowsPath(robots, "/no-google/path")).toBe(true);
  });
});
