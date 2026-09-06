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
    // Default raised to 10 to back the worker's concurrent lane set.
    expect(url.searchParams.get("connection_limit")).toBe("10");
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

describe("databaseUrlWithPool (TLS + connect timeout for internet-facing hosts)", () => {
  it("requires TLS and bounds the connect attempt for a Railway public proxy host", () => {
    const out = databaseUrlWithPool("postgresql://u:p@shinkansen.proxy.rlwy.net:12345/railway");
    const url = new URL(out!);
    expect(url.searchParams.get("sslmode")).toBe("require");
    expect(url.searchParams.get("connect_timeout")).toBe("15");
  });

  it("leaves localhost, loopback, private-network and Railway-internal hosts without forced TLS", () => {
    for (const host of ["localhost", "127.0.0.1", "10.0.0.5", "postgres.railway.internal"]) {
      const out = databaseUrlWithPool(`postgresql://u:p@${host}:5432/db`);
      expect(new URL(out!).searchParams.has("sslmode"), host).toBe(false);
    }
  });

  it("respects an explicit sslmode already in the URL", () => {
    const out = databaseUrlWithPool("postgresql://u:p@db.example.com:5432/db?sslmode=disable");
    expect(new URL(out!).searchParams.get("sslmode")).toBe("disable");
  });
});
