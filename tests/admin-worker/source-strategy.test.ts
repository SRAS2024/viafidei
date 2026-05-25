/**
 * Source ranking — proves "good sources are prioritized" and "Admin
 * Worker prefers official Church sources" (spec sections 19, 24).
 */

import type {
  AdminWorkerSourceReputation,
  AuthoritySource,
  SourceAuthorityLevel,
  SourceReputationTier,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import { rankSource } from "@/lib/admin-worker/source-strategy";

function authoritySource(
  host: string,
  level: SourceAuthorityLevel,
): Pick<AuthoritySource, "authorityLevel" | "host"> {
  return { host, authorityLevel: level };
}

function reputation(
  host: string,
  overrides: Partial<AdminWorkerSourceReputation> = {},
): AdminWorkerSourceReputation {
  const now = new Date();
  return {
    id: "r1",
    sourceId: null,
    sourceHost: host,
    sourceRole: null,
    contentType: null,
    discoverySuccessRate: 0,
    fetchSuccessRate: 0.9,
    contentBuildSuccessRate: 0.9,
    qaPassRate: 0.9,
    validationEvidenceSuccessRate: 0.9,
    publicPublishRate: 0.9,
    wrongContentRate: 0,
    duplicateRate: 0,
    averageUsefulness: 0.9,
    reputationTier: "TRUSTED" as SourceReputationTier,
    paused: false,
    lastScoreUpdate: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("rankSource", () => {
  it("ranks Vatican higher than COMMUNITY at the same QA rate", () => {
    const vatican = rankSource(
      authoritySource("www.vatican.va", "VATICAN"),
      reputation("www.vatican.va"),
    );
    const community = rankSource(
      authoritySource("community.example", "COMMUNITY"),
      reputation("community.example"),
    );
    expect(vatican.rank).toBeGreaterThan(community.rank);
  });

  it("penalises sources with high wrong-content rate", () => {
    const clean = rankSource(
      authoritySource("a.example", "TRUSTED_PUBLISHER"),
      reputation("a.example", { wrongContentRate: 0 }),
    );
    const noisy = rankSource(
      authoritySource("a.example", "TRUSTED_PUBLISHER"),
      reputation("a.example", { wrongContentRate: 0.6 }),
    );
    expect(clean.rank).toBeGreaterThan(noisy.rank);
  });

  it("rewards a strong publish rate", () => {
    const low = rankSource(
      authoritySource("a.example", "TRUSTED_PUBLISHER"),
      reputation("a.example", { publicPublishRate: 0 }),
    );
    const high = rankSource(
      authoritySource("a.example", "TRUSTED_PUBLISHER"),
      reputation("a.example", { publicPublishRate: 1 }),
    );
    expect(high.rank).toBeGreaterThan(low.rank);
  });

  it("returns a rank in [0,1]", () => {
    const ranked = rankSource(
      authoritySource("www.vatican.va", "VATICAN"),
      reputation("www.vatican.va"),
    );
    expect(ranked.rank).toBeGreaterThanOrEqual(0);
    expect(ranked.rank).toBeLessThanOrEqual(1);
  });

  it("returns a usable result even without a reputation row", () => {
    const ranked = rankSource(authoritySource("www.vatican.va", "VATICAN"), null);
    expect(ranked.rank).toBeGreaterThan(0);
  });
});
