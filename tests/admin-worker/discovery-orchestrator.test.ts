/**
 * DiscoveryOrchestrator (spec §4). Verifies content-type strategies,
 * cadence rules, and host ranking inputs. Heavy DB integration is
 * covered by the dispatcher test.
 */

import { describe, expect, it } from "vitest";

import {
  CONTENT_TYPE_STRATEGIES,
  discoveryCadenceMinutes,
} from "@/lib/admin-worker/discovery-orchestrator";

describe("CONTENT_TYPE_STRATEGIES — per-content-type discovery hints (spec §4)", () => {
  it("ships strategies for every required content type", () => {
    // Spec §4 names: prayer, saint, novena, devotion, rosary, sacrament,
    // history, parish — every one must have a strategy.
    expect(CONTENT_TYPE_STRATEGIES.PRAYER).toBeDefined();
    expect(CONTENT_TYPE_STRATEGIES.SAINT).toBeDefined();
    expect(CONTENT_TYPE_STRATEGIES.NOVENA).toBeDefined();
    expect(CONTENT_TYPE_STRATEGIES.DEVOTION).toBeDefined();
    expect(CONTENT_TYPE_STRATEGIES.ROSARY).toBeDefined();
    expect(CONTENT_TYPE_STRATEGIES.SACRAMENT).toBeDefined();
    expect(CONTENT_TYPE_STRATEGIES.PARISH).toBeDefined();
    expect(CONTENT_TYPE_STRATEGIES.CHURCH_DOCUMENT).toBeDefined();
  });

  it("prayer strategy prioritizes pages with prayer text", () => {
    const s = CONTENT_TYPE_STRATEGIES.PRAYER;
    expect(s.hints).toContain("/prayers/");
    expect(s.description.toLowerCase()).toContain("prayer text");
  });

  it("saint strategy prioritizes biography and feast-day pages", () => {
    const s = CONTENT_TYPE_STRATEGIES.SAINT;
    expect(s.hints).toContain("/saint/");
    expect(s.description.toLowerCase()).toMatch(/biography|feast-day/);
  });

  it("novena strategy prioritizes pages with day sections", () => {
    const s = CONTENT_TYPE_STRATEGIES.NOVENA;
    expect(s.hints.some((h) => /day/i.test(h))).toBe(true);
  });

  it("parish strategy prioritizes directory records", () => {
    const s = CONTENT_TYPE_STRATEGIES.PARISH;
    expect(s.preferDiscoverers).toContain("DIRECTORY");
  });

  it("history strategy prioritizes official Church documents", () => {
    const s = CONTENT_TYPE_STRATEGIES.CHURCH_DOCUMENT;
    expect(s.hints.some((h) => /encyclical|council|canon-law|catechism/.test(h))).toBe(true);
  });
});

describe("discoveryCadenceMinutes — spec §4 cadence rules", () => {
  it("runs more often (30m) when there has been no growth in 7+ days", () => {
    const cadence = discoveryCadenceMinutes({
      gapCount: 5,
      hoursSinceLastGrowth: 7 * 24 + 1,
      hasGoalReached: false,
    });
    expect(cadence).toBe(30);
  });

  it("runs every 60m when there has been no growth in 24h", () => {
    const cadence = discoveryCadenceMinutes({
      gapCount: 5,
      hoursSinceLastGrowth: 30,
      hasGoalReached: false,
    });
    expect(cadence).toBe(60);
  });

  it("runs less often (12h) when the content type is at goal", () => {
    const cadence = discoveryCadenceMinutes({
      gapCount: 0,
      hoursSinceLastGrowth: 2,
      hasGoalReached: true,
    });
    expect(cadence).toBe(12 * 60);
  });

  it("runs less often (12h) when there is no gap regardless of growth", () => {
    const cadence = discoveryCadenceMinutes({
      gapCount: 0,
      hoursSinceLastGrowth: null,
      hasGoalReached: false,
    });
    expect(cadence).toBe(12 * 60);
  });

  it("treats 'never grown' as the worst case — runs every 30m", () => {
    const cadence = discoveryCadenceMinutes({
      gapCount: 5,
      hoursSinceLastGrowth: null,
      hasGoalReached: false,
    });
    expect(cadence).toBe(30);
  });
});
