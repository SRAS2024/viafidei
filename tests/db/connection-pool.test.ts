import { afterEach, describe, expect, it } from "vitest";

import { databaseUrlWithPool } from "@/lib/db/client";

const ORIG = { ...process.env };
afterEach(() => {
  process.env = { ...ORIG };
});

describe("databaseUrlWithPool (caps the Prisma pool to avoid P2037)", () => {
  it("adds a bounded connection_limit and pool_timeout when absent", () => {
    const out = databaseUrlWithPool("postgresql://u:p@host:5432/db");
    const url = new URL(out!);
    expect(url.searchParams.get("connection_limit")).toBe("5");
    expect(url.searchParams.get("pool_timeout")).toBe("20");
  });

  it("respects an explicit connection_limit already in the URL", () => {
    const out = databaseUrlWithPool("postgresql://u:p@host:5432/db?connection_limit=12");
    expect(new URL(out!).searchParams.get("connection_limit")).toBe("12");
  });

  it("honors PRISMA_CONNECTION_LIMIT override", () => {
    process.env.PRISMA_CONNECTION_LIMIT = "3";
    const out = databaseUrlWithPool("postgresql://u:p@host:5432/db");
    expect(new URL(out!).searchParams.get("connection_limit")).toBe("3");
  });

  it("returns undefined for a missing URL and passes through a non-URL DSN", () => {
    expect(databaseUrlWithPool(undefined)).toBeUndefined();
    expect(databaseUrlWithPool("not a url")).toBe("not a url");
  });
});
