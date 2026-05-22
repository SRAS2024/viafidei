/**
 * Admin action logging for operational admin routes.
 *
 * Every important operational admin action — sign-out, run ingestion,
 * run cleanup, repair the queue, repair source jobs — records an
 * AdminActionLog row so the Developer Audit report's "Admin Navigation
 * and Actions" section can show what the admin did. A valid
 * authenticated admin is trusted: the action is logged, and the route
 * never raises a suspicious-activity signal. An unauthenticated request
 * is rejected by the gate before any action is logged.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const writeAdminActionLogMock = vi.fn().mockResolvedValue("action-1");
const gateAdminApiCallMock = vi.fn();
const runQueueRepairMock = vi.fn();
const runSourceJobRepairMock = vi.fn();
const runStrictContentCleanupMock = vi.fn();
const getSessionMock = vi.fn();
const writeAuditMock = vi.fn().mockResolvedValue(undefined);
const ensureVaticanScheduleMock = vi.fn().mockResolvedValue(undefined);
const enqueueDueIngestionJobsMock = vi.fn();
const recordDataManagementLogsMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/audit/admin-action-log", () => ({
  writeAdminActionLog: (...a: unknown[]) => writeAdminActionLogMock(...a),
  ADMIN_ACTION: {
    loginSuccess: "admin_login_success",
    loginFailed: "admin_login_failed",
    logout: "admin_logout",
    diagnosticsRun: "diagnostics_run",
    developerReport: "developer_audit_report",
    reportDownloaded: "report_downloaded",
    contentCleanup: "content_cleanup_triggered",
    ingestionTriggered: "ingestion_triggered",
    queueRepair: "queue_repair_triggered",
    sourceJobRepair: "source_job_repair_triggered",
    settingsChanged: "settings_changed",
    contentEdited: "content_edited",
    contentPublished: "content_published",
    contentDeleted: "content_deleted",
    sensitivePageView: "sensitive_page_view",
  },
}));
vi.mock("@/lib/security/admin-gate", () => ({
  gateAdminApiCall: (...a: unknown[]) => gateAdminApiCallMock(...a),
}));
vi.mock("@/lib/audit", () => ({ writeAudit: (...a: unknown[]) => writeAuditMock(...a) }));
vi.mock("@/lib/auth", () => ({ getSession: (...a: unknown[]) => getSessionMock(...a) }));
vi.mock("@/lib/ingestion/queue/queue-repair", () => ({
  runQueueRepair: (...a: unknown[]) => runQueueRepairMock(...a),
}));
vi.mock("@/lib/ingestion/queue/source-job-repair", () => ({
  runSourceJobRepair: (...a: unknown[]) => runSourceJobRepairMock(...a),
}));
vi.mock("@/lib/content-qa/cleanup", () => ({
  runStrictContentCleanup: (...a: unknown[]) => runStrictContentCleanupMock(...a),
}));
vi.mock("@/lib/ingestion/sources", () => ({
  ensureVaticanSchedule: (...a: unknown[]) => ensureVaticanScheduleMock(...a),
}));
vi.mock("@/lib/ingestion/queue", () => ({
  enqueueJob: vi.fn().mockResolvedValue({ id: "job-1" }),
  enqueueDueIngestionJobs: (...a: unknown[]) => enqueueDueIngestionJobsMock(...a),
  PRIORITY_CONTENT_THRESHOLD_UNMET: 100,
}));
vi.mock("@/lib/data/data-management-log", () => ({
  recordDataManagementLogs: (...a: unknown[]) => recordDataManagementLogsMock(...a),
}));
vi.mock("@/lib/db/client", () => ({ prisma: { ingestionJob: { findFirst: vi.fn() } } }));

import { POST as queueRepairPost } from "@/app/api/admin/queue/repair/route";
import { POST as sourceRepairPost } from "@/app/api/admin/sources/repair-jobs/route";
import { POST as strictCleanupPost } from "@/app/api/admin/content-qa/strict-cleanup/route";
import { POST as logoutPost } from "@/app/api/admin/logout/route";
import { POST as ingestionRunPost } from "@/app/api/admin/ingestion/run/route";

function makeReq(path: string, body?: unknown): NextRequest {
  const url = `http://localhost${path}`;
  const init: RequestInit = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
      "x-forwarded-host": "localhost",
      "x-forwarded-proto": "http",
      "x-forwarded-for": "203.0.113.7",
      "user-agent": "Mozilla/5.0 Test",
    },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  const base = new Request(url, init);
  return Object.assign(base, {
    cookies: { get: () => ({ value: "device-cred-xyz" }) },
    nextUrl: new URL(url),
  }) as unknown as NextRequest;
}

function loggedAction(): { actionType: string; result: string; route?: string } {
  expect(writeAdminActionLogMock).toHaveBeenCalledTimes(1);
  return writeAdminActionLogMock.mock.calls[0][0] as {
    actionType: string;
    result: string;
    route?: string;
  };
}

beforeEach(() => {
  writeAdminActionLogMock.mockClear();
  gateAdminApiCallMock.mockReset();
  runQueueRepairMock.mockReset();
  runSourceJobRepairMock.mockReset();
  runStrictContentCleanupMock.mockReset();
  getSessionMock.mockReset();
  writeAuditMock.mockClear();
  ensureVaticanScheduleMock.mockClear();
  enqueueDueIngestionJobsMock.mockReset();
  recordDataManagementLogsMock.mockClear();

  gateAdminApiCallMock.mockResolvedValue({
    ok: true,
    admin: { username: "admin", signedInAt: Date.now() },
  });
  runQueueRepairMock.mockResolvedValue({
    staleRunningJobsRecovered: 2,
    retryableFailedRequeued: 1,
    permanentlyFailedLeftAlone: 0,
  });
  runSourceJobRepairMock.mockResolvedValue({
    factoryReadySources: 5,
    sourcesWithZeroJobs: 1,
    discoveryJobsCreated: 1,
  });
  runStrictContentCleanupMock.mockResolvedValue({
    totalInspected: 10,
    totalFlaggedReady: 8,
    totalFlaggedUnready: 1,
    totalHardDeleted: 1,
  });
  enqueueDueIngestionJobsMock.mockResolvedValue({ jobsEnqueued: 3 });
  getSessionMock.mockResolvedValue({ role: "ADMIN", userEmail: "admin", destroy: vi.fn() });
});

describe("operational admin routes record an AdminActionLog row", () => {
  it("queue repair logs a queue_repair_triggered action", async () => {
    const res = await queueRepairPost(makeReq("/api/admin/queue/repair"));
    expect(res.status).toBe(200);
    const action = loggedAction();
    expect(action.actionType).toBe("queue_repair_triggered");
    expect(action.result).toBe("success");
  });

  it("source job repair logs a source_job_repair_triggered action", async () => {
    const res = await sourceRepairPost(makeReq("/api/admin/sources/repair-jobs"));
    expect(res.status).toBe(200);
    expect(loggedAction().actionType).toBe("source_job_repair_triggered");
  });

  it("strict cleanup logs a content_cleanup_triggered action", async () => {
    const res = await strictCleanupPost(makeReq("/api/admin/content-qa/strict-cleanup"));
    expect(res.status).toBe(200);
    expect(loggedAction().actionType).toBe("content_cleanup_triggered");
  });

  it("running ingestion logs an ingestion_triggered action", async () => {
    const res = await ingestionRunPost(makeReq("/api/admin/ingestion/run", {}));
    expect(res.status).toBe(200);
    expect(loggedAction().actionType).toBe("ingestion_triggered");
  });

  it("admin sign-out logs an admin_logout action", async () => {
    await logoutPost(makeReq("/api/admin/logout"));
    const action = loggedAction();
    expect(action.actionType).toBe("admin_logout");
    expect(action.result).toBe("success");
  });
});

describe("admin action logging is gated on authentication", () => {
  it("does not log an action when the admin gate rejects the request", async () => {
    gateAdminApiCallMock.mockResolvedValue({
      ok: false,
      response: new Response("unauthorized", { status: 401 }),
    });
    const res = await queueRepairPost(makeReq("/api/admin/queue/repair"));
    expect(res.status).toBe(401);
    expect(writeAdminActionLogMock).not.toHaveBeenCalled();
    expect(runQueueRepairMock).not.toHaveBeenCalled();
  });

  it("does not log an action when sign-out has no admin session", async () => {
    getSessionMock.mockResolvedValue({ role: "USER", destroy: vi.fn() });
    await logoutPost(makeReq("/api/admin/logout"));
    expect(writeAdminActionLogMock).not.toHaveBeenCalled();
  });
});
