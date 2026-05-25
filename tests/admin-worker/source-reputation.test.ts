/**
 * Source reputation tier derivation. The tier function must be
 * deterministic — given the same rates it must always pick the same
 * tier. The spec section 19 calls out "bad sources are paused
 * automatically" — that means the function MUST pause on chronic
 * wrong-content or chronic build failure.
 */

import { describe, expect, it } from "vitest";

import { REPUTATION_THRESHOLDS, deriveTier } from "@/lib/admin-worker/source-reputation";

describe("Source reputation tier derivation", () => {
  it("promotes sources with high publish rate to TRUSTED", () => {
    const result = deriveTier({
      publicPublishRate: 0.9,
      qaPassRate: 0.8,
      contentBuildSuccessRate: 0.9,
      wrongContentRate: 0,
    });
    expect(result.tier).toBe("TRUSTED");
    expect(result.paused).toBe(false);
  });

  it("rates a steady QA-passing source as GOOD", () => {
    const result = deriveTier({
      publicPublishRate: 0.4,
      qaPassRate: 0.8,
      contentBuildSuccessRate: 0.6,
      wrongContentRate: 0.05,
    });
    expect(result.tier).toBe("GOOD");
  });

  it("auto-pauses sources with chronic wrong content", () => {
    const result = deriveTier({
      publicPublishRate: 0.5,
      qaPassRate: 0.5,
      contentBuildSuccessRate: 0.5,
      wrongContentRate: REPUTATION_THRESHOLDS.pauseWrongContent + 0.05,
    });
    expect(result.tier).toBe("PAUSED");
    expect(result.paused).toBe(true);
  });

  it("auto-pauses sources whose builds almost always fail", () => {
    const result = deriveTier({
      publicPublishRate: 0,
      qaPassRate: 0,
      contentBuildSuccessRate: 0.05,
      wrongContentRate: 0.1,
    });
    expect(result.paused).toBe(true);
  });

  it("does not pause a brand-new source with no signal", () => {
    const result = deriveTier({
      publicPublishRate: 0,
      qaPassRate: 0,
      contentBuildSuccessRate: 0,
      wrongContentRate: 0,
    });
    expect(result.paused).toBe(false);
    expect(result.tier).toBe("NEUTRAL");
  });

  it("rates a source with poor build rate as LIMITED", () => {
    const result = deriveTier({
      publicPublishRate: 0.1,
      qaPassRate: 0.3,
      contentBuildSuccessRate: REPUTATION_THRESHOLDS.limitedBuild - 0.05,
      wrongContentRate: 0,
    });
    expect(result.tier).toBe("LIMITED");
  });
});
