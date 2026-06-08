/**
 * Unit tests for the action idempotency key (spec item 16: "Idempotency keys
 * for worker actions"). The key must be deterministic, stable across calls, and
 * distinct for distinct actions so a replayed/duplicated action is recognised.
 */

import { describe, expect, it } from "vitest";

import { actionIdempotencyKey } from "@/lib/admin-worker/replay-runner";

describe("actionIdempotencyKey", () => {
  it("is deterministic for the same action", () => {
    const a = actionIdempotencyKey({
      passId: "p1",
      missionStage: "SOURCE_FETCH",
      action: "FETCH",
      contentType: "PRAYER",
    });
    const b = actionIdempotencyKey({
      passId: "p1",
      missionStage: "SOURCE_FETCH",
      action: "FETCH",
      contentType: "PRAYER",
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });

  it("differs for distinct actions", () => {
    const a = actionIdempotencyKey({ passId: "p1", missionStage: "SOURCE_FETCH", action: "FETCH" });
    const b = actionIdempotencyKey({ passId: "p1", missionStage: "DISCOVERY", action: "FETCH" });
    const c = actionIdempotencyKey({ passId: "p2", missionStage: "SOURCE_FETCH", action: "FETCH" });
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it("handles missing fields without throwing", () => {
    expect(actionIdempotencyKey({})).toMatch(/^[0-9a-f]{16}$/);
  });
});
