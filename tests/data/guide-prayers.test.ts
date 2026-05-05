import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import { resolveGuidePrayers } from "@/lib/data/guide-prayers";

beforeEach(() => {
  resetPrismaMock();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("resolveGuidePrayers — guide pages call DB content", () => {
  it("returns empty list for a guide with no mapped prayers", async () => {
    const out = await resolveGuidePrayers("not-mapped", "en");
    expect(out).toEqual([]);
  });

  it("returns DB rows when present and falls back to in-app text otherwise", async () => {
    // 'pater-noster' returned from DB; 'sign-of-the-cross' uses fallback.
    prismaMock.prayer.findMany.mockResolvedValue([
      {
        slug: "pater-noster",
        defaultTitle: "DB Our Father",
        body: "DB Our Father body.",
        translations: [],
      },
    ]);
    const out = await resolveGuidePrayers("how-to-pray-the-rosary", "en");
    const slugs = out.map((p) => p.slug);
    expect(slugs).toContain("pater-noster");
    expect(slugs).toContain("sign-of-the-cross");
    const fromDb = out.find((p) => p.slug === "pater-noster");
    expect(fromDb?.title).toBe("DB Our Father");
    const fromFallback = out.find((p) => p.slug === "sign-of-the-cross");
    expect(fromFallback?.body).toContain("In the name of the Father");
  });

  it("uses the locale translation when present (DB is canonical for guide content)", async () => {
    prismaMock.prayer.findMany.mockResolvedValue([
      {
        slug: "pater-noster",
        defaultTitle: "Our Father",
        body: "English body.",
        translations: [{ title: "Padre Nuestro", body: "Cuerpo en español." }],
      },
    ]);
    const out = await resolveGuidePrayers("how-to-pray-the-rosary", "es");
    const fromDb = out.find((p) => p.slug === "pater-noster");
    expect(fromDb?.title).toBe("Padre Nuestro");
    expect(fromDb?.body).toBe("Cuerpo en español.");
  });
});
