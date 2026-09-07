/**
 * Who renews the execution lease.
 *
 * Under the local host (scripts/local-worker-host.ts) the HOST owns the lease
 * row: it renews on its own jittered tick and kills this child when the lease
 * is lost. The child re-writing the same row every pass only doubled the
 * round trips to a remote database (audit LH-11), so the host sets
 * VIAFIDEI_LEASE_RENEWED_BY_HOST=1 and the child's per-pass renew becomes a
 * no-op. A bare `npm run worker:local` has no host and MUST keep renewing —
 * and must still stop when the lease is taken.
 *
 * The master-switch read is unaffected either way: OFF stops the loop
 * everywhere, and an unreadable database is never a decision.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readExecutionStatus = vi.fn();
const renewExecutionLease = vi.fn();

vi.mock("@/lib/admin-worker/execution-host", () => ({
  readExecutionStatus: (...args: unknown[]) => readExecutionStatus(...args),
  renewExecutionLease: (...args: unknown[]) => renewExecutionLease(...args),
}));

import { checkLoopAuthority, leaseRenewedByHost } from "@/lib/admin-worker/loop";

const prisma = {} as never;

function statusOn(runtimeId = "other-mac") {
  return {
    known: true,
    switch: { on: true },
    lease: { runtimeId },
  };
}

beforeEach(() => {
  readExecutionStatus.mockReset();
  renewExecutionLease.mockReset();
  delete process.env.VIAFIDEI_LEASE_RENEWED_BY_HOST;
});

afterEach(() => {
  delete process.env.VIAFIDEI_LEASE_RENEWED_BY_HOST;
});

describe("leaseRenewedByHost", () => {
  it("is true only for the exact host flag", () => {
    expect(leaseRenewedByHost()).toBe(false);
    process.env.VIAFIDEI_LEASE_RENEWED_BY_HOST = "0";
    expect(leaseRenewedByHost()).toBe(false);
    process.env.VIAFIDEI_LEASE_RENEWED_BY_HOST = "1";
    expect(leaseRenewedByHost()).toBe(true);
  });
});

describe("checkLoopAuthority — host-supervised child", () => {
  it("does NOT write the lease row when the host renews it", async () => {
    process.env.VIAFIDEI_LEASE_RENEWED_BY_HOST = "1";
    readExecutionStatus.mockResolvedValue(statusOn());
    const out = await checkLoopAuthority(prisma, "local-mac");
    expect(out.ok).toBe(true);
    expect(renewExecutionLease).not.toHaveBeenCalled();
  });

  it("still stops on a master switch read as OFF", async () => {
    process.env.VIAFIDEI_LEASE_RENEWED_BY_HOST = "1";
    readExecutionStatus.mockResolvedValue({ known: true, switch: { on: false }, lease: null });
    const out = await checkLoopAuthority(prisma, "local-mac");
    expect(out.ok).toBe(false);
    expect(out.stopReason).toBe("switch_off");
    expect(renewExecutionLease).not.toHaveBeenCalled();
  });
});

describe("checkLoopAuthority — standalone CLI worker", () => {
  it("renews its own lease every pass", async () => {
    readExecutionStatus.mockResolvedValue(statusOn());
    renewExecutionLease.mockResolvedValue("renewed");
    const out = await checkLoopAuthority(prisma, "cli-worker");
    expect(out.ok).toBe(true);
    expect(renewExecutionLease).toHaveBeenCalledWith(prisma, "cli-worker");
  });

  it("stops with lease_lost when another runtime took the lease", async () => {
    readExecutionStatus.mockResolvedValue(statusOn("other-mac"));
    renewExecutionLease.mockResolvedValue("lost");
    const out = await checkLoopAuthority(prisma, "cli-worker");
    expect(out.ok).toBe(false);
    expect(out.stopReason).toBe("lease_lost");
    expect(out.reason).toContain("other-mac");
  });
});

describe("checkLoopAuthority — fail-open", () => {
  it("keeps working when the database could not be read (not a decision)", async () => {
    readExecutionStatus.mockResolvedValue({ known: false, switch: { on: false }, lease: null });
    const out = await checkLoopAuthority(prisma, "cli-worker");
    expect(out.ok).toBe(true);
    expect(renewExecutionLease).not.toHaveBeenCalled();
  });

  it("keeps working when the status read throws", async () => {
    readExecutionStatus.mockRejectedValue(new Error("Can't reach database server"));
    const out = await checkLoopAuthority(prisma, "cli-worker");
    expect(out.ok).toBe(true);
  });
});
