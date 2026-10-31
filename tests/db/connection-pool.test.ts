import { afterEach, describe, expect, it } from "vitest";

import {
  databaseUrlWithPool,
  queryTimeoutsConfigured,
  withoutQueryTimeouts,
} from "@/lib/db/client";

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

describe("databaseUrlWithPool (query timeouts, opt-in per process)", () => {
  it("adds none unless the process asks: the web service and scripts are unchanged", () => {
    delete process.env.PRISMA_STATEMENT_TIMEOUT;
    delete process.env.PRISMA_SOCKET_TIMEOUT;
    const url = new URL(databaseUrlWithPool("postgresql://u:p@host:5432/db")!);
    expect(url.searchParams.has("options")).toBe(false);
    expect(url.searchParams.has("socket_timeout")).toBe(false);
    expect(queryTimeoutsConfigured()).toBe(false);
  });

  it("turns PRISMA_STATEMENT_TIMEOUT into a server-side statement_timeout and PRISMA_SOCKET_TIMEOUT into socket_timeout", () => {
    process.env.PRISMA_STATEMENT_TIMEOUT = "120";
    process.env.PRISMA_SOCKET_TIMEOUT = "150";
    const out = databaseUrlWithPool("postgresql://u:p@shinkansen.proxy.rlwy.net:12345/railway")!;
    const url = new URL(out);
    // Verified against Postgres 16 through Prisma 5.22: URLSearchParams' "+"
    // decodes to a space and SHOW statement_timeout reads back "2min".
    expect(url.searchParams.get("options")).toBe("-c statement_timeout=120s");
    expect(url.searchParams.get("socket_timeout")).toBe("150");
    expect(queryTimeoutsConfigured()).toBe(true);
  });

  it("treats blank, zero and junk as 'no timeout'", () => {
    for (const raw of ["", "0", "-1", "soon"]) {
      process.env.PRISMA_STATEMENT_TIMEOUT = raw;
      process.env.PRISMA_SOCKET_TIMEOUT = raw;
      const url = new URL(databaseUrlWithPool("postgresql://u:p@host:5432/db")!);
      expect(url.searchParams.has("options"), raw).toBe(false);
      expect(url.searchParams.has("socket_timeout"), raw).toBe(false);
    }
  });

  it("keeps explicit URL parameters, appending to existing options", () => {
    process.env.PRISMA_STATEMENT_TIMEOUT = "120";
    process.env.PRISMA_SOCKET_TIMEOUT = "150";
    const explicit = new URL(
      databaseUrlWithPool(
        "postgresql://u:p@host:5432/db?options=-c%20statement_timeout%3D5s&socket_timeout=9",
      )!,
    );
    expect(explicit.searchParams.get("options")).toBe("-c statement_timeout=5s");
    expect(explicit.searchParams.get("socket_timeout")).toBe("9");
    const appended = new URL(
      databaseUrlWithPool("postgresql://u:p@host:5432/db?options=-c%20search_path%3Dapp")!,
    );
    expect(appended.searchParams.get("options")).toBe(
      "-c search_path=app -c statement_timeout=120s",
    );
  });

  it("can build an untimed URL for the long statements that must not be cut off", () => {
    process.env.PRISMA_STATEMENT_TIMEOUT = "120";
    process.env.PRISMA_SOCKET_TIMEOUT = "150";
    const url = new URL(
      databaseUrlWithPool("postgresql://u:p@host:5432/db", {
        timeouts: false,
        connectionLimit: 2,
      })!,
    );
    expect(url.searchParams.has("options")).toBe(false);
    expect(url.searchParams.has("socket_timeout")).toBe(false);
    expect(url.searchParams.get("connection_limit")).toBe("2");
  });

  it("withoutQueryTimeouts hands back the shared client when no timeout is configured", async () => {
    delete process.env.PRISMA_STATEMENT_TIMEOUT;
    delete process.env.PRISMA_SOCKET_TIMEOUT;
    const shared = { tag: "shared" } as never;
    await expect(withoutQueryTimeouts(shared, async (db) => db)).resolves.toBe(shared);
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
