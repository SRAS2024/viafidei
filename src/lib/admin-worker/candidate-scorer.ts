/**
 * CandidateUrlScorer (spec §5). Every candidate URL receives a
 * deterministic score so the fetcher can always pick the best safe
 * candidate first.
 *
 * Components stored on the CandidateSourceUrl row:
 *
 *   contentTypeLikelihood       chance the URL is the predicted type
 *   junkRisk                    chance the URL is a junk page (livestream,
 *                                event, donation, store, …)
 *   duplicateRisk               chance we already have this content
 *   sourceAuthorityScore        host's reputation tier (TRUSTED → 1.0)
 *   expectedPackageCompleteness chance the fetched page yields a
 *                                complete package
 *   expectedValidationValue     chance the URL helps verify another
 *                                source (validation-only sources)
 *
 * The single combined number is fetchPriority — what the fetcher
 * orders by. Higher = better.
 *
 * Scores update after every stage:
 *   - after fetch        adjusts junkRisk + contentTypeLikelihood
 *   - after classify     locks in contentTypeLikelihood
 *   - after extract      adjusts expectedPackageCompleteness
 *   - after QA           adjusts expectedPackageCompleteness
 *   - after publish      adjusts expectedPackageCompleteness +
 *                        sourceAuthorityScore via reputation
 */

import type { CandidateSourceUrl, ChecklistContentType, PrismaClient } from "@prisma/client";

import { isJunkUrl } from "./web-navigator";

const TIER_AUTHORITY: Record<string, number> = {
  TRUSTED: 1.0,
  GOOD: 0.85,
  NEUTRAL: 0.6,
  LIMITED: 0.35,
  POOR: 0.15,
  PAUSED: 0.0,
};

/** Patterns that boost contentTypeLikelihood per content type. */
const CONTENT_TYPE_HINTS: Record<string, RegExp[]> = {
  PRAYER: [/\/(prayers?|orations?|novena|chaplet)(\/|$)/i, /\/(act-of-|the-)/i],
  SAINT: [/\/(saint|saints|santo)\b/i, /\/feast-day\//i, /\/biograph/i],
  APPARITION: [/\/apparit/i, /\/our-lady-of-/i, /\/marian-/i],
  DEVOTION: [/\/devotion/i, /\/spiritual-practice/i],
  NOVENA: [/\/novena/i, /\/9-day/i, /\/nine-day/i],
  ROSARY: [/\/rosary/i, /\/mysteries/i],
  CONSECRATION: [/\/consecration/i, /\/total-consecration/i],
  SACRAMENT: [/\/sacrament/i, /\/catechism/i],
  LITURGY: [/\/(liturg|mass|order-of)/i],
  HISTORY: [/\/(history|council|catechism|canon-law|encyclical|papal)/i],
  PARISH: [/\/parish/i, /\/dioces/i, /\/find-a-parish/i, /\/contact-us/i],
};

/** Patterns that always raise junkRisk regardless of content type. */
const ALWAYS_JUNK_HINTS: RegExp[] = [
  /\/(news|press|blog|article)\b/i,
  /\/(event|calendar|schedule)\b/i,
  /\/(staff|directory|leadership)\b/i,
  /\/(donate|give|giving)\b/i,
  /\/(shop|store|cart)\b/i,
];

export interface CandidateScore {
  contentTypeLikelihood: number;
  junkRisk: number;
  duplicateRisk: number;
  sourceAuthorityScore: number;
  expectedPackageCompleteness: number;
  expectedValidationValue: number;
  fetchPriority: number;
  rejectionPattern: string | null;
}

/**
 * Pure scoring function. Takes a candidate + host reputation tier +
 * known duplicate count and produces a CandidateScore. The output is
 * deterministic — same inputs → same score.
 */
export function scoreCandidate(opts: {
  url: string;
  predictedContentType: string | null;
  reputationTier: keyof typeof TIER_AUTHORITY | null;
  duplicateMatches?: number;
  priorPublishSuccess?: boolean;
  fetchAttempts?: number;
}): CandidateScore {
  const url = opts.url;
  const tier = opts.reputationTier ?? "NEUTRAL";
  const sourceAuthority = TIER_AUTHORITY[tier] ?? 0.5;

  // Content-type likelihood: at most 1.0. Start at 0.4 if a type is
  // predicted, 0.2 if not, then bump per hint.
  const ct = opts.predictedContentType;
  const hints = ct ? (CONTENT_TYPE_HINTS[ct] ?? []) : [];
  let typeLikelihood = ct ? 0.4 : 0.2;
  for (const r of hints) {
    if (r.test(url)) typeLikelihood = Math.min(1, typeLikelihood + 0.2);
  }

  // Junk risk: start with the junk-pattern classifier, then add the
  // always-junk hints.
  let junkRisk = isJunkUrl(url).junk ? 0.9 : 0;
  for (const r of ALWAYS_JUNK_HINTS) {
    if (r.test(url)) junkRisk = Math.min(1, junkRisk + 0.2);
  }
  const rejectionPattern = junkRisk >= 0.6 ? findFirstMatching(url) : null;

  // Duplicate risk: if we already have N matching content rows the
  // chance of a useful new package is lower.
  const dups = opts.duplicateMatches ?? 0;
  const duplicateRisk = Math.min(1, dups * 0.25);

  // Expected package completeness: starts at 0.5. Boosted by source
  // authority and prior publish success.
  let packageCompleteness = 0.5 + sourceAuthority * 0.3;
  if (opts.priorPublishSuccess) packageCompleteness = Math.min(1, packageCompleteness + 0.15);
  // Penalty for repeated failed fetches on this URL.
  if ((opts.fetchAttempts ?? 0) > 2) packageCompleteness *= 0.7;

  // Expected validation value: validation-only sources have low
  // package completeness but high validation value. For now, treat
  // any URL on a TRUSTED host as having validation value 0.7.
  const expectedValidationValue = tier === "TRUSTED" ? 0.7 : tier === "GOOD" ? 0.5 : 0.3;

  // Combined priority. Heavier weight on type likelihood + completeness
  // because those are the strongest predictors of a publishable
  // package; junk + duplicate risk subtract.
  const fetchPriority =
    typeLikelihood * 0.35 +
    sourceAuthority * 0.2 +
    packageCompleteness * 0.25 +
    expectedValidationValue * 0.1 -
    junkRisk * 0.4 -
    duplicateRisk * 0.25;

  return {
    contentTypeLikelihood: round(typeLikelihood),
    junkRisk: round(junkRisk),
    duplicateRisk: round(duplicateRisk),
    sourceAuthorityScore: round(sourceAuthority),
    expectedPackageCompleteness: round(packageCompleteness),
    expectedValidationValue: round(expectedValidationValue),
    fetchPriority: round(fetchPriority),
    rejectionPattern,
  };
}

function findFirstMatching(url: string): string | null {
  for (const r of ALWAYS_JUNK_HINTS) {
    if (r.test(url)) return r.source;
  }
  return null;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Apply the score to a candidate row + return the score. Marks the
 * candidate REJECTED when junkRisk is high enough — these rows live
 * in the rejected-candidate dashboard for transparency.
 */
export async function scoreAndPersist(
  prisma: PrismaClient,
  candidate: CandidateSourceUrl,
): Promise<CandidateScore> {
  // Look up reputation for the host (best-effort: any-type row).
  const reputation = await prisma.adminWorkerSourceReputation
    .findFirst({
      where: { sourceHost: candidate.sourceHost },
      orderBy: { lastScoreUpdate: "desc" },
    })
    .catch(() => null);

  const duplicateMatches = candidate.predictedContentType
    ? await prisma.publishedContent
        .count({
          where: {
            contentType: candidate.predictedContentType as ChecklistContentType,
            isPublished: true,
          },
        })
        .catch(() => 0)
    : 0;

  const score = scoreCandidate({
    url: candidate.discoveredUrl,
    predictedContentType: candidate.predictedContentType,
    reputationTier: reputation?.reputationTier ?? null,
    duplicateMatches,
    priorPublishSuccess: (reputation?.publicPublishRate ?? 0) > 0.5,
    fetchAttempts: candidate.fetchAttempts,
  });

  const status =
    score.junkRisk >= 0.7
      ? "REJECTED"
      : score.fetchPriority > 0.45
        ? "PRIORITIZED"
        : candidate.status;

  await prisma.candidateSourceUrl.update({
    where: { id: candidate.id },
    data: {
      contentTypeLikelihood: score.contentTypeLikelihood,
      junkRisk: score.junkRisk,
      duplicateRisk: score.duplicateRisk,
      sourceAuthorityScore: score.sourceAuthorityScore,
      expectedPackageCompleteness: score.expectedPackageCompleteness,
      expectedValidationValue: score.expectedValidationValue,
      fetchPriority: score.fetchPriority,
      scoreUpdatedAt: new Date(),
      rejectionPattern: score.rejectionPattern,
      rejectionReason:
        status === "REJECTED"
          ? `junk risk ${score.junkRisk.toFixed(2)} above threshold${score.rejectionPattern ? ` (pattern ${score.rejectionPattern})` : ""}`
          : candidate.rejectionReason,
      status,
    },
  });

  return score;
}

/**
 * Score every DISCOVERED or PRIORITIZED candidate. Used by the
 * dispatcher's CANDIDATE_PRIORITIZATION stage to keep priorities
 * fresh after fetch/classify/extract feedback.
 */
export async function rescoreAllCandidates(
  prisma: PrismaClient,
  opts: { limit?: number } = {},
): Promise<{ scored: number; rejected: number; prioritized: number }> {
  const candidates = await prisma.candidateSourceUrl.findMany({
    where: { status: { in: ["DISCOVERED", "PRIORITIZED"] } },
    orderBy: { createdAt: "asc" },
    take: opts.limit ?? 100,
  });
  let scored = 0;
  let rejected = 0;
  let prioritized = 0;
  for (const c of candidates) {
    const score = await scoreAndPersist(prisma, c);
    scored += 1;
    if (score.junkRisk >= 0.7) rejected += 1;
    else if (score.fetchPriority > 0.45) prioritized += 1;
  }
  return { scored, rejected, prioritized };
}

/**
 * After a fetch / classify / extract / QA / publish event, nudge the
 * candidate score based on the actual outcome. Later passes will
 * use the updated score.
 */
export async function adjustAfterOutcome(
  prisma: PrismaClient,
  candidateUrlId: string,
  outcome:
    | "FETCH_OK"
    | "FETCH_FAIL"
    | "CLASSIFY_OK"
    | "CLASSIFY_REJECTED"
    | "EXTRACT_OK"
    | "EXTRACT_PARTIAL"
    | "EXTRACT_FAIL"
    | "QA_OK"
    | "QA_FAIL"
    | "PUBLISH_OK"
    | "PUBLISH_FAIL",
): Promise<void> {
  const candidate = await prisma.candidateSourceUrl.findUnique({
    where: { id: candidateUrlId },
  });
  if (!candidate) return;

  const delta = OUTCOME_DELTAS[outcome];
  const score = await scoreAndPersist(prisma, candidate);
  const newPriority = Math.max(0, Math.min(1, score.fetchPriority + delta));

  await prisma.candidateSourceUrl.update({
    where: { id: candidateUrlId },
    data: { fetchPriority: newPriority },
  });
}

const OUTCOME_DELTAS: Record<string, number> = {
  FETCH_OK: 0.05,
  FETCH_FAIL: -0.15,
  CLASSIFY_OK: 0.1,
  CLASSIFY_REJECTED: -0.4,
  EXTRACT_OK: 0.15,
  EXTRACT_PARTIAL: -0.05,
  EXTRACT_FAIL: -0.2,
  QA_OK: 0.2,
  QA_FAIL: -0.2,
  PUBLISH_OK: 0.25,
  PUBLISH_FAIL: -0.3,
};
