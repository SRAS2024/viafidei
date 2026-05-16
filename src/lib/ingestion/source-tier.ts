/**
 * Source tier classification + review-routing decision.
 *
 *   Tier 1 — Official Church (vatican.va, USCCB, holy-see.com, etc.).
 *            Auto-publish high-confidence items; fall back to REVIEW for
 *            soft validations.
 *   Tier 2 — Established Catholic publishers and reference sources
 *            (catholic.com, ewtn.com, newadvent.org, britannica.com).
 *            Default to PUBLISHED when confidence is high, REVIEW
 *            otherwise.
 *   Tier 3 — Blogs, general Catholic sites, news, less authoritative
 *            resources. Default to REVIEW unless the adapter
 *            specifically marks the item as high-confidence.
 *
 * These rules drive both `inferTierFromHost` (used at adapter
 * registration time) and `routeByTier` (used per-item by the runner).
 */

export type Tier = 1 | 2 | 3;

const TIER_1_HOSTS: ReadonlyArray<string> = [
  "vatican.va",
  "www.vatican.va",
  "press.vatican.va",
  "holyseepress.va",
  "holy-see.com",
  "usccb.org",
  "www.usccb.org",
  "vaticannews.va",
  "www.vaticannews.va",
  "synodofbishops.va",
  "cathobel.be",
  "katholisch.de",
  "iuscangreg.it",
  "missionariodelapasion.com",
];

const TIER_2_HOSTS: ReadonlyArray<string> = [
  "catholic.com",
  "www.catholic.com",
  "ewtn.com",
  "www.ewtn.com",
  "newadvent.org",
  "www.newadvent.org",
  "britannica.com",
  "www.britannica.com",
  "catholicculture.org",
  "www.catholicculture.org",
  "catholicnewsagency.com",
  "www.catholicnewsagency.com",
  "catholicworldreport.com",
  "americamagazine.org",
  "catholicireland.net",
  "catholicaustralia.com.au",
  "thecatholicspirit.com",
  "ncregister.com",
];

export function inferTierFromHost(host: string): Tier {
  const lower = host.toLowerCase();
  if (TIER_1_HOSTS.some((h) => lower === h || lower.endsWith(`.${h}`))) return 1;
  if (TIER_2_HOSTS.some((h) => lower === h || lower.endsWith(`.${h}`))) return 2;
  return 3;
}

export function tierLabel(tier: number | null | undefined): string {
  if (tier === 1) return "Tier 1 — Official Church";
  if (tier === 2) return "Tier 2 — Established Catholic publisher";
  if (tier === 3) return "Tier 3 — General Catholic / news / blog";
  return "Tier unknown";
}

export type RoutingDecision = {
  status: "PUBLISHED" | "REVIEW";
  reason: string;
};

/**
 * Decide whether an item should go straight to PUBLISHED or land in
 * REVIEW. The decision is per-item and combines the source's tier
 * with the adapter's per-item confidence signal.
 *
 *   confidence ∈ [0, 1] — 1.0 = adapter is certain this is the right
 *   shape and content. 0.5 is the rough boundary between "looks fine"
 *   and "looks uncertain"; anything below is sent to review except
 *   for the highest-trust tier.
 */
export function routeByTier(
  tier: Tier,
  options: { confidence?: number; theologicalReviewFlag?: boolean; softFailed?: boolean } = {},
): RoutingDecision {
  const confidence = options.confidence ?? 0.7;
  if (options.theologicalReviewFlag) {
    return {
      status: "REVIEW",
      reason: "Theological content flagged for human review",
    };
  }
  if (options.softFailed) {
    return {
      status: "REVIEW",
      reason: `Soft validation failure — diverting from ${tierLabel(tier)} to review`,
    };
  }
  if (tier === 1) {
    return confidence >= 0.5
      ? {
          status: "PUBLISHED",
          reason: `Tier 1 (official Church) confidence ${confidence.toFixed(2)} — auto-publish`,
        }
      : {
          status: "REVIEW",
          reason: `Tier 1 confidence ${confidence.toFixed(2)} below auto-publish threshold`,
        };
  }
  if (tier === 2) {
    return confidence >= 0.8
      ? {
          status: "PUBLISHED",
          reason: `Tier 2 (established publisher) confidence ${confidence.toFixed(2)} — auto-publish`,
        }
      : { status: "REVIEW", reason: `Tier 2 confidence ${confidence.toFixed(2)} — send to review` };
  }
  // Tier 3: always review unless very high confidence.
  return confidence >= 0.95
    ? {
        status: "PUBLISHED",
        reason: `Tier 3 very-high-confidence (${confidence.toFixed(2)}) — auto-publish`,
      }
    : { status: "REVIEW", reason: `Tier 3 source — review required by default` };
}
