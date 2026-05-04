import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock prisma BEFORE importing sitemap.ts so the module picks up our fakes.
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

import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { prisma } from "@/lib/db/client";

const BASE = process.env.CANONICAL_URL || "https://etviafidei.com";

beforeEach(() => {
  for (const model of Object.values(prisma)) {
    for (const fn of Object.values(model as Record<string, unknown>)) {
      if (typeof fn === "function") (fn as ReturnType<typeof vi.fn>).mockReset();
    }
  }
  // Default — no published rows, so dynamic entries are empty unless a test
  // overrides this.
  for (const model of Object.values(prisma)) {
    (model as { findMany: ReturnType<typeof vi.fn> }).findMany.mockResolvedValue([]);
  }
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("sitemap()", () => {
  it("includes the public, indexable pages", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain(`${BASE}`);
    expect(urls).toContain(`${BASE}/prayers`);
    expect(urls).toContain(`${BASE}/devotions`);
    expect(urls).toContain(`${BASE}/saints`);
    expect(urls).toContain(`${BASE}/spiritual-life`);
    expect(urls).toContain(`${BASE}/spiritual-guidance`);
    expect(urls).toContain(`${BASE}/liturgy-history`);
    expect(urls).toContain(`${BASE}/search`);
    expect(urls).toContain(`${BASE}/privacy`);
  });

  it("excludes /admin and the admin login page", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).not.toContain(`${BASE}/admin`);
    expect(urls).not.toContain(`${BASE}/admin/login`);
    for (const url of urls) {
      expect(url).not.toMatch(/\/admin(\b|\/)/);
    }
  });

  it("excludes private auth and account pages", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).not.toContain(`${BASE}/login`);
    expect(urls).not.toContain(`${BASE}/register`);
    expect(urls).not.toContain(`${BASE}/forgot-password`);
    expect(urls).not.toContain(`${BASE}/reset-password`);
    expect(urls).not.toContain(`${BASE}/verify-email`);
    expect(urls).not.toContain(`${BASE}/profile`);
    expect(urls.some((u) => u.startsWith(`${BASE}/profile/`))).toBe(false);
  });

  it("includes published content detail pages with each row's updatedAt", async () => {
    const updatedAt = new Date("2025-01-15T12:00:00.000Z");
    (prisma.prayer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { slug: "anima-christi", updatedAt },
    ]);
    (prisma.saint.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { slug: "augustine", updatedAt },
    ]);
    (prisma.devotion.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { slug: "rosary", updatedAt },
    ]);

    const entries = await sitemap();
    const byUrl = new Map(entries.map((e) => [e.url, e]));
    expect(byUrl.has(`${BASE}/prayers/anima-christi`)).toBe(true);
    expect(byUrl.has(`${BASE}/saints/augustine`)).toBe(true);
    expect(byUrl.has(`${BASE}/devotions/rosary`)).toBe(true);

    expect(byUrl.get(`${BASE}/prayers/anima-christi`)?.lastModified).toEqual(updatedAt);
  });

  it("only queries PUBLISHED records (drafts/review/archived are excluded)", async () => {
    await sitemap();
    for (const model of [
      prisma.prayer,
      prisma.saint,
      prisma.marianApparition,
      prisma.devotion,
      prisma.liturgyEntry,
      prisma.parish,
      prisma.spiritualLifeGuide,
    ]) {
      const calls = (model.findMany as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls.length).toBe(1);
      expect(calls[0][0]).toMatchObject({ where: { status: "PUBLISHED" } });
    }
  });

  it("falls back to static-only entries when the database is unreachable", async () => {
    (prisma.prayer.findMany as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("ECONNREFUSED"),
    );
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.map((e) => e.url)).toContain(`${BASE}`);
  });

  it("produces entries that serialize to valid sitemap XML elements", async () => {
    (prisma.prayer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { slug: "te-deum", updatedAt: new Date("2025-03-01T00:00:00.000Z") },
    ]);
    const entries = await sitemap();
    // Build the XML the way Next's MetadataRoute serializer does and
    // confirm it's well-formed enough for Search Console.
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries
      .map(
        (e) =>
          `  <url><loc>${e.url}</loc>${
            e.lastModified
              ? `<lastmod>${
                  e.lastModified instanceof Date
                    ? e.lastModified.toISOString()
                    : new Date(e.lastModified).toISOString()
                }</lastmod>`
              : ""
          }</url>`,
      )
      .join("\n")}\n</urlset>`;
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain("<urlset");
    expect(xml).toContain("</urlset>");
    expect(xml).toContain(`<loc>${BASE}/prayers/te-deum</loc>`);
    expect(xml).toContain("<lastmod>2025-03-01T00:00:00.000Z</lastmod>");
  });
});

describe("robots()", () => {
  it("disallows /admin, /admin/login, and account pages", () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    const disallow = (rules?.disallow ?? []) as string[];
    expect(disallow).toContain("/admin");
    expect(disallow).toContain("/admin/login");
    expect(disallow).toContain("/profile");
    expect(disallow).toContain("/login");
    expect(disallow).toContain("/register");
    expect(disallow).toContain("/forgot-password");
    expect(disallow).toContain("/reset-password");
    expect(disallow).toContain("/verify-email");
  });

  it("points the sitemap URL at /sitemap.xml", () => {
    const r = robots();
    expect(r.sitemap).toBe(`${BASE}/sitemap.xml`);
  });
});
