/**
 * The legacy publish path is PERMANENTLY REMOVED — there is no
 * ALLOW_LEGACY_PUBLISH escape hatch and no backwards compatibility.
 * `publish()` always throws; public content is created only by the Admin
 * Worker artifact pipeline via runPublishOrchestrator(). `unpublish()`
 * (a safe admin op) is retained.
 */

import { describe, it, expect, afterEach } from "vitest";

import { publish } from "@/lib/worker/publishing";

const noopInput = {
  checklistItemId: "ci-1",
  pkg: {} as never,
  qa: {} as never,
};

describe("legacy publish is permanently removed (no escape hatch)", () => {
  afterEach(() => {
    delete process.env.ALLOW_LEGACY_PUBLISH;
  });

  it("throws when ALLOW_LEGACY_PUBLISH is unset", async () => {
    delete process.env.ALLOW_LEGACY_PUBLISH;
    await expect(publish({} as never, noopInput)).rejects.toThrow(/permanently removed/i);
  });

  it("STILL throws even when ALLOW_LEGACY_PUBLISH=1 (the hatch is gone)", async () => {
    process.env.ALLOW_LEGACY_PUBLISH = "1";
    await expect(publish({} as never, noopInput)).rejects.toThrow(/permanently removed/i);
  });
});
