import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  BrainEnvelopeSchema,
  callBrain,
  detectCommunionRisk,
  detectDuplicates,
  isBrainEnabled,
  probeBrain,
  resetBrainStatus,
  resolveBrainRoot,
  scoreQuality,
  type CommunionRiskResult,
} from "@/lib/admin-worker/intelligence";

// Does this environment actually have a runnable Python brain? Probe once;
// integration assertions skip gracefully when it doesn't (e.g. no python3).
let brainOnline = false;

beforeAll(async () => {
  process.env.INTELLIGENCE_BRAIN_ENABLED = "1";
  resetBrainStatus();
  const probe = await probeBrain();
  brainOnline = probe != null && probe.protocolVersion === 1;
});

afterEach(() => {
  // Restore "enabled" between tests; individual tests toggle as needed.
  process.env.INTELLIGENCE_BRAIN_ENABLED = "1";
  resetBrainStatus();
});

describe("envelope contract (pure)", () => {
  it("validates and camelCases a raw snake_case envelope", () => {
    const raw = {
      ok: true,
      result: { x: 1 },
      confidence: 1.5, // out of range on purpose
      reasoning: "because",
      evidence: ["a"],
      sources_used: ["https://vatican.va"],
      risk_level: "low",
      recommended_next_action: "proceed",
      safe_to_auto_execute: true,
      error: null,
      op: "demo",
      protocol_version: 1,
      elapsed_ms: 2,
    };
    const parsed = BrainEnvelopeSchema.parse(raw);
    expect(parsed.confidence).toBe(1); // clamped
    expect(parsed.sourcesUsed).toEqual(["https://vatican.va"]);
    expect(parsed.recommendedNextAction).toBe("proceed");
    expect(parsed.safeToAutoExecute).toBe(true);
  });

  it("rejects an envelope with an invalid risk level", () => {
    const bad = {
      ok: true,
      result: null,
      confidence: 0.5,
      reasoning: "x",
      evidence: [],
      sources_used: [],
      risk_level: "catastrophic",
      recommended_next_action: "",
      safe_to_auto_execute: false,
      error: null,
    };
    expect(BrainEnvelopeSchema.safeParse(bad).success).toBe(false);
  });
});

describe("configuration + fallback", () => {
  it("resolves the brain package root", () => {
    expect(resolveBrainRoot()).not.toBeNull();
  });

  it("is enabled by default and respects the off switch", () => {
    delete process.env.INTELLIGENCE_BRAIN_ENABLED;
    expect(isBrainEnabled()).toBe(true);
    process.env.INTELLIGENCE_BRAIN_ENABLED = "0";
    expect(isBrainEnabled()).toBe(false);
  });

  it("returns null (fallback) when disabled", async () => {
    process.env.INTELLIGENCE_BRAIN_ENABLED = "0";
    resetBrainStatus();
    const env = await callBrain("detect_communion_risk", { name: "x" });
    expect(env).toBeNull();
  });
});

describe("round-trip with the Python brain", () => {
  it("flags an Old Catholic source as a communion risk", async () => {
    if (!brainOnline) return; // python3 not available — skip
    const env = await detectCommunionRisk({
      name: "Old Catholic Church, independent of Rome",
      url: "http://example.org",
    });
    expect(env).not.toBeNull();
    const result = env!.result as CommunionRiskResult;
    expect(result.communion_risk).toBeGreaterThanOrEqual(0.6);
    expect(env!.riskLevel === "high" || env!.riskLevel === "critical").toBe(true);
    expect(env!.safeToAutoExecute).toBe(false);
  });

  it("does not flag the Holy See (vatican.va)", async () => {
    if (!brainOnline) return;
    const env = await detectCommunionRisk({ name: "The Holy See", url: "https://www.vatican.va" });
    const result = env!.result as CommunionRiskResult;
    expect(result.communion_risk).toBeLessThanOrEqual(0.1);
    expect(result.official_domain).toBe(true);
  });

  it("detects a duplicate by identical slug", async () => {
    if (!brainOnline) return;
    const env = await detectDuplicates(
      { title: "Hail Mary", slug: "hail-mary", text: "full of grace" },
      [{ id: "a", title: "The Hail Mary", slug: "hail-mary", text: "full of grace the lord" }],
    );
    expect(env!.result!.is_duplicate).toBe(true);
    expect(env!.recommendedNextAction).toBe("block-as-duplicate");
  });

  it("fails the publish gate for a record with no sources", async () => {
    if (!brainOnline) return;
    const env = await scoreQuality({ contentType: "PRAYER", title: "X", body: "y".repeat(700) });
    expect(env!.result!.publish_gates_failed).toContain("no-source");
    expect(env!.safeToAutoExecute).toBe(false);
  });

  it("caches by cacheKey (second call served from cache)", async () => {
    if (!brainOnline) return;
    const a = await detectCommunionRisk(
      { name: "Diocese of Rome", url: "https://www.vatican.va" },
      { cacheKey: "k1" },
    );
    const b = await detectCommunionRisk({ name: "DIFFERENT INPUT IGNORED" }, { cacheKey: "k1" });
    // Same cacheKey -> identical cached envelope despite different input.
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
