/**
 * The per-eventName INFO budget is enforced by `writeAdminWorkerLog` itself.
 *
 * It used to be enforced only by the nine call sites that remembered to ask
 * `sampleWorkerEvent` first. Everything else wrote unsampled: `worker_lanes`
 * twice per pass, `build_ready_drain` once per pass, `strict_qa_idle` and
 * `publish_pass_idle` once per dispatch — about 720 rows an hour against a
 * budget of 120, the same shape as the events that reached ~1 M rows each in
 * production. Worse, the LOG_EVENT_SPAM repair calls `suppressWorkerEvent`,
 * which mutates a map those call sites never read, so the repair was a no-op
 * for every event outside that list while VERIFY reported it fixed.
 *
 * What is pinned here:
 *   - an INFO event over its hourly budget stops reaching the database;
 *   - the FIRST drop leaves one WARN row saying so, and no more;
 *   - WARN and ERROR are never sampled — they are the audit trail;
 *   - a caller that already sampled is not charged twice;
 *   - `suppressWorkerEvent` now silences a call site that never opted in.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetEventSampler, suppressWorkerEvent } from "@/lib/admin-worker/event-sampler";
import { writeAdminWorkerLog } from "@/lib/admin-worker/logs";

function makePrisma() {
  const rows: Array<Record<string, unknown>> = [];
  return {
    rows,
    prisma: {
      adminWorkerLog: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          rows.push(data);
          return { id: `l${rows.length}` };
        }),
      },
    } as unknown as Parameters<typeof writeAdminWorkerLog>[0],
  };
}

beforeEach(() => {
  resetEventSampler();
  delete process.env.ADMIN_WORKER_EVENT_BUDGET_PER_HOUR;
  delete process.env.ADMIN_WORKER_EVENT_COOLDOWN_MS;
});

describe("writeAdminWorkerLog enforces the INFO budget for every call site", () => {
  it("drops an over-budget INFO event and says so exactly once", async () => {
    process.env.ADMIN_WORKER_EVENT_BUDGET_PER_HOUR = "3";
    const { prisma, rows } = makePrisma();
    // A per-pass event nobody wired to the sampler.
    for (let i = 0; i < 50; i += 1) {
      await writeAdminWorkerLog(prisma, {
        severity: "INFO",
        eventName: "worker_lanes",
        message: `pass ${i}`,
      });
    }
    const written = rows.filter((r) => r.eventName === "worker_lanes");
    expect(written).toHaveLength(3);
    // One notice per cool-down, not one per dropped row.
    const notices = rows.filter((r) => r.eventName === "log_event_sampled");
    expect(notices).toHaveLength(1);
    expect(notices[0].severity).toBe("WARN");
    expect(String(notices[0].message)).toContain("worker_lanes");
  });

  it("never samples WARN or ERROR — they are the audit trail", async () => {
    process.env.ADMIN_WORKER_EVENT_BUDGET_PER_HOUR = "2";
    const { prisma, rows } = makePrisma();
    for (let i = 0; i < 30; i += 1) {
      await writeAdminWorkerLog(prisma, {
        severity: i % 2 === 0 ? "WARN" : "ERROR",
        eventName: "post_publish_verified",
        message: `probe ${i}`,
      });
    }
    expect(rows).toHaveLength(30);
    expect(rows.every((r) => r.eventName === "post_publish_verified")).toBe(true);
  });

  it("does not charge the budget twice for a caller that already sampled", async () => {
    process.env.ADMIN_WORKER_EVENT_BUDGET_PER_HOUR = "4";
    const { prisma, rows } = makePrisma();
    for (let i = 0; i < 4; i += 1) {
      await writeAdminWorkerLog(prisma, {
        severity: "INFO",
        eventName: "brain_decided",
        message: `pass ${i}`,
        presampled: true,
      });
    }
    expect(rows.filter((r) => r.eventName === "brain_decided")).toHaveLength(4);
  });

  it("makes suppressWorkerEvent effective for a call site that never opted in", async () => {
    const { prisma, rows } = makePrisma();
    // This is what the LOG_EVENT_SPAM repair does with the offender SENSE named.
    suppressWorkerEvent("build_ready_drain", { now: Date.now(), cooldownMs: 10 * 60_000 });
    await writeAdminWorkerLog(prisma, {
      severity: "INFO",
      eventName: "build_ready_drain",
      message: "drain",
    });
    expect(rows.filter((r) => r.eventName === "build_ready_drain")).toHaveLength(0);
    // A different event is unaffected.
    await writeAdminWorkerLog(prisma, {
      severity: "INFO",
      eventName: "cleanup_completed",
      message: "cleanup",
    });
    expect(rows.filter((r) => r.eventName === "cleanup_completed")).toHaveLength(1);
  });

  it("writes normally when the event is under budget", async () => {
    const { prisma, rows } = makePrisma();
    await writeAdminWorkerLog(prisma, { eventName: "worker_lanes", message: "one pass" });
    expect(rows).toHaveLength(1);
    expect(rows[0].severity).toBe("INFO");
  });
});
