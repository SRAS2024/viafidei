/**
 * Admin PATCH /api/admin/sources/[id]
 *
 * Verifies the route accepts the new `discoveryFeedUrl` field so
 * the operator can opt a source into factory-native discovery via
 * the standard admin gate (CSRF + banned-device + admin auth).
 *
 * Also asserts the gate's surface: rejecting cross-origin requests,
 * rejecting non-admins, accepting same-origin admin requests.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

const requireAdminMock = vi.fn();
const writeAuditMock = vi.fn().mockResolvedValue(undefined);
const rateLimitMock = vi
  .fn()
  .mockResolvedValue({ ok: true, remaining: 10, resetAt: Date.now() + 60_000 });

vi.mock("@/lib/auth", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));
vi.mock("@/lib/audit", () => ({
  writeAudit: (...args: unknown[]) => writeAuditMock(...args),
}));
vi.mock("@/lib/security/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => rateLimitMock(...args),
  RATE_POLICIES: { adminWrite: { max: 60, windowMs: 60_000 } },
}));
vi.mock("@/lib/security/security-event-store", () => ({
  isDeviceBanned: vi.fn().mockResolvedValue(false),
  recordBannedDeviceHit: vi.fn(),
}));
vi.mock("@/lib/security/security-events", () => ({
  reportSecurityBreach: vi.fn(),
  reportSuspiciousActivity: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/db/client", () => ({ prisma: prismaMock }));

import type { NextRequest } from "next/server";

beforeEach(() => {
  resetPrismaMock();
  requireAdminMock.mockReset();
  writeAuditMock.mockClear();
  rateLimitMock.mockClear();
  rateLimitMock.mockResolvedValue({ ok: true, remaining: 10, resetAt: Date.now() + 60_000 });
  requireAdminMock.mockResolvedValue({ username: "admin", signedInAt: Date.now() });
  process.env.SESSION_SECRET = "test-session-secret-must-be-32-chars-long";
});

function buildReq(args: {
  id: string;
  body: unknown;
  origin?: string | null;
  host?: string;
}): NextRequest {
  const host = args.host ?? "viafidei.example.com";
  const url = `https://${host}/api/admin/sources/${args.id}`;
  const headers = new Headers({
    "content-type": "application/json",
    "x-forwarded-host": host,
    "x-forwarded-proto": "https",
  });
  if (args.origin) headers.set("origin", args.origin);
  const base = new Request(url, {
    method: "PATCH",
    headers,
    body: JSON.stringify(args.body),
  });
  return Object.assign(base, {
    nextUrl: new URL(url),
    cookies: { get: () => undefined },
  }) as unknown as NextRequest;
}

async function callPatch(args: {
  id: string;
  body: unknown;
  origin?: string;
  host?: string;
}): Promise<Response> {
  const { PATCH } = await import("@/app/api/admin/sources/[id]/route");
  return PATCH(buildReq(args), { params: Promise.resolve({ id: args.id }) });
}

describe("PATCH /api/admin/sources/[id]", () => {
  it("accepts discoveryFeedUrl and writes it through updateIngestionSource", async () => {
    prismaMock.ingestionSource.findUnique.mockResolvedValue({
      id: "src-1",
      host: "vatican.va",
      discoveryFeedUrl: null,
    });
    let updateData: Record<string, unknown> = {};
    prismaMock.ingestionSource.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        updateData = data;
        return { id: "src-1", host: "vatican.va", ...data };
      },
    );

    const res = await callPatch({
      id: "src-1",
      body: { discoveryFeedUrl: "https://vatican.va/sitemap.xml" },
      origin: "https://viafidei.example.com",
      host: "viafidei.example.com",
    });

    expect(res.status).toBe(200);
    expect(updateData.discoveryFeedUrl).toBe("https://vatican.va/sitemap.xml");
  });

  it("accepts discoveryFeedUrl=null (operator removing factory-native discovery)", async () => {
    prismaMock.ingestionSource.findUnique.mockResolvedValue({
      id: "src-2",
      host: "vatican.va",
      discoveryFeedUrl: "https://vatican.va/sitemap.xml",
    });
    let updateData: Record<string, unknown> = {};
    prismaMock.ingestionSource.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        updateData = data;
        return { id: "src-2", ...data };
      },
    );

    const res = await callPatch({
      id: "src-2",
      body: { discoveryFeedUrl: null },
      origin: "https://viafidei.example.com",
      host: "viafidei.example.com",
    });

    expect(res.status).toBe(200);
    expect(updateData.discoveryFeedUrl).toBeNull();
  });

  it("rejects discoveryFeedUrl that isn't a valid URL", async () => {
    const res = await callPatch({
      id: "src-1",
      body: { discoveryFeedUrl: "not a url" },
      origin: "https://viafidei.example.com",
      host: "viafidei.example.com",
    });
    expect(res.status).toBe(400);
  });

  it("rejects cross-origin PATCH with a 403 CSRF block", async () => {
    const res = await callPatch({
      id: "src-1",
      body: { discoveryFeedUrl: "https://vatican.va/sitemap.xml" },
      origin: "https://evil.example.com",
      host: "viafidei.example.com",
    });
    expect(res.status).toBe(403);
  });

  it("rejects non-admin callers with 401", async () => {
    requireAdminMock.mockResolvedValue(null);
    const res = await callPatch({
      id: "src-1",
      body: { discoveryFeedUrl: "https://vatican.va/sitemap.xml" },
      origin: "https://viafidei.example.com",
      host: "viafidei.example.com",
    });
    expect(res.status).toBe(401);
  });
});
