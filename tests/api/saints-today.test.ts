import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));
vi.mock("@/lib/i18n/server", () => ({
  getTranslator: async () => ({ t: (k: string) => k, locale: "en" }),
}));

import { GET } from "@/app/api/saints/today/route";

function makeReq(query: Record<string, string> = {}): NextRequest {
  const url = new URL("https://app.example.com/api/saints/today");
  for (const [k, v] of Object.entries(query)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(new Request(url.toString()));
}

beforeEach(() => {
  resetPrismaMock();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/saints/today", () => {
  it("returns the matching saint list and total when rows match", async () => {
    prismaMock.saint.findMany
      .mockResolvedValueOnce([
        // structured match
        {
          id: "1",
          slug: "st-augustine-of-hippo",
          canonicalName: "St. Augustine of Hippo",
          biography: "Doctor of the Church.",
          patronages: [],
          feastDay: "August 28",
          feastMonth: 8,
          feastDayOfMonth: 28,
          status: "PUBLISHED",
          translations: [],
        },
      ])
      .mockResolvedValueOnce([]);

    const res = await GET(makeReq({ month: "8", day: "28" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.month).toBe(8);
    expect(body.day).toBe(28);
    expect(body.total).toBe(1);
    expect(body.items[0].slug).toBe("st-augustine-of-hippo");
  });

  it("returns 200 with a diagnostic kind=empty_catalog when no saints are PUBLISHED", async () => {
    prismaMock.saint.findMany.mockResolvedValue([]);
    prismaMock.saint.count.mockResolvedValue(0);
    const res = await GET(makeReq({ month: "8", day: "28" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(0);
    expect(body.diagnostic.kind).toBe("empty_catalog");
    expect(body.diagnostic.detail).toContain("PUBLISHED");
  });

  it("returns 200 with diagnostic kind=no_structured_fields when saints exist but lack month/day", async () => {
    prismaMock.saint.findMany.mockResolvedValue([]);
    prismaMock.saint.count
      .mockResolvedValueOnce(120) // total PUBLISHED
      .mockResolvedValueOnce(0); // total with structured fields
    const res = await GET(makeReq({ month: "8", day: "28" }));
    const body = await res.json();
    expect(body.diagnostic.kind).toBe("no_structured_fields");
    expect(body.diagnostic.detail).toContain("structured");
  });

  it("returns 200 with diagnostic kind=no_match_for_date when published saints exist but none today", async () => {
    prismaMock.saint.findMany.mockResolvedValue([]);
    prismaMock.saint.count
      .mockResolvedValueOnce(120) // total PUBLISHED
      .mockResolvedValueOnce(100); // structured fields populated
    const res = await GET(makeReq({ month: "2", day: "29" }));
    const body = await res.json();
    expect(body.diagnostic.kind).toBe("no_match_for_date");
  });

  it("rejects invalid month/day values with HTTP 400", async () => {
    const res = await GET(makeReq({ month: "13", day: "32" }));
    expect(res.status).toBe(400);
  });

  it("caps the response with ?take=N when provided", async () => {
    prismaMock.saint.findMany
      .mockResolvedValueOnce(
        Array.from({ length: 10 }, (_, i) => ({
          id: `s-${i}`,
          slug: `st-${i}`,
          canonicalName: `St. ${i}`,
          biography: "bio",
          patronages: [],
          feastDay: "August 28",
          feastMonth: 8,
          feastDayOfMonth: 28,
          status: "PUBLISHED",
          translations: [],
        })),
      )
      .mockResolvedValueOnce([]);

    const res = await GET(makeReq({ month: "8", day: "28", take: "3" }));
    const body = await res.json();
    expect(body.items).toHaveLength(3);
    expect(body.total).toBe(10);
  });
});
