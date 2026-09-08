/**
 * Spec item 10 — proof that the last 13 admin routes now honour the ONE
 * admin authorization contract.
 *
 * These routes used to guard themselves with a bare `requireAdmin()`. They
 * authenticated, but they skipped CSRF and the banned-device block, so a
 * cross-site POST from an admin's browser (or a request from a device the
 * app had already banned) reached the handler. They now call
 * `gateAdminApiCall` — the same helper every other admin route uses, not a
 * second admin auth path.
 *
 * `tests/security/admin-gate-coverage.test.ts` proves STATICALLY that no
 * admin route bypasses the gate. This suite proves it BEHAVIOURALLY, per
 * route, for the four outcomes that matter:
 *
 *   1. an unauthenticated caller is refused (401) and no work runs;
 *   2. a mutating call with a MISSING Origin/Referer is refused (403), and
 *      with a cross-origin one too — before admin auth is even consulted;
 *   3. a banned device is refused (403) and no work runs;
 *   4. a properly authenticated, same-origin admin still SUCCEEDS.
 *
 * (4) is the point of the suite as much as (1)–(3): the risk in this change
 * is breaking the happy path of ten working admin buttons.
 *
 * The read-only routes get the same gate. Their CSRF stage is a documented
 * no-op because `evaluateCsrf` passes safe methods through, so no "read-only
 * variant" of the gate was needed — the suite pins that a GET with a foreign
 * Origin still succeeds rather than being wrongly refused.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

const requireAdminMock = vi.fn();

const listAuditLogsMock = vi.fn();
const runAllDiagnosticsMock = vi.fn();
const listAdminUsersMock = vi.fn();

const addCitationMock = vi.fn();
const approveForBuildMock = vi.fn();
const enqueueBuildMock = vi.fn();
const rejectItemMock = vi.fn();
const unpublishMock = vi.fn();
const markSourceVerifiedMock = vi.fn();
const bulkRejectMock = vi.fn();
const bulkVerifyAllMock = vi.fn();
const seedChecklistFirstMock = vi.fn();

/**
 * The shared prisma mock does not carry a ChecklistItem delegate, and this
 * suite is not the place to grow it. Two of the handlers flip
 * `approvalStatus` directly, so extend the mock locally instead.
 */
const { checklistItemUpdateMock } = vi.hoisted(() => ({ checklistItemUpdateMock: vi.fn() }));

/** The shared prisma mock plus that delegate. Built inside the factories
 * below because a `vi.mock` factory is hoisted above module-level consts. */
function dbMock() {
  return { ...prismaMock, checklistItem: { update: checklistItemUpdateMock } };
}

vi.mock("@/lib/auth", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));
vi.mock("@/lib/security/security-events", () => ({
  reportSecurityBreach: vi.fn(),
  reportSuspiciousActivity: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: dbMock() }));
vi.mock("@/lib/db/client", () => ({ prisma: dbMock() }));

vi.mock("@/lib/data/audit-log", () => ({
  listAuditLogs: (...args: unknown[]) => listAuditLogsMock(...args),
}));
vi.mock("@/lib/diagnostics", () => ({
  runAllDiagnostics: (...args: unknown[]) => runAllDiagnosticsMock(...args),
}));
vi.mock("@/lib/data/admin-users", () => ({
  listAdminUsers: (...args: unknown[]) => listAdminUsersMock(...args),
}));
vi.mock("@/lib/checklist", () => ({
  addCitation: (...args: unknown[]) => addCitationMock(...args),
  approveForBuild: (...args: unknown[]) => approveForBuildMock(...args),
  enqueueBuild: (...args: unknown[]) => enqueueBuildMock(...args),
  rejectItem: (...args: unknown[]) => rejectItemMock(...args),
  unpublish: (...args: unknown[]) => unpublishMock(...args),
  markSourceVerified: (...args: unknown[]) => markSourceVerifiedMock(...args),
  bulkReject: (...args: unknown[]) => bulkRejectMock(...args),
  bulkVerifyAll: (...args: unknown[]) => bulkVerifyAllMock(...args),
}));
vi.mock("@/lib/checklist/seed", () => ({
  seedChecklistFirst: (...args: unknown[]) => seedChecklistFirstMock(...args),
}));

import type { NextRequest } from "next/server";
import { _resetAdminScanCountersForTests } from "@/lib/security/admin-route-scanner";

import { GET as auditGET } from "@/app/api/admin/audit/route";
import { GET as diagnosticsGET } from "@/app/api/admin/diagnostics/route";
import { GET as usersGET } from "@/app/api/admin/users/route";
import { POST as addCitationPOST } from "@/app/api/admin/checklist/[id]/add-citation/route";
import { POST as approvePOST } from "@/app/api/admin/checklist/[id]/approve/route";
import { POST as rebuildPOST } from "@/app/api/admin/checklist/[id]/rebuild/route";
import { POST as rejectPOST } from "@/app/api/admin/checklist/[id]/reject/route";
import { POST as unpublishPOST } from "@/app/api/admin/checklist/[id]/unpublish/route";
import { POST as verifySourcesPOST } from "@/app/api/admin/checklist/[id]/verify-sources/route";
import { POST as rejectAllPOST } from "@/app/api/admin/checklist/bulk/reject-all/route";
import { POST as verifyAllPOST } from "@/app/api/admin/checklist/bulk/verify-all/route";
import { POST as janitorPOST } from "@/app/api/admin/checklist/janitor/[id]/route";
import { POST as seedPOST } from "@/app/api/admin/checklist/seed/route";

const APP_ORIGIN = "https://viafidei.example.com";
const EVIL_ORIGIN = "https://evil.example.com";

type BuildArgs = {
  path: string;
  method: string;
  origin?: string | null;
  device?: string;
  body?: unknown;
};

function buildReq(args: BuildArgs): NextRequest {
  const url = `${APP_ORIGIN}${args.path}`;
  const headers = new Headers({
    host: "viafidei.example.com",
    "x-forwarded-host": "viafidei.example.com",
    "x-forwarded-proto": "https",
  });
  if (args.origin) headers.set("origin", args.origin);
  if (args.body !== undefined) headers.set("content-type", "application/json");
  const base = new Request(url, {
    method: args.method,
    headers,
    ...(args.body === undefined ? {} : { body: JSON.stringify(args.body) }),
  });
  return Object.assign(base, {
    nextUrl: new URL(url),
    cookies: {
      get(name: string) {
        if (name === "vf_dev_id" && args.device) return { value: args.device };
        return undefined;
      },
    },
  }) as unknown as NextRequest;
}

const ctx = { params: Promise.resolve({ id: "item-1" }) };

type RouteCase = {
  /** Repo-relative route file, matching the static coverage scanner. */
  route: string;
  path: string;
  method: "GET" | "POST";
  mutating: boolean;
  body?: unknown;
  /** Invoke the real exported handler. */
  call: (req: NextRequest) => Promise<Response>;
  /** The domain call the handler makes once the gate lets it through. */
  work: () => ReturnType<typeof vi.fn>;
};

const CASES: RouteCase[] = [
  {
    route: "src/app/api/admin/audit/route.ts",
    path: "/api/admin/audit",
    method: "GET",
    mutating: false,
    call: (req) => auditGET(req),
    work: () => listAuditLogsMock,
  },
  {
    route: "src/app/api/admin/diagnostics/route.ts",
    path: "/api/admin/diagnostics",
    method: "GET",
    mutating: false,
    call: (req) => diagnosticsGET(req),
    work: () => runAllDiagnosticsMock,
  },
  {
    route: "src/app/api/admin/users/route.ts",
    path: "/api/admin/users",
    method: "GET",
    mutating: false,
    call: (req) => usersGET(req),
    work: () => listAdminUsersMock,
  },
  {
    route: "src/app/api/admin/checklist/[id]/add-citation/route.ts",
    path: "/api/admin/checklist/item-1/add-citation",
    method: "POST",
    mutating: true,
    body: { sourceUrl: "https://www.vatican.va/x" },
    call: (req) => addCitationPOST(req, ctx),
    work: () => addCitationMock,
  },
  {
    route: "src/app/api/admin/checklist/[id]/approve/route.ts",
    path: "/api/admin/checklist/item-1/approve",
    method: "POST",
    mutating: true,
    call: (req) => approvePOST(req, ctx),
    work: () => approveForBuildMock,
  },
  {
    route: "src/app/api/admin/checklist/[id]/rebuild/route.ts",
    path: "/api/admin/checklist/item-1/rebuild",
    method: "POST",
    mutating: true,
    call: (req) => rebuildPOST(req, ctx),
    work: () => enqueueBuildMock,
  },
  {
    route: "src/app/api/admin/checklist/[id]/reject/route.ts",
    path: "/api/admin/checklist/item-1/reject",
    method: "POST",
    mutating: true,
    body: { reason: "off-doctrine" },
    call: (req) => rejectPOST(req, ctx),
    work: () => rejectItemMock,
  },
  {
    route: "src/app/api/admin/checklist/[id]/unpublish/route.ts",
    path: "/api/admin/checklist/item-1/unpublish",
    method: "POST",
    mutating: true,
    body: { reason: "bad citation" },
    call: (req) => unpublishPOST(req, ctx),
    work: () => unpublishMock,
  },
  {
    route: "src/app/api/admin/checklist/[id]/verify-sources/route.ts",
    path: "/api/admin/checklist/item-1/verify-sources",
    method: "POST",
    mutating: true,
    call: (req) => verifySourcesPOST(req, ctx),
    work: () => markSourceVerifiedMock,
  },
  {
    route: "src/app/api/admin/checklist/bulk/reject-all/route.ts",
    path: "/api/admin/checklist/bulk/reject-all",
    method: "POST",
    mutating: true,
    body: { reason: "clearing the queue" },
    call: (req) => rejectAllPOST(req),
    work: () => bulkRejectMock,
  },
  {
    route: "src/app/api/admin/checklist/bulk/verify-all/route.ts",
    path: "/api/admin/checklist/bulk/verify-all",
    method: "POST",
    mutating: true,
    call: (req) => verifyAllPOST(req),
    work: () => bulkVerifyAllMock,
  },
  {
    route: "src/app/api/admin/checklist/janitor/[id]/route.ts",
    path: "/api/admin/checklist/janitor/item-1",
    method: "POST",
    mutating: true,
    body: { op: "accept", action: "edit" },
    call: (req) => janitorPOST(req, ctx),
    work: () => enqueueBuildMock,
  },
  {
    route: "src/app/api/admin/checklist/seed/route.ts",
    path: "/api/admin/checklist/seed",
    method: "POST",
    mutating: true,
    call: (req) => seedPOST(req),
    work: () => seedChecklistFirstMock,
  },
];

function signedInAdmin() {
  requireAdminMock.mockResolvedValue({ username: "admin", signedInAt: Date.now() });
}

beforeEach(() => {
  resetPrismaMock();
  _resetAdminScanCountersForTests();
  process.env.SESSION_SECRET = "test-session-secret-must-be-32-chars-long";

  requireAdminMock.mockReset();
  for (const m of [
    listAuditLogsMock,
    runAllDiagnosticsMock,
    listAdminUsersMock,
    addCitationMock,
    approveForBuildMock,
    enqueueBuildMock,
    rejectItemMock,
    unpublishMock,
    markSourceVerifiedMock,
    bulkRejectMock,
    bulkVerifyAllMock,
    seedChecklistFirstMock,
  ]) {
    m.mockReset();
  }

  // Happy-path domain behaviour: shapes the handlers actually destructure.
  listAuditLogsMock.mockResolvedValue({ rows: [], nextCursor: null });
  runAllDiagnosticsMock.mockResolvedValue([]);
  listAdminUsersMock.mockResolvedValue({
    rows: [],
    total: 0,
    page: 1,
    pageSize: 20,
    pageCount: 0,
  });
  addCitationMock.mockResolvedValue({ ok: true, citationId: "c1" });
  approveForBuildMock.mockResolvedValue({ status: "APPROVED_FOR_BUILD" });
  enqueueBuildMock.mockResolvedValue({ id: "job-1" });
  rejectItemMock.mockResolvedValue(undefined);
  unpublishMock.mockResolvedValue({ ok: true });
  markSourceVerifiedMock.mockResolvedValue(undefined);
  bulkRejectMock.mockResolvedValue({ updated: 0 });
  bulkVerifyAllMock.mockResolvedValue({ updated: 0 });
  seedChecklistFirstMock.mockResolvedValue({ created: 0 });

  checklistItemUpdateMock.mockReset();
  checklistItemUpdateMock.mockResolvedValue({ id: "item-1" });
  prismaMock.bannedDevice.findUnique.mockResolvedValue(null);
});

describe("the 13 converted admin routes all enforce the central gate", () => {
  it("covers every route that was on the gate-debt list", () => {
    expect(CASES).toHaveLength(13);
    expect(new Set(CASES.map((c) => c.route)).size).toBe(13);
  });

  for (const c of CASES) {
    describe(c.route, () => {
      it("refuses an unauthenticated caller with 401 and does no work", async () => {
        requireAdminMock.mockResolvedValue(null);
        const res = await c.call(
          buildReq({ path: c.path, method: c.method, origin: APP_ORIGIN, body: c.body }),
        );
        expect(res.status).toBe(401);
        expect(c.work()).not.toHaveBeenCalled();
      });

      it("refuses a banned device with 403 and does no work", async () => {
        signedInAdmin();
        prismaMock.bannedDevice.findUnique.mockResolvedValue({ active: true });
        const res = await c.call(
          buildReq({
            path: c.path,
            method: c.method,
            origin: APP_ORIGIN,
            device: "dev-banned",
            body: c.body,
          }),
        );
        expect(res.status).toBe(403);
        expect(c.work()).not.toHaveBeenCalled();
      });

      it("lets a properly authenticated, same-origin admin through", async () => {
        signedInAdmin();
        const res = await c.call(
          buildReq({
            path: c.path,
            method: c.method,
            origin: APP_ORIGIN,
            device: "dev-ok",
            body: c.body,
          }),
        );
        expect(res.status).toBe(200);
        expect(c.work()).toHaveBeenCalled();
      });

      if (c.mutating) {
        it("refuses a mutation with NO Origin/Referer (missing CSRF token) with 403", async () => {
          signedInAdmin();
          const res = await c.call(
            buildReq({ path: c.path, method: c.method, origin: null, body: c.body }),
          );
          expect(res.status).toBe(403);
          expect(c.work()).not.toHaveBeenCalled();
          // CSRF short-circuits: admin auth is never even consulted.
          expect(requireAdminMock).not.toHaveBeenCalled();
        });

        it("refuses a cross-origin mutation (invalid CSRF token) with 403", async () => {
          signedInAdmin();
          const res = await c.call(
            buildReq({ path: c.path, method: c.method, origin: EVIL_ORIGIN, body: c.body }),
          );
          expect(res.status).toBe(403);
          expect(c.work()).not.toHaveBeenCalled();
          expect(requireAdminMock).not.toHaveBeenCalled();
        });
      } else {
        it("still serves a GET whose Origin is foreign — CSRF is a safe-method no-op", async () => {
          // The read-only routes did NOT need a hand-rolled subset of the
          // gate, and the gate did not need a read-only variant: evaluateCsrf
          // passes GET/HEAD/OPTIONS through, so applying the whole gate adds
          // banned-device enforcement without breaking reads.
          signedInAdmin();
          const res = await c.call(
            buildReq({ path: c.path, method: c.method, origin: EVIL_ORIGIN }),
          );
          expect(res.status).toBe(200);
          expect(c.work()).toHaveBeenCalled();
        });
      }
    });
  }
});
