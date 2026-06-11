/**
 * Internet Archive (Wayback) fetch fallback — the anti-stuck capability for the
 * live pipeline. These tests pin: the availability lookup (id_ raw-content URL,
 * unavailable → null), the gating (off in skip-network / opt-out), and the
 * fetcher integration (a dead 404 page is rescued from the archive with
 * finalUrl honestly set to web.archive.org; rescue declines a login-page
 * snapshot; no rescue when disabled).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/checklist", () => ({
  isApprovedAuthorityHost: vi.fn(() => true),
  isFetchableHost: vi.fn(() => true),
}));
vi.mock("@/lib/admin-worker/source-reputation", () => ({
  recordSourceOutcome: vi.fn(async () => undefined),
}));
vi.mock("@/lib/admin-worker/logs", () => ({
  writeAdminWorkerLog: vi.fn(async () => undefined),
}));

import type { PrismaClient } from "@prisma/client";

import {
  archiveFallbackEnabled,
  findArchivedSnapshotUrl,
} from "@/lib/admin-worker/archive-fallback";
import { adminWorkerFetch } from "@/lib/admin-worker/fetcher";

const KEYS = ["ADMIN_WORKER_SKIP_NETWORK", "ADMIN_WORKER_ARCHIVE_FALLBACK"];
let saved: Record<string, string | undefined>;
const realFetch = global.fetch;

beforeEach(() => {
  saved = {};
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  global.fetch = realFetch;
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    url: "",
    headers: { get: () => null },
    json: async () => data,
  };
}

function htmlResponse(body: string, url: string) {
  return {
    ok: true,
    status: 200,
    url,
    headers: { get: (h: string) => (h === "content-type" ? "text/html" : null) },
    text: async () => body,
  };
}

function notFoundResponse() {
  return {
    ok: false,
    status: 404,
    url: "",
    headers: { get: () => null },
  };
}

const PAGE = `<html><body>${"<p>Encyclical text paragraph.</p>".repeat(40)}</body></html>`;
const AVAILABLE = {
  archived_snapshots: {
    closest: {
      available: true,
      url: "http://web.archive.org/web/20230101000000/https://www.vatican.va/doc.html",
      timestamp: "20230101000000",
      status: "200",
    },
  },
};

describe("findArchivedSnapshotUrl", () => {
  it("returns the id_ raw-content snapshot URL when available", async () => {
    global.fetch = vi.fn(async () => jsonResponse(AVAILABLE)) as unknown as typeof global.fetch;
    const url = await findArchivedSnapshotUrl("https://www.vatican.va/doc.html");
    expect(url).toBe(
      "https://web.archive.org/web/20230101000000id_/https://www.vatican.va/doc.html",
    );
  });

  it("returns null when no snapshot exists", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ archived_snapshots: {} }),
    ) as unknown as typeof global.fetch;
    expect(await findArchivedSnapshotUrl("https://www.vatican.va/doc.html")).toBeNull();
  });

  it("is disabled in skip-network and via opt-out", async () => {
    process.env.ADMIN_WORKER_SKIP_NETWORK = "1";
    expect(archiveFallbackEnabled()).toBe(false);
    delete process.env.ADMIN_WORKER_SKIP_NETWORK;
    process.env.ADMIN_WORKER_ARCHIVE_FALLBACK = "0";
    expect(archiveFallbackEnabled()).toBe(false);
  });
});

function makePrisma() {
  return {
    adminWorkerFetchResult: {
      create: vi.fn(async () => ({ id: "f1" })),
    },
  } as unknown as PrismaClient;
}

describe("adminWorkerFetch — archive rescue", () => {
  it("rescues a 404 page from the Wayback Machine (finalUrl = archive URL)", async () => {
    const calls: string[] = [];
    global.fetch = vi.fn(async (input: string | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("archive.org/wayback/available")) return jsonResponse(AVAILABLE);
      if (url.includes("web.archive.org/web/"))
        return htmlResponse(
          PAGE,
          "https://web.archive.org/web/20230101000000id_/https://www.vatican.va/doc.html",
        );
      return notFoundResponse(); // the live URL
    }) as unknown as typeof global.fetch;

    const result = await adminWorkerFetch(makePrisma(), {
      url: "https://www.vatican.va/doc.html",
    });

    expect(result.succeeded).toBe(true);
    expect(result.finalUrl).toContain("web.archive.org");
    expect(result.body).toContain("Encyclical text paragraph.");
    expect(result.checksum).toBeTruthy();
    expect(calls.some((u) => u.includes("wayback/available"))).toBe(true);
  });

  it("does NOT rescue when the fallback is disabled (plain failure)", async () => {
    process.env.ADMIN_WORKER_ARCHIVE_FALLBACK = "0";
    global.fetch = vi.fn(async () => notFoundResponse()) as unknown as typeof global.fetch;

    const result = await adminWorkerFetch(makePrisma(), {
      url: "https://www.vatican.va/doc.html",
    });

    expect(result.succeeded).toBe(false);
    expect(result.errorClass).toBeTruthy();
    // Only the live fetch ran — no availability lookup.
    expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(1);
  });

  it("declines a snapshot that is itself a login page", async () => {
    const loginPage = `<html><form action="/login"><input type="password"/></form>${"<p>x</p>".repeat(100)}</html>`;
    global.fetch = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("archive.org/wayback/available")) return jsonResponse(AVAILABLE);
      if (url.includes("web.archive.org/web/")) return htmlResponse(loginPage, url);
      return notFoundResponse();
    }) as unknown as typeof global.fetch;

    const result = await adminWorkerFetch(makePrisma(), {
      url: "https://www.vatican.va/doc.html",
    });

    expect(result.succeeded).toBe(false);
  });
});
