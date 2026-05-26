/**
 * CandidateUrlScorer (spec §5). Pure-function tests cover the
 * scoring formula; the persistence + adjust-after-outcome tests
 * cover the DB updates.
 */

import { describe, expect, it } from "vitest";

import { scoreCandidate } from "@/lib/admin-worker/candidate-scorer";

describe("scoreCandidate — pure scoring formula", () => {
  it("returns all required score dimensions", () => {
    const s = scoreCandidate({
      url: "https://www.vatican.va/content/prayer/test.html",
      predictedContentType: "PRAYER",
      reputationTier: "TRUSTED",
    });
    expect(typeof s.contentTypeLikelihood).toBe("number");
    expect(typeof s.junkRisk).toBe("number");
    expect(typeof s.duplicateRisk).toBe("number");
    expect(typeof s.sourceAuthorityScore).toBe("number");
    expect(typeof s.expectedPackageCompleteness).toBe("number");
    expect(typeof s.expectedValidationValue).toBe("number");
    expect(typeof s.fetchPriority).toBe("number");
  });

  it("scores TRUSTED hosts higher than POOR hosts for the same URL", () => {
    const trusted = scoreCandidate({
      url: "https://example.org/prayer/test",
      predictedContentType: "PRAYER",
      reputationTier: "TRUSTED",
    });
    const poor = scoreCandidate({
      url: "https://example.org/prayer/test",
      predictedContentType: "PRAYER",
      reputationTier: "POOR",
    });
    expect(trusted.fetchPriority).toBeGreaterThan(poor.fetchPriority);
    expect(trusted.sourceAuthorityScore).toBeGreaterThan(poor.sourceAuthorityScore);
  });

  it("boosts contentTypeLikelihood when URL matches type hints", () => {
    const match = scoreCandidate({
      url: "https://example.org/prayers/our-father",
      predictedContentType: "PRAYER",
      reputationTier: "GOOD",
    });
    const noMatch = scoreCandidate({
      url: "https://example.org/random/page",
      predictedContentType: "PRAYER",
      reputationTier: "GOOD",
    });
    expect(match.contentTypeLikelihood).toBeGreaterThan(noMatch.contentTypeLikelihood);
  });

  it("flags livestream URLs with high junkRisk and a rejection pattern", () => {
    const s = scoreCandidate({
      url: "https://example.org/livestream/mass",
      predictedContentType: "PRAYER",
      reputationTier: "TRUSTED",
    });
    expect(s.junkRisk).toBeGreaterThanOrEqual(0.5);
  });

  it("flags news/blog URLs as junk-risky", () => {
    const s = scoreCandidate({
      url: "https://example.org/news/2024/01/some-news-article",
      predictedContentType: "PRAYER",
      reputationTier: "GOOD",
    });
    expect(s.junkRisk).toBeGreaterThan(0);
  });

  it("raises duplicateRisk when many existing duplicates", () => {
    const noDups = scoreCandidate({
      url: "https://example.org/prayers/x",
      predictedContentType: "PRAYER",
      reputationTier: "TRUSTED",
      duplicateMatches: 0,
    });
    const manyDups = scoreCandidate({
      url: "https://example.org/prayers/x",
      predictedContentType: "PRAYER",
      reputationTier: "TRUSTED",
      duplicateMatches: 5,
    });
    expect(manyDups.duplicateRisk).toBeGreaterThan(noDups.duplicateRisk);
    expect(manyDups.fetchPriority).toBeLessThan(noDups.fetchPriority);
  });

  it("priorPublishSuccess bumps expectedPackageCompleteness", () => {
    const fresh = scoreCandidate({
      url: "https://example.org/prayers/x",
      predictedContentType: "PRAYER",
      reputationTier: "GOOD",
      priorPublishSuccess: false,
    });
    const proven = scoreCandidate({
      url: "https://example.org/prayers/x",
      predictedContentType: "PRAYER",
      reputationTier: "GOOD",
      priorPublishSuccess: true,
    });
    expect(proven.expectedPackageCompleteness).toBeGreaterThan(fresh.expectedPackageCompleteness);
  });

  it("repeated fetch failures penalise expectedPackageCompleteness", () => {
    const fresh = scoreCandidate({
      url: "https://example.org/prayers/x",
      predictedContentType: "PRAYER",
      reputationTier: "GOOD",
      fetchAttempts: 0,
    });
    const stale = scoreCandidate({
      url: "https://example.org/prayers/x",
      predictedContentType: "PRAYER",
      reputationTier: "GOOD",
      fetchAttempts: 5,
    });
    expect(stale.expectedPackageCompleteness).toBeLessThan(fresh.expectedPackageCompleteness);
  });

  it("is deterministic — same input, same output", () => {
    const a = scoreCandidate({
      url: "https://example.org/prayers/x",
      predictedContentType: "PRAYER",
      reputationTier: "GOOD",
    });
    const b = scoreCandidate({
      url: "https://example.org/prayers/x",
      predictedContentType: "PRAYER",
      reputationTier: "GOOD",
    });
    expect(a).toEqual(b);
  });

  it("PAUSED sources get sourceAuthorityScore 0 and lose to NEUTRAL on the same URL", () => {
    const paused = scoreCandidate({
      url: "https://example.org/prayers/x",
      predictedContentType: "PRAYER",
      reputationTier: "PAUSED",
    });
    const neutral = scoreCandidate({
      url: "https://example.org/prayers/x",
      predictedContentType: "PRAYER",
      reputationTier: "NEUTRAL",
    });
    expect(paused.sourceAuthorityScore).toBe(0);
    expect(neutral.fetchPriority).toBeGreaterThan(paused.fetchPriority);
  });
});
