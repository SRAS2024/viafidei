/**
 * Address-based parish duplicate detection: the fingerprint normalizer folds the
 * spelling differences that make the same place look like two ("St." vs "Saint",
 * "Street" vs "St", accents, punctuation), and the lookup finds an already-
 * published parish at the same address.
 */
import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@prisma/client";

import {
  parishAddressKey,
  findPublishedParishByAddressKey,
} from "@/lib/admin-worker/parish-address";

describe("parishAddressKey", () => {
  it("collapses abbreviation + accent + punctuation differences to one key", () => {
    const a = parishAddressKey({ address: "123 Main Street", city: "St. Louis", state: "MO" });
    const b = parishAddressKey({ address: "123 Main St.", city: "Saint Louis", state: "mo" });
    expect(a).toBe(b);
    expect(a).toContain("123 main st");
  });

  it("distinguishes genuinely different addresses", () => {
    const a = parishAddressKey({ address: "123 Main St", city: "Boston" });
    const b = parishAddressKey({ address: "456 Main St", city: "Boston" });
    expect(a).not.toBe(b);
  });

  it("returns an empty key when there is nothing to fingerprint", () => {
    expect(parishAddressKey({})).toBe("");
    expect(parishAddressKey({ address: "   " })).toBe("");
  });
});

describe("findPublishedParishByAddressKey", () => {
  it("returns null (and never queries) for an empty key", async () => {
    const findFirst = vi.fn(async () => null);
    const prisma = { publishedContent: { findFirst } } as unknown as PrismaClient;
    expect(await findPublishedParishByAddressKey(prisma, "")).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("looks up a published parish by the addressKey JSON path", async () => {
    const findFirst = vi.fn(async () => ({ id: "x1", slug: "st-mary", title: "St. Mary" }));
    const prisma = { publishedContent: { findFirst } } as unknown as PrismaClient;
    const hit = await findPublishedParishByAddressKey(prisma, "123 main st boston", {
      excludeSlug: "other",
    });
    expect(hit?.slug).toBe("st-mary");
    const where = (findFirst.mock.calls[0]![0] as { where: Record<string, unknown> }).where;
    expect(where.isPublished).toBe(true);
    expect(where.payload).toEqual({ path: ["addressKey"], equals: "123 main st boston" });
    expect(where.slug).toEqual({ not: "other" });
  });
});
