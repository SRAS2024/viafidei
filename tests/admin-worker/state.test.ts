/**
 * AdminWorkerState read/write — pause/resume + heartbeat behavior.
 * Uses a mocked Prisma client so it runs in the default unit suite.
 */

import { describe, expect, it, vi } from "vitest";

import {
  getAdminWorkerState,
  isPaused,
  pause,
  resume,
  writeHeartbeat,
} from "@/lib/admin-worker/state";

function makePrisma() {
  const row: Record<string, unknown> = {
    id: "singleton",
    currentMode: "SETUP",
    currentPriority: "WORKER_HEALTH",
    currentGoal: null,
    currentTask: null,
    lastHeartbeatAt: null,
    lastSuccessfulAt: null,
    lastFailedAt: null,
    currentBlocker: null,
    recoveryAction: null,
    workerVersion: "admin-worker/0.1",
    paused: false,
    pausedReason: null,
    pausedByUsername: null,
    pausedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return {
    state: row,
    prisma: {
      adminWorkerState: {
        upsert: vi.fn(async () => row),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(row, data);
          return row;
        }),
      },
    } as unknown as Parameters<typeof getAdminWorkerState>[0],
  };
}

describe("AdminWorkerState", () => {
  it("getAdminWorkerState returns the singleton row", async () => {
    const { prisma } = makePrisma();
    const state = await getAdminWorkerState(prisma);
    expect(state.id).toBe("singleton");
    expect(state.paused).toBe(false);
  });

  it("isPaused mirrors the row", async () => {
    const { prisma, state } = makePrisma();
    expect(isPaused(await getAdminWorkerState(prisma))).toBe(false);
    state.paused = true;
    expect(isPaused(await getAdminWorkerState(prisma))).toBe(true);
  });

  it("pause flips the flag, sets the reason, and switches mode to PAUSED", async () => {
    const { prisma, state } = makePrisma();
    const next = await pause(prisma, { reason: "operator request", byUsername: "admin" });
    expect(next.paused).toBe(true);
    expect(next.pausedReason).toBe("operator request");
    expect(state.currentMode).toBe("PAUSED");
  });

  it("resume clears the pause and reactivates the worker", async () => {
    const { prisma, state } = makePrisma();
    state.paused = true;
    state.pausedReason = "operator request";
    state.currentMode = "PAUSED";
    const next = await resume(prisma, { byUsername: "admin" });
    expect(next.paused).toBe(false);
    expect(next.pausedReason).toBeNull();
    expect(state.currentMode).toBe("CONSTANT_FILL");
  });

  it("writeHeartbeat updates lastHeartbeatAt", async () => {
    const { prisma, state } = makePrisma();
    await writeHeartbeat(prisma);
    expect(state.lastHeartbeatAt).toBeInstanceOf(Date);
  });
});
